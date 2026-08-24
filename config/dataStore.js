const fs = require('fs');
const path = require('path');

const BUNDLED_DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'sp3_data')
  : BUNDLED_DATA_DIR;

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[DataStore] Could not create DATA_DIR:', e.message);
}

// File paths
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const FINANCIALS_FILE = path.join(DATA_DIR, 'financials.json');
const LIVE_MATCH_FILE = path.join(DATA_DIR, 'liveMatch.json');

// Default initial states
const DEFAULT_SETTINGS = {
  tournament_name: "S.P. BADMINTON TOURNEY 3",
  tournament_subtitle: "Men's Doubles · Knockout · Suryodaya Park",
  venue: "Suryodaya Park Court",
  dates: "28–30 Aug 2026",
  flash_message: "Registrations are OPEN! Limited team slots available.",
  flash_active: "NO",
  registration_status: "OPEN",
  admin_pin: "9903",
  upi_id: "blistedx@okhdfcbank",
  upi_name: "S.P. Badminton Club",
  upi_qr_url: "qr_code.png",
  entry_fee: "500",
  stat_categories: "02",
  stat_players: "50+",
  stat_days: "03",
  categories: [
    { name: "Below 35", status: "ACTIVE", fee: "500", maxPairs: "32" },
    { name: "Above 35", status: "ACTIVE", fee: "500", maxPairs: "32" }
  ]
};

const DEFAULT_LIVE_MATCH = {
  matchId: 'Court 1',
  p1Name: '',
  p2Name: '',
  category: 'Below 35',
  targetPoints: 21,
  score: '0-0',
  status: 'NO_LIVE_MATCH',
  isLive: false,
  isComplete: true,
  server: 1,
  currentGame: 0,
  games: [[0, 0], [0, 0], [0, 0]],
  setsWon: [0, 0],
  interval: { active: false, secondsLeft: 0, intervalTakenForGame: [false, false, false] },
  rallyLog: [],
  updatedAt: Date.now()
};

const DEFAULT_FINANCIALS = {
  expenses: [
    { id: 'EXP-101', date: '2026-08-20', category: 'Shuttlecocks', item: 'Yonex AS-30 Feather Shuttles (10 Tubes)', amount: 18500, paidTo: 'Yonex Pro Shop', paymentMode: 'UPI', status: 'PAID' },
    { id: 'EXP-102', date: '2026-08-21', category: 'Trophies & Medals', item: 'Championship Trophies & Custom Medals', amount: 14000, paidTo: 'Apex Awards', paymentMode: 'UPI', status: 'PAID' },
    { id: 'EXP-103', date: '2026-08-21', category: 'Court Setup', item: 'Synthetic Mat Arena & Lighting', amount: 25000, paidTo: 'SP Sports Complex', paymentMode: 'Bank Transfer', status: 'PAID' }
  ],
  sponsors: [
    { id: 'SPON-101', name: 'Sunrise Sports / Yonex', tier: 'Title Sponsor', contact: '9810332822', promisedAmount: 50000, receivedAmount: 50000, paymentMode: 'Bank Transfer', status: 'RECEIVED' },
    { id: 'SPON-102', name: 'Gatorade India', tier: 'Hydration Partner', contact: '9811568855', promisedAmount: 20000, receivedAmount: 20000, paymentMode: 'UPI', status: 'RECEIVED' }
  ]
};

// Safe JSON file helpers
function readJson(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    }
    const bundledFile = path.join(BUNDLED_DATA_DIR, path.basename(filePath));
    if (bundledFile !== filePath && fs.existsSync(bundledFile)) {
      const raw = fs.readFileSync(bundledFile, 'utf8');
      if (raw && raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.warn(`[DataStore] Error reading ${filePath}:`, err.message);
  }
  return defaultValue;
}

