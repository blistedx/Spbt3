const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Match = require('../models/Match');
const dataStore = require('../config/dataStore');
const { requireAdmin, requireScorerOrAdmin } = require('../middleware/auth');

// 1. Get Match Schedule (Public)
router.get('/schedule', async (req, res) => {
  try {
    const { category, court, status } = req.query;
    let matches = [];

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const filter = {};
        if (category && category !== 'ALL') filter.category = category;
        if (court && court !== 'ALL') filter.courtNumber = Number(court);
        if (status && status !== 'ALL') filter.status = status;
        matches = await Match.find(filter).sort({ courtNumber: 1, matchNumber: 1 }).lean();
      }
    } catch (e) {
      // Fall through to dataStore
    }

    if (!matches || matches.length === 0) {
      matches = dataStore.getMatches();
      if (category && category !== 'ALL') matches = matches.filter(m => (m.category || '').toLowerCase() === category.toLowerCase());
      if (court && court !== 'ALL') matches = matches.filter(m => (m.courtNumber === Number(court) || m.court === `Court ${court}`));
      if (status && status !== 'ALL') matches = matches.filter(m => (m.status || '').toUpperCase() === status.toUpperCase());
    }

    return res.json({ success: true, schedule: matches });
  } catch (err) {
    return res.json({ success: true, schedule: dataStore.getMatches() });
  }
});

// 2. Get Live Matches (Public & TV Overlay)
router.get('/live', async (req, res) => {
  try {
    let liveMatches = [];

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        liveMatches = await Match.find({
          $or: [
            { status: { $in: ['Live', 'LIVE', 'IN PROGRESS', 'UPCOMING', 'INTERVAL', 'COMPLETED'] } },
            { isLive: true }
          ]
        }).sort({ updatedAt: -1, courtNumber: 1 }).lean();
      }
    } catch (e) {
      // Fall through to dataStore
    }

    const liveMatch = dataStore.getLiveMatch();
    const allMatches = dataStore.getMatches();

    if (!liveMatches || liveMatches.length === 0) {
      liveMatches = allMatches.filter(m => m.isLive || ['LIVE', 'IN PROGRESS', 'UPCOMING', 'INTERVAL'].includes((m.status || '').toUpperCase()));
      if (liveMatches.length === 0 && liveMatch && liveMatch.status && liveMatch.status !== 'NO_LIVE_MATCH') {
        liveMatches = [liveMatch];
      }
    }

    return res.json({ success: true, liveMatches, liveMatch: liveMatch || null });
  } catch (err) {
    const liveMatch = dataStore.getLiveMatch();
    return res.json({ success: true, liveMatches: liveMatch ? [liveMatch] : [], liveMatch: liveMatch || null });
  }
});

// 3. Get Single Match Details
router.get('/:matchId', async (req, res) => {
  try {
    let match = null;

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        match = await Match.findOne({ matchId: req.params.matchId }).lean();
      }
    } catch (e) {
      // Fall through
    }

    if (!match) {
      match = dataStore.getMatches().find(m => m.matchId === req.params.matchId || m.id === req.params.matchId);
    }

    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }
    return res.json({ success: true, match });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Admin: Save Bulk Schedule (Replaces / Updates Schedule)
