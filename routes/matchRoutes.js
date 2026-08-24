const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const { requireAdmin, requireScorerOrAdmin } = require('../middleware/auth');

// 1. Get Match Schedule (Public)
router.get('/schedule', async (req, res) => {
  try {
    const { category, court, status } = req.query;
    const filter = {};
    if (category && category !== 'ALL') filter.category = category;
    if (court && court !== 'ALL') filter.courtNumber = Number(court);
    if (status && status !== 'ALL') filter.status = status;

    const matches = await Match.find(filter).sort({ courtNumber: 1, matchNumber: 1 });
    return res.json({ success: true, schedule: matches });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Live Matches (Public & TV Overlay)
router.get('/live', async (req, res) => {
  try {
    const liveMatches = await Match.find({
      $or: [
        { status: { $in: ['Live', 'LIVE', 'IN PROGRESS', 'UPCOMING', 'INTERVAL', 'COMPLETED'] } },
        { isLive: true }
      ]
    }).sort({ updatedAt: -1, courtNumber: 1 });

    return res.json({ success: true, liveMatches });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Single Match Details
router.get('/:matchId', async (req, res) => {
  try {
    const match = await Match.findOne({ matchId: req.params.matchId });
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

    // Upsert each match
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

    const updatedSchedule = await Match.find().sort({ courtNumber: 1, matchNumber: 1 });
    return res.json({ success: true, message: 'Schedule synchronized successfully', schedule: updatedSchedule });
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

    const match = await Match.findOne({ matchId });
    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    if (team1Score !== undefined) match.team1.score = team1Score;
    if (team2Score !== undefined) match.team2.score = team2Score;
    if (team1Sets !== undefined) match.team1.setsWon = team1Sets;
    if (team2Sets !== undefined) match.team2.setsWon = team2Sets;
    if (currentSet !== undefined) match.currentSet = currentSet;
    if (server !== undefined) match.server = server;
    if (status !== undefined) {
      match.status = status;
      match.isLive = (status === 'Live');
    }
    if (winner !== undefined) {
      match.winner = winner;
      match.winnerName = winner === 'team1' ? match.team1.name : (winner === 'team2' ? match.team2.name : '');
    }

    match.updatedAt = new Date();
    await match.save();

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
