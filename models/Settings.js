const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['Singles', 'Doubles'], default: 'Doubles' },
  entryFee: { type: Number, default: 800 },
  maxAge: { type: Number, default: 100 },
  minAge: { type: Number, default: 0 },
  maxSlots: { type: Number, default: 32 },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true }
});

const SettingsSchema = new mongoose.Schema({
  tournamentName: { type: String, default: 'S.P. Badminton Tourney 3' },
  subtitle: { type: String, default: 'Annual Championship 2026' },
  dates: { type: String, default: '29th March 2026' },
  venue: { type: String, default: 'S.P. Badminton Academy, Court Complex' },
  courtMapsUrl: { type: String, default: 'https://maps.app.goo.gl/QnaBgoVEJa7tdQfx7' },
  registrationStatus: { type: String, enum: ['Open', 'Closed', 'Paused', 'OPEN', 'CLOSED', 'PAUSED'], default: 'Open' },
  registrationCloseDate: { type: String, default: '25th March 2026, 11:59 PM' },
  flashAnnouncement: { type: String, default: '🏸 Registrations are now LIVE! Secure your court slot today.' },
  flashActive: { type: Boolean, default: true },
  upiId: { type: String, default: 'hemantkalra2006-1@okhdfcbank' },
  upiPayeeName: { type: String, default: 'Hemant Kalra' },
  upiQrUrl: { type: String, default: '/qr_code.png' },
  logoUrl: { type: String, default: '/logo.png' },
  adminPin: { type: String, default: '9903' },
  scorerPin: { type: String, default: '123499' },
  contactPersons: [{
    name: { type: String },
    phone: { type: String },
    role: { type: String, default: 'Organizer' }
  }],
  rules: [{ type: String }],
  categories: [CategorySchema],
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Settings', SettingsSchema);
