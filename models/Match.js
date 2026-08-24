const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  player1: { type: String, default: '' },
  player2: { type: String, default: '' },
  regId: { type: String, default: '' },
  score: { type: Number, default: 0 },
  setsWon: { type: Number, default: 0 },
  setScores: [{ type: Number }]
}, { _id: false });

const MatchSchema = new mongoose.Schema({
  matchId: { type: String, unique: true, required: true, index: true },
  category: { type: String, default: 'Below 35' },
  round: { type: String, default: 'Round 1' },
  matchNumber: { type: Number, default: 1 },
  courtNumber: { type: Number, default: 1 },
  scheduledTime: { type: String, default: '' },

  team1: { type: TeamSchema },
  team2: { type: TeamSchema },

  p1Name: { type: String, default: '' },
  p2Name: { type: String, default: '' },
  score: { type: String, default: '0-0' },
  games: { type: Array, default: [[0, 0], [0, 0], [0, 0]] },
  setsWon: { type: Array, default: [0, 0] },
  targetPoints: { type: Number, default: 21 },
  server: { type: mongoose.Schema.Types.Mixed, default: 1 },
  currentGame: { type: Number, default: 0 },
  currentSet: { type: Number, default: 1 },
  maxSets: { type: Number, default: 3 },
  pointsToWin: { type: Number, default: 21 },
  capPoints: { type: Number, default: 30 },

  serverPlayer: { type: String, default: '' },
  courtSides: {
    left: { type: String, default: 'team1' },
    right: { type: String, default: 'team2' }
  },

  status: {
    type: String,
    default: 'Scheduled',
    index: true
  },
  winner: { type: String, default: 'none' },
  winnerName: { type: String, default: '' },

  scoreHistory: [{
    action: String,
    team1Score: Number,
    team2Score: Number,
    currentSet: Number,
    server: String,
    timestamp: { type: Date, default: Date.now }
  }],

  isLive: { type: Boolean, default: false, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Match', MatchSchema);

