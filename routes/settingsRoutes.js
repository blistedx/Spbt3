const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const dataStore = require('../config/dataStore');
const { requireAdmin } = require('../middleware/auth');

// Default Fallback Tournament Configuration
const DEFAULT_CONFIG = {
  tournamentName: 'S.P. Badminton Tourney 3',
  subtitle: 'Official Championship 2026',
  dates: '28–30 Aug 2026',
  venue: 'Suryodaya Park Court',
  courtMapsUrl: 'https://maps.app.goo.gl/QnaBgoVEJa7tdQfx7',
  registrationStatus: 'OPEN',
  registrationCloseDate: '27th Aug 2026, 11:59 PM',
  flashAnnouncement: '🏸 Registrations are OPEN! Limited team slots available. Instant confirmation via UPI.',
  flashActive: true,
  upiId: 'blistedx@okhdfcbank',
  upiPayeeName: 'S.P. Badminton Club',
  upiQrUrl: '/qr_code.png',
  logoUrl: '/logo.png',
  contactPersons: [
    { name: 'Hemant Kalra', phone: '9810332822', role: 'Tournament Director' },
    { name: 'Nitesh Sharma', phone: '9811568855', role: 'Head of Operations' }
  ],
  rules: [
    'All matches will be played in accordance with Badminton World Federation (BWF) 21-point rally scoring format.',
    'Feather shuttles will be provided for all category matches.',
    'Players must report at least 30 minutes prior to their scheduled match time.',
    'Non-marking badminton court shoes are mandatory on all synthetic courts.',
    'Referees and Tournament Committee decisions are final and binding.'
  ],
  categories: [
    { code: 'BELOW_35', name: "Below 35", type: 'Doubles', entryFee: 500, maxAge: 35, minAge: 15, maxSlots: 32, active: true },
    { code: 'ABOVE_35', name: "Above 35", type: 'Doubles', entryFee: 500, maxAge: 100, minAge: 35, maxSlots: 32, active: true }
  ]
};

// Public Tournament Configuration
router.get('/public', async (req, res) => {
  try {
    const fileSettings = dataStore.getSettings();
    let settings = null;
    try {
      if (mongoose.connection.readyState === 1) {
        settings = await Settings.findOne();
      }
    } catch (dbErr) {
      console.warn('DB lookup fallback:', dbErr.message);
    }

    const tName = (settings && settings.tournamentName) || fileSettings.tournament_name || DEFAULT_CONFIG.tournamentName;
    const sub = (settings && settings.subtitle) || fileSettings.tournament_subtitle || DEFAULT_CONFIG.subtitle;
    const dates = (settings && settings.dates) || fileSettings.dates || DEFAULT_CONFIG.dates;
    const venue = (settings && settings.venue) || fileSettings.venue || DEFAULT_CONFIG.venue;
    const flashMsg = (settings && settings.flashAnnouncement) || fileSettings.flash_message || DEFAULT_CONFIG.flashAnnouncement;
    const flashAct = (settings && settings.flashActive !== undefined) ? settings.flashActive : (fileSettings.flash_active === 'YES' || fileSettings.flash_active === true);
    const regStat = (settings && settings.registrationStatus) || fileSettings.registration_status || DEFAULT_CONFIG.registrationStatus;
    const upi = (settings && settings.upiId) || fileSettings.upi_id || DEFAULT_CONFIG.upiId;
    const upiName = (settings && settings.upiPayeeName) || fileSettings.upi_name || DEFAULT_CONFIG.upiPayeeName;
    const upiQr = (settings && settings.upiQrUrl) || fileSettings.upi_qr_url || DEFAULT_CONFIG.upiQrUrl;

    let cats = DEFAULT_CONFIG.categories;
    if (settings && settings.categories && settings.categories.length) {
      cats = settings.categories.filter(c => c.active !== false);
    } else if (fileSettings && fileSettings.categories && fileSettings.categories.length) {
      cats = fileSettings.categories.map(c => ({
        code: (c.name || '').toUpperCase().replace(/\s+/g, '_'),
        name: c.name,
        type: 'Doubles',
        entryFee: Number(c.fee) || 500,
        maxAge: (c.name || '').includes('Below') ? 35 : 100,
        minAge: (c.name || '').includes('Above') ? 35 : 15,
        maxSlots: Number(c.maxPairs) || 32,
        active: (c.status !== 'INACTIVE')
      }));
    }

    const publicData = {
      tournamentName: tName,
      subtitle: sub,
      dates: dates,
      venue: venue,
      courtMapsUrl: (settings && settings.courtMapsUrl) || DEFAULT_CONFIG.courtMapsUrl,
      registrationStatus: regStat,
      registrationCloseDate: (settings && settings.registrationCloseDate) || DEFAULT_CONFIG.registrationCloseDate,
      flashAnnouncement: flashMsg,
      flashActive: flashAct,
      upiId: upi,
      upiPayeeName: upiName,
      upiQrUrl: upiQr,
      logoUrl: (settings && settings.logoUrl) || DEFAULT_CONFIG.logoUrl,
      contactPersons: (settings && settings.contactPersons && settings.contactPersons.length) ? settings.contactPersons : DEFAULT_CONFIG.contactPersons,
      rules: (settings && settings.rules && settings.rules.length) ? settings.rules : DEFAULT_CONFIG.rules,
      categories: cats
    };

    return res.json({ success: true, config: publicData });
  } catch (err) {
    return res.json({ success: true, config: DEFAULT_CONFIG });
  }
});

// Admin: Get Full Settings (Protected)
router.get('/', requireAdmin, async (req, res) => {
  try {
    let settings = null;
    if (mongoose.connection.readyState === 1) {
      settings = await Settings.findOne();
      if (!settings) settings = await Settings.create({});
    }
    if (!settings) {
      settings = dataStore.getSettings();
    }
    return res.json({ success: true, settings });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Update Settings (Protected)
router.put('/', requireAdmin, async (req, res) => {
  try {
    const updateData = req.body.settings || req.body;
    updateData.updatedAt = new Date();

    // Sync with persistent dataStore
    dataStore.saveSettings(updateData);

    let settings = null;
    if (mongoose.connection.readyState === 1) {
      settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings(updateData);
      } else {
        Object.assign(settings, updateData);
      }
      await settings.save();
    }

    // Broadcast socket event
    try {
      const io = req.app.get('io');
      if (io) io.emit('settings_update', updateData);
    } catch (e) {}

    return res.json({ success: true, message: 'Settings saved successfully', settings: settings || updateData });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
