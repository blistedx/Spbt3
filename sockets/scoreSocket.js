const mongoose = require('mongoose');
const Match = require('../models/Match');
const dataStore = require('../config/dataStore');

function setupScoreSocket(io) {
  io.on('connection', (socket) => {
    // 1. Send latest live match on connection immediately from memory cache (0ms)
    try {
      const liveMatch = dataStore.getLiveMatch();
      if (liveMatch) {
        socket.emit('match_state', liveMatch);
        socket.emit('tv_score_update', liveMatch);
        socket.emit('score_update', liveMatch);
        socket.emit('score_updated', { matchId: liveMatch.matchId || 'Court 1', match: liveMatch });
      }
    } catch (e) {}

    // Join court specific room or TV broadcast
    socket.on('join_court', (courtNumber) => {
      const room = `court_${courtNumber || 1}`;
      socket.join(room);
      socket.join('tv_broadcast');

      // Send latest live match immediately from RAM (0ms)
      try {
        const liveMatch = dataStore.getLiveMatch();
        if (liveMatch) {
          socket.emit('match_state', liveMatch);
          socket.emit('tv_score_update', liveMatch);
          socket.emit('score_update', liveMatch);
          socket.emit('score_updated', { matchId: liveMatch.matchId || 'Court 1', match: liveMatch });
        }
      } catch (err) {
        console.error('Error fetching live match on join:', err);
      }
    });

    // Request immediate live state
    socket.on('request_live_state', () => {
      try {
        const liveMatch = dataStore.getLiveMatch();
        if (liveMatch) {
          socket.emit('match_state', liveMatch);
          socket.emit('tv_score_update', liveMatch);
          socket.emit('score_update', liveMatch);
        }
      } catch (e) {}
    });

    // Score point / match update event (Instant 0ms in-memory broadcast)
    socket.on('score_point', (data) => {
      handleMatchUpdate(data);
    });

    socket.on('update_score', (data) => {
      handleMatchUpdate(data);
    });

    socket.on('sync_match', (data) => {
      handleMatchUpdate(data);
    });

    function handleMatchUpdate(data) {
      try {
        if (!data) return;
        const matchId = data.matchId || 'Court 1';

        // 1. Full match object from scorer desk -> Update RAM & Broadcast in 0ms
        if (data.p1Name || data.p2Name || data.games || data.score || data.status || data.setsWon) {
          const updatedLive = dataStore.saveLiveMatch(data);

          // ⚡ INSTANT 0MS BROADCAST (NO WAITING FOR DATABASE WRITE)
          io.emit('score_update', updatedLive);
          io.emit('tv_score_update', updatedLive);
          io.emit('match_state', updatedLive);
          io.emit('court:update', updatedLive);
          io.emit('score_updated', { matchId, match: updatedLive });
          io.to('tv_broadcast').emit('tv_score_update', updatedLive);
          io.to('court_1').emit('match_state', updatedLive);

          // Background non-blocking persistence (async)
          if (mongoose.connection.readyState === 1 && Match && Match.findOneAndUpdate) {
            Match.findOneAndUpdate(
              { matchId },
              {
                ...updatedLive,
                p1Name: updatedLive.p1Name,
                p2Name: updatedLive.p2Name,
                category: updatedLive.category || 'Below 35',
                score: updatedLive.score,
                games: updatedLive.games,
                setsWon: updatedLive.setsWon,
                isLive: (updatedLive.status === 'LIVE' || updatedLive.status === 'Live' || updatedLive.status === 'IN PROGRESS'),
                status: updatedLive.status || 'LIVE',
                updatedAt: new Date()
              },
              { upsert: true, new: true }
            ).catch(() => {});
          }
          return;
        }

        // 2. Incremental point update
        const { team, server } = data;
        const currentMatch = dataStore.getLiveMatch();
        if (!currentMatch) return;

        const currG = currentMatch.currentGame || 0;
        if (!currentMatch.games) currentMatch.games = [[0, 0], [0, 0], [0, 0]];
        if (!currentMatch.games[currG]) currentMatch.games[currG] = [0, 0];

        if (team === 'team1' || team === 1) {
          currentMatch.games[currG][0] = (currentMatch.games[currG][0] || 0) + 1;
        } else if (team === 'team2' || team === 2) {
          currentMatch.games[currG][1] = (currentMatch.games[currG][1] || 0) + 1;
        }

        if (server) currentMatch.server = server;
        currentMatch.status = 'LIVE';
        currentMatch.isLive = true;
        currentMatch.updatedAt = Date.now();

        const updated = dataStore.saveLiveMatch(currentMatch);

        // ⚡ INSTANT 0MS BROADCAST
        io.emit('score_update', updated);
        io.emit('tv_score_update', updated);
        io.emit('match_state', updated);
        io.emit('court:update', updated);
        io.emit('score_updated', { matchId, match: updated });

        // Background non-blocking persistence
        if (mongoose.connection.readyState === 1 && Match && Match.findOneAndUpdate) {
          Match.findOneAndUpdate(
            { matchId },
            { ...updated, updatedAt: new Date() },
            { upsert: true }
          ).catch(() => {});
        }
      } catch (err) {
        console.error('Error handling score_point:', err);
      }
    }

    // Undo score event
    socket.on('undo_point', (data) => {
      try {
        if (!data) return;
        const matchId = data.matchId || 'Court 1';
        const currentMatch = dataStore.getLiveMatch();
        if (data.match) {
          handleMatchUpdate(data.match);
          return;
        }

        const currG = currentMatch.currentGame || 0;
        if (currentMatch.games && currentMatch.games[currG]) {
          if (data.team === 'team1' || data.team === 1) {
            currentMatch.games[currG][0] = Math.max(0, currentMatch.games[currG][0] - 1);
          } else if (data.team === 'team2' || data.team === 2) {
            currentMatch.games[currG][1] = Math.max(0, currentMatch.games[currG][1] - 1);
          }
        }
        const updated = dataStore.saveLiveMatch(currentMatch);
        io.emit('score_update', updated);
        io.emit('tv_score_update', updated);
        io.emit('match_state', updated);
        io.emit('score_updated', { matchId, match: updated });
      } catch (err) {
        console.error('Error handling undo_point:', err);
      }
    });

    // Switch sides
    socket.on('switch_sides', (data) => {
      try {
        if (data && data.match) {
          handleMatchUpdate(data.match);
          return;
        }
        const currentMatch = dataStore.getLiveMatch();
        const tempName = currentMatch.p1Name;
        currentMatch.p1Name = currentMatch.p2Name;
        currentMatch.p2Name = tempName;
        if (currentMatch.games) {
          currentMatch.games.forEach(g => {
            const temp = g[0];
            g[0] = g[1];
            g[1] = temp;
          });
        }
        const updated = dataStore.saveLiveMatch(currentMatch);
        io.emit('score_update', updated);
        io.emit('tv_score_update', updated);
        io.emit('match_state', updated);
      } catch (err) {
        console.error('Error handling switch_sides:', err);
      }
    });

    // Change server
    socket.on('change_server', (data) => {
      try {
        const currentMatch = dataStore.getLiveMatch();
        if (data && data.server) {
          currentMatch.server = data.server;
          const updated = dataStore.saveLiveMatch(currentMatch);
          io.emit('score_update', updated);
          io.emit('tv_score_update', updated);
          io.emit('match_state', updated);
        }
      } catch (err) {
        console.error('Error handling change_server:', err);
      }
    });

    // Interval Update (Pause/Resume/Start/Stop)
    socket.on('interval_update', (data) => {
      try {
        const currentMatch = dataStore.getLiveMatch();
        if (data && data.interval) {
          currentMatch.interval = data.interval;
          const updated = dataStore.saveLiveMatch(currentMatch);
          io.emit('score_update', updated);
          io.emit('tv_score_update', updated);
          io.emit('match_state', updated);
        }
      } catch (err) {
        console.error('Error handling interval_update:', err);
      }
    });

    // Custom Broadcast Notice Message to TV Overlay
    socket.on('broadcast_message', (data) => {
      try {
        const currentMatch = dataStore.getLiveMatch();
        currentMatch.customMessage = (data && data.message !== undefined) ? data.message : '';
        const updated = dataStore.saveLiveMatch(currentMatch);
        io.emit('score_update', updated);
        io.emit('tv_score_update', updated);
        io.emit('match_state', updated);
      } catch (err) {
        console.error('Error handling broadcast_message:', err);
      }
    });

    // Set won event
    socket.on('set_won', (data) => {
      try {
        if (data && data.match) {
          handleMatchUpdate(data.match);
        }
      } catch (err) {
        console.error('Error handling set_won:', err);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });
}

module.exports = { setupScoreSocket };
