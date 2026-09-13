/**
 * S.P. Badminton Tourney 3 · Live Courtside Score Socket Engine
 * 0ms instant broadcast to all connected clients (Spectator, TV, Scorer, Admin)
 * Synchronized persistence directly to online Neon PostgreSQL database
 */
const dataStore = require('../config/dataStore');

function setupScoreSocket(io) {
  io.on('connection', (socket) => {
    // 1. Send latest live match on connection immediately from Neon-backed cache (0ms)
    try {
      const liveMatch = dataStore.getLiveMatch();
      if (liveMatch) {
        socket.emit('match_state', liveMatch);
        socket.emit('tv_score_update', liveMatch);
        socket.emit('score_update', liveMatch);
        socket.emit('court:update', liveMatch);
        socket.emit('score_updated', { matchId: liveMatch.matchId || 'Court 1', match: liveMatch });
      }
    } catch (e) {}

    // Join court specific room or TV broadcast
    socket.on('join_court', (courtNumber) => {
      const room = `court_${courtNumber || 1}`;
      socket.join(room);
      socket.join('tv_broadcast');

      // Send latest live match immediately (0ms)
      try {
        const liveMatch = dataStore.getLiveMatch();
        if (liveMatch) {
          socket.emit('match_state', liveMatch);
          socket.emit('tv_score_update', liveMatch);
          socket.emit('score_update', liveMatch);
          socket.emit('court:update', liveMatch);
          socket.emit('score_updated', { matchId: liveMatch.matchId || 'Court 1', match: liveMatch });
        }
      } catch (err) {
        console.error('[ScoreSocket] Error fetching live match on join:', err.message);
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
          socket.emit('court:update', liveMatch);
        }
      } catch (e) {}
    });

    // Score point / match update event (Instant 0ms broadcast & Neon PostgreSQL persistence)
    socket.on('score_point', async (data) => {
      await handleMatchUpdate(data);
    });

    socket.on('update_score', async (data) => {
      await handleMatchUpdate(data);
    });

    socket.on('sync_match', async (data) => {
      await handleMatchUpdate(data);
    });

    async function handleMatchUpdate(data) {
      try {
        if (!data) return;
        const matchId = data.matchId || 'Court 1';

        // 1. Full match object from scorer desk -> Update Neon live_match & matches tables
        if (data.p1Name || data.p2Name || data.games || data.score || data.status || data.setsWon) {
          const updatedLive = await dataStore.saveLiveMatch({
            ...data,
            updatedAt: data.updatedAt || Date.now()
          });

          // Sync to Neon matches table as well if valid tournament match
          if (matchId && matchId !== 'Court 1' && matchId !== 'Court 2') {
            const existingMatch = dataStore.getMatches().find(m => (m.matchId === matchId || m.id === matchId));
            const p1 = updatedLive.p1Name || existingMatch?.team1Name || 'Player 1';
            const p2 = updatedLive.p2Name || existingMatch?.team2Name || 'Player 2';
            dataStore.addOrUpdateMatch({
              matchId: matchId,
              p1Name: p1,
              p2Name: p2,
              team1_name: p1,
              team2_name: p2,
              round: existingMatch?.round || data.round,
              category: updatedLive.category || existingMatch?.category || 'Below 35',
              court: updatedLive.court || existingMatch?.court || 'Court 1',
              status: updatedLive.status || (updatedLive.isLive ? 'LIVE' : 'UPCOMING'),
              winner: updatedLive.winner || existingMatch?.winner || '',
              scores: updatedLive.games || [],
              sets: updatedLive.setsWon || [0, 0]
            });
          }

          // ⚡ INSTANT 0MS BROADCAST TO ALL CONNECTED CLIENTS & HOSTS
          io.emit('score_update', updatedLive);
          io.emit('tv_score_update', updatedLive);
          io.emit('match_state', updatedLive);
          io.emit('court:update', updatedLive);
          io.emit('score_updated', { matchId, match: updatedLive });
          io.emit('schedule_updated', { schedule: dataStore.getMatches() });
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

        const updated = await dataStore.saveLiveMatch(currentMatch);

        // Sync to Neon matches table if valid tournament match
        const activeMatchId = updated.matchId || matchId;
        if (activeMatchId && activeMatchId !== 'Court 1' && activeMatchId !== 'Court 2') {
          const existingMatch = dataStore.getMatches().find(m => (m.matchId === activeMatchId || m.id === activeMatchId));
          dataStore.addOrUpdateMatch({
            matchId: activeMatchId,
            p1Name: updated.p1Name,
            p2Name: updated.p2Name,
            team1_name: updated.p1Name,
            team2_name: updated.p2Name,
            round: existingMatch?.round,
            category: updated.category || existingMatch?.category || 'Below 35',
            court: updated.court || existingMatch?.court || 'Court 1',
            status: 'LIVE',
            winner: updated.winner || '',
            scores: updated.games || [],
            sets: updated.setsWon || [0, 0]
          });
        }

        // ⚡ INSTANT 0MS BROADCAST
        io.emit('score_update', updated);
        io.emit('tv_score_update', updated);
        io.emit('match_state', updated);
        io.emit('court:update', updated);
        io.emit('score_updated', { matchId: activeMatchId, match: updated });
        io.emit('schedule_updated', { schedule: dataStore.getMatches() });
      } catch (err) {
        console.error('[ScoreSocket] Error handling score_point:', err.message);
      }
    }

    // Undo score event
    socket.on('undo_point', async (data) => {
      try {
        if (!data) return;
        const matchId = data.matchId || 'Court 1';
        const currentMatch = dataStore.getLiveMatch();
        if (data.match) {
          await handleMatchUpdate(data.match);
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
        const updated = await dataStore.saveLiveMatch(currentMatch);
        io.emit('score_update', updated);
        io.emit('tv_score_update', updated);
        io.emit('match_state', updated);
        io.emit('score_updated', { matchId, match: updated });
      } catch (err) {
        console.error('[ScoreSocket] Error handling undo_point:', err.message);
      }
    });

    // Switch sides
    socket.on('switch_sides', async (data) => {
      try {
        if (data && data.match) {
          await handleMatchUpdate(data.match);
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
        const updated = await dataStore.saveLiveMatch(currentMatch);
        io.emit('score_update', updated);
        io.emit('tv_score_update', updated);
        io.emit('match_state', updated);
      } catch (err) {
        console.error('[ScoreSocket] Error handling switch_sides:', err.message);
      }
    });

    // Change server
    socket.on('change_server', async (data) => {
      try {
        const currentMatch = dataStore.getLiveMatch();
        if (data && data.server) {
          currentMatch.server = data.server;
          const updated = await dataStore.saveLiveMatch(currentMatch);
          io.emit('score_update', updated);
          io.emit('tv_score_update', updated);
          io.emit('match_state', updated);
        }
      } catch (err) {
        console.error('[ScoreSocket] Error handling change_server:', err.message);
      }
    });

    // Interval Update (Pause/Resume/Start/Stop)
    socket.on('interval_update', async (data) => {
      try {
        const currentMatch = dataStore.getLiveMatch();
        if (data && data.interval) {
          currentMatch.interval = data.interval;
          currentMatch.updatedAt = data.updatedAt || Date.now();
          const updated = await dataStore.saveLiveMatch(currentMatch);
          io.emit('score_update', updated);
          io.emit('tv_score_update', updated);
          io.emit('match_state', updated);
        }
      } catch (err) {
        console.error('[ScoreSocket] Error handling interval_update:', err.message);
      }
    });

    // Custom Broadcast Notice Message to TV Overlay
    socket.on('broadcast_message', async (data) => {
      try {
        const currentMatch = dataStore.getLiveMatch();
        currentMatch.customMessage = (data && data.message !== undefined) ? data.message : '';
        const updated = await dataStore.saveLiveMatch(currentMatch);
        io.emit('score_update', updated);
        io.emit('tv_score_update', updated);
        io.emit('match_state', updated);
      } catch (err) {
        console.error('[ScoreSocket] Error handling broadcast_message:', err.message);
      }
    });

    // Set won event
    socket.on('set_won', async (data) => {
      try {
        if (data && data.match) {
          await handleMatchUpdate(data.match);
        }
      } catch (err) {
        console.error('[ScoreSocket] Error handling set_won:', err.message);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });
}

module.exports = { setupScoreSocket };