function writeJson(filePath, data) {
  try {
    const tempFile = `${filePath}.tmp_${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, filePath);
    return true;
  } catch (err) {
    console.error(`[DataStore] Error writing ${filePath}:`, err.message);
    return false;
  }
}

// In-memory state cache initialized from disk
let settingsCache = readJson(SETTINGS_FILE, DEFAULT_SETTINGS);
let registrationsCache = readJson(REGISTRATIONS_FILE, []);
let matchesCache = readJson(MATCHES_FILE, []);
let financialsCache = readJson(FINANCIALS_FILE, DEFAULT_FINANCIALS);
let liveMatchCache = readJson(LIVE_MATCH_FILE, DEFAULT_LIVE_MATCH);

// Ensure initial files exist on disk
if (!fs.existsSync(SETTINGS_FILE)) writeJson(SETTINGS_FILE, settingsCache);
if (!fs.existsSync(REGISTRATIONS_FILE)) writeJson(REGISTRATIONS_FILE, registrationsCache);
if (!fs.existsSync(MATCHES_FILE)) writeJson(MATCHES_FILE, matchesCache);
if (!fs.existsSync(FINANCIALS_FILE)) writeJson(FINANCIALS_FILE, financialsCache);
if (!fs.existsSync(LIVE_MATCH_FILE)) writeJson(LIVE_MATCH_FILE, liveMatchCache);

const dataStore = {
  // SETTINGS
  getSettings() {
    return { ...settingsCache };
  },
  saveSettings(newSettings) {
    settingsCache = {
      ...settingsCache,
      ...newSettings
    };
    writeJson(SETTINGS_FILE, settingsCache);
    return { ...settingsCache };
  },

  // REGISTRATIONS
  getRegistrations() {
    return [...registrationsCache];
  },
  saveRegistrations(regs) {
    registrationsCache = Array.isArray(regs) ? regs : [];
    writeJson(REGISTRATIONS_FILE, registrationsCache);
    return [...registrationsCache];
  },
  addOrUpdateRegistration(reg) {
    const idx = registrationsCache.findIndex(r => r.regId === reg.regId);
    if (idx >= 0) {
      registrationsCache[idx] = { ...registrationsCache[idx], ...reg, updatedAt: new Date().toISOString() };
    } else {
      registrationsCache.unshift({ ...reg, createdAt: reg.createdAt || new Date().toISOString() });
    }
    writeJson(REGISTRATIONS_FILE, registrationsCache);
    return reg;
  },
  updateRegistrationStatus(regId, newStatus, adminNotes) {
    const reg = registrationsCache.find(r => r.regId === regId);
    if (reg) {
      reg.status = newStatus;
      if (adminNotes !== undefined) reg.adminNotes = adminNotes;
      reg.updatedAt = new Date().toISOString();
      writeJson(REGISTRATIONS_FILE, registrationsCache);
      return reg;
    }
    return null;
  },
  deleteRegistration(regId) {
    registrationsCache = registrationsCache.filter(r => r.regId !== regId);
    writeJson(REGISTRATIONS_FILE, registrationsCache);
    return true;
  },

  // MATCHES & SCHEDULE
  getMatches() {
    return [...matchesCache];
  },
  saveMatches(matches) {
    matchesCache = Array.isArray(matches) ? matches : [];
    writeJson(MATCHES_FILE, matchesCache);
    return [...matchesCache];
  },
  addOrUpdateMatch(match) {
    const matchId = match.matchId || match.id;
    const idx = matchesCache.findIndex(m => (m.matchId === matchId || m.id === matchId));
    if (idx >= 0) {
      matchesCache[idx] = { ...matchesCache[idx], ...match, updatedAt: new Date().toISOString() };
    } else {
      matchesCache.push({ ...match, matchId: matchId || `M-${100 + matchesCache.length + 1}`, updatedAt: new Date().toISOString() });
    }
    writeJson(MATCHES_FILE, matchesCache);
    return match;
  },
  deleteMatch(matchId) {
    matchesCache = matchesCache.filter(m => m.matchId !== matchId && m.id !== matchId);
    writeJson(MATCHES_FILE, matchesCache);
    return true;
  },

  // LIVE MATCH
  getLiveMatch() {
    return { ...liveMatchCache };
  },
  saveLiveMatch(payload) {
    liveMatchCache = {
      ...liveMatchCache,
      ...payload,
      updatedAt: Date.now()
    };
    writeJson(LIVE_MATCH_FILE, liveMatchCache);
    return { ...liveMatchCache };
  },

  // FINANCIALS
  getFinancials() {
    return {
      expenses: [...(financialsCache.expenses || [])],
      sponsors: [...(financialsCache.sponsors || [])]
    };
  },
  saveExpense(expense) {
    if (!financialsCache.expenses) financialsCache.expenses = [];
    const id = expense.id || `EXP-${Date.now().toString().slice(-4)}`;
    const newExp = { ...expense, id };
    const idx = financialsCache.expenses.findIndex(e => e.id === id);
    if (idx >= 0) {
      financialsCache.expenses[idx] = newExp;
    } else {
      financialsCache.expenses.unshift(newExp);
    }
    writeJson(FINANCIALS_FILE, financialsCache);
    return newExp;
  },
  deleteExpense(expId) {
    if (!financialsCache.expenses) return false;
    financialsCache.expenses = financialsCache.expenses.filter(e => e.id !== expId);
    writeJson(FINANCIALS_FILE, financialsCache);
    return true;
  },
  saveSponsor(sponsor) {
    if (!financialsCache.sponsors) financialsCache.sponsors = [];
    const id = sponsor.id || `SPON-${Date.now().toString().slice(-4)}`;
    const newSpon = { ...sponsor, id };
    const idx = financialsCache.sponsors.findIndex(s => s.id === id);
    if (idx >= 0) {
      financialsCache.sponsors[idx] = newSpon;
    } else {
      financialsCache.sponsors.unshift(newSpon);
    }
    writeJson(FINANCIALS_FILE, financialsCache);
    return newSpon;
  },
  deleteSponsor(sponId) {
    if (!financialsCache.sponsors) return false;
    financialsCache.sponsors = financialsCache.sponsors.filter(s => s.id !== sponId);
    writeJson(FINANCIALS_FILE, financialsCache);
    return true;
  }
};

module.exports = dataStore;
