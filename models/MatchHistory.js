const mongoose = require('mongoose');

const MatchHistorySchema = new mongoose.Schema({
  recordId: { type: String, unique: true, required: true, index: true },
  matchId: { type: String, default: 'Court 1' },
  category: { type: String, default: 'Below 35' },
  round: { type: String, default: 'Knockout' },
  court: { type: String, default: 'Court 1' },
  p1Name: { type: String, default: '' },
  p2Name: { type: String, default: '' },
  winner: { type: String, default: '' },
  winnerName: { type: String, default: '' },
  score: { type: String, default: '' },
  games: { type: Array, default: [] },
  setsWon: { type: Array, default: [0, 0] },
  durationMinutes: { type: Number, default: 0 },
  durationFormatted: { type: String, default: '' },
  rallyLog: { type: Array, default: [] },
  status: { type: String, default: 'COMPLETED' },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true, strict: false });

module.exports = mongoose.model('MatchHistory', MatchHistorySchema);