router.post('/admin/save-schedule', requireAdmin, async (req, res) => {
  try {
    const { schedule } = req.body;
    if (!schedule || !Array.isArray(schedule)) {
      return res.status(400).json({ success: false, error: 'Invalid schedule array' });
    }

    dataStore.saveMatches(schedule);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const bulkOps = schedule.map((item, index) => {
          const matchId = item.matchId || item.id || `M-${100 + index + 1}`;
          const team1Obj = (typeof item.team1 === 'object') ? item.team1 : { name: item.team1 || 'TBD', score: 0, setsWon: 0, setScores: [] };
          const team2Obj = (typeof item.team2 === 'object') ? item.team2 : { name: item.team2 || 'TBD', score: 0, setsWon: 0, setScores: [] };

          return {
            updateOne: {
              filter: { matchId },
              update: {
                $set: {
                  matchId,
                  category: item.category || 'Open Doubles',
                  round: item.round || 'Round 1',
                  matchNumber: item.matchNumber || (index + 1),
                  courtNumber: item.courtNumber || 1,
                  scheduledTime: item.scheduledTime || item.time || '',
                  team1: team1Obj,
                  team2: team2Obj,
                  status: item.status || 'Scheduled',
                  winner: item.winner || 'none',
                  winnerName: item.winnerName || '',
                  updatedAt: new Date()
                }
              },
              upsert: true
            }
          };
        });

        if (bulkOps.length > 0) {
          await Match.bulkWrite(bulkOps);
        }
      }
    } catch (e) {
      console.warn('Mongoose schedule sync notice:', e.message);
    }

    return res.json({ success: true, message: 'Schedule synchronized successfully', schedule: dataStore.getMatches() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4b. Admin: Clear All Matches & Schedule
router.post('/admin/clear-schedule', requireAdmin, async (req, res) => {
  try {
    dataStore.clearAllMatches();
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await Match.deleteMany({});
      }
    } catch (e) {}
    const io = req.app.get('io');
    if (io) {
      io.emit('schedule_update', { schedule: [] });
      io.emit('score_update', dataStore.getLiveMatch());
    }
    return res.json({ success: true, message: 'All matches and schedule cleared successfully', schedule: [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/admin/clear-schedule', requireAdmin, async (req, res) => {
  try {
    dataStore.clearAllMatches();
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await Match.deleteMany({});
      }
    } catch (e) {}
    const io = req.app.get('io');
    if (io) {
      io.emit('schedule_update', { schedule: [] });
      io.emit('score_update', dataStore.getLiveMatch());
    }
    return res.json({ success: true, message: 'All matches and schedule cleared successfully', schedule: [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Scorer / Admin: Update Match Score & State
router.post('/update-score', requireScorerOrAdmin, async (req, res) => {
  try {
    const { matchId, team1Score, team2Score, team1Sets, team2Sets, currentSet, server, status, winner } = req.body;
    if (!matchId) {
      return res.status(400).json({ success: false, error: 'Match ID is required' });
    }

    const matches = dataStore.getMatches();
    let match = matches.find(m => m.matchId === matchId || m.id === matchId) || { matchId };

    if (team1Score !== undefined) match.team1Score = team1Score;
    if (team2Score !== undefined) match.team2Score = team2Score;
    if (team1Sets !== undefined) match.team1Sets = team1Sets;
    if (team2Sets !== undefined) match.team2Sets = team2Sets;
    if (currentSet !== undefined) match.currentSet = currentSet;
    if (server !== undefined) match.server = server;
    if (status !== undefined) {
      match.status = status;
      match.isLive = (status === 'Live' || status === 'LIVE');
    }
    if (winner !== undefined) {
      match.winner = winner;
    }

    dataStore.addOrUpdateMatch(match);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const dbMatch = await Match.findOne({ matchId });
        if (dbMatch) {
          if (team1Score !== undefined) dbMatch.team1.score = team1Score;
          if (team2Score !== undefined) dbMatch.team2.score = team2Score;
          if (team1Sets !== undefined) dbMatch.team1.setsWon = team1Sets;
          if (team2Sets !== undefined) dbMatch.team2.setsWon = team2Sets;
          if (currentSet !== undefined) dbMatch.currentSet = currentSet;
          if (server !== undefined) dbMatch.server = server;
          if (status !== undefined) {
            dbMatch.status = status;
            dbMatch.isLive = (status === 'Live');
          }
          if (winner !== undefined) {
            dbMatch.winner = winner;
            dbMatch.winnerName = winner === 'team1' ? dbMatch.team1.name : (winner === 'team2' ? dbMatch.team2.name : '');
          }
          dbMatch.updatedAt = new Date();
          await dbMatch.save();
        }
      }
    } catch (e) {
      console.warn('Mongoose score update notice:', e.message);
    }

    // Broadcast via global io if available
    const io = req.app.get('io');
    if (io) {
      io.emit('score_updated', { matchId: match.matchId, match });
    }

    return res.json({ success: true, message: 'Score updated successfully', match });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
