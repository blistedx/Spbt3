const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Settings = require('../models/Settings');

const mongoose = require('mongoose');
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

// Login with PIN (Quick Organizer / Scorer Access)
router.post('/verify-pin', async (req, res) => {
  try {
    const { pin, role } = req.body;
    if (!pin) {
      return res.status(400).json({ success: false, error: 'PIN is required' });
    }

    const { adminPin, scorerPin } = await getAuthPins();

    if (pin.toString() === adminPin.toString()) {
      const token = jwt.sign({ role: 'admin', username: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ success: true, role: 'admin', token, message: 'Admin authentication successful' });
    }

    if (pin.toString() === scorerPin.toString() && role !== 'admin') {
      const token = jwt.sign({ role: 'scorer', username: 'scorer' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ success: true, role: 'scorer', token, message: 'Scorer authentication successful' });
    }

    return res.status(401).json({ success: false, error: 'Invalid PIN entered. Please try again.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Full Username / Password Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      success: true,
      token,
      user: { id: user._id, username: user.username, name: user.name, role: user.role }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
