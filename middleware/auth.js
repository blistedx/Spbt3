const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const dataStore = require('../config/dataStore');

const JWT_SECRET = process.env.JWT_SECRET || 'sp_badminton_secret_key_2026_super_secure';

async function getAuthPins() {
  let adminPin = process.env.DEFAULT_ADMIN_PIN || '9903';
  let scorerPin = process.env.DEFAULT_SCORER_PIN || '123499';

  try {
    const fileSettings = dataStore.getSettings();
    if (fileSettings && fileSettings.admin_pin) adminPin = fileSettings.admin_pin;
    if (fileSettings && fileSettings.scorer_pin) scorerPin = fileSettings.scorer_pin;
  } catch (e) {}

  try {
    if (mongoose.connection.readyState === 1) {
      const doc = await Settings.findOne().lean();
      if (doc) {
        if (doc.adminPin) adminPin = doc.adminPin;
        if (doc.scorerPin) scorerPin = doc.scorerPin;
      }
    }
  } catch (e) {}

  return { adminPin, scorerPin };
}

async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const pinHeader = req.headers['x-admin-pin'] || (req.body && (req.body.pin || req.body.adminPin)) || (req.query && (req.query.pin || req.query.adminPin));

    // Check JWT token first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'admin') {
          req.user = decoded;
          return next();
        }
      } catch (err) {
        // Fall through to PIN check
      }
    }

    // Check PIN against database settings / dataStore / env
    const { adminPin } = await getAuthPins();

    if (pinHeader && pinHeader.toString() === adminPin.toString()) {
      req.user = { role: 'admin', username: 'admin' };
      return next();
    }

    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN or Token' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function requireScorerOrAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const pinHeader = req.headers['x-scorer-pin'] || req.headers['x-admin-pin'] || (req.body && (req.body.pin || req.body.scorerPin)) || (req.query && (req.query.pin || req.query.scorerPin));

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'admin' || decoded.role === 'scorer') {
          req.user = decoded;
          return next();
        }
      } catch (err) {}
    }

    const { adminPin, scorerPin } = await getAuthPins();

    if (pinHeader && (pinHeader.toString() === scorerPin.toString() || pinHeader.toString() === adminPin.toString())) {
      req.user = { role: 'scorer', username: 'scorer' };
      return next();
    }

    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Scorer or Admin PIN' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { requireAdmin, requireScorerOrAdmin };
