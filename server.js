require('dotenv').config();
const http = require('http');
const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);
const { Server } = require('socket.io');

const { initPostgres, query } = require('./config/postgres');
const { setupScoreSocket } = require('./sockets/scoreSocket');
const dataStore = require('./config/dataStore');
const emailService = require('./services/emailService');

// Active TV Presence Memory Cache
const globalTvScreens = new Map();

// Route Handlers
const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const matchRoutes = require('./routes/matchRoutes');
const financialRoutes = require('./routes/financialRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  pingInterval: 8000,
  pingTimeout: 4000,
  perMessageDeflate: false,
  transports: ['websocket', 'polling']
});

// Compression & Performance Middleware
let compression;
try {
  compression = require('compression');
} catch (e) {}

// Middleware
if (compression) {
  app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));
}
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.text({ type: '*/*', limit: '50mb' }));
app.use((req, res, next) => {
  if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {}
  }
  next();
});

// Attach Socket.io to Express App
app.set('io', io);
setupScoreSocket(io);

// Static Asset Directories with Browser Caching
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (/\.(png|jpg|jpeg|gif|ico|svg|webp)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// Database middleware (Neon PostgreSQL online connection pool)
app.use(async (req, res, next) => {
  next();
});


app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/config', settingsRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/financials', financialRoutes);

// Helper: Custom Reg ID Generator
async function generateUniqueRegId(p1Phone, p1Dob) {
  const phoneDigits = (p1Phone || '').toString().replace(/\D/g, '');
  const last2Phone = phoneDigits.length >= 2 ? phoneDigits.slice(-2) : phoneDigits.padStart(2, '0');

  let last2Dob = '90';
  const dobStr = (p1Dob || '').toString();
  const yearMatch = dobStr.match(/(?:19|20)\d{2}/);
  if (yearMatch) {
    last2Dob = yearMatch[0].slice(-2);
  } else {
    const anyDigits = dobStr.replace(/\D/g, '');
    if (anyDigits.length >= 4) last2Dob = anyDigits.slice(-2);
    else if (anyDigits.length >= 2) last2Dob = anyDigits.slice(-2);
  }

  const baseId = `SP3-${last2Phone}${last2Dob}`;
  let candidate = baseId;
  let suffixCode = 65;

  const existingRegs = dataStore.getRegistrations();
  while (existingRegs.some(r => r.regId === candidate)) {
    candidate = `${baseId}${String.fromCharCode(suffixCode)}`;
    suffixCode++;
    if (suffixCode > 90) {
      candidate = `${baseId}-${Math.floor(10 + Math.random() * 90)}`;
      break;
    }
  }

  return candidate;
}

let globalSettingsState = dataStore.getSettings();
let globalLiveMatchState = dataStore.getLiveMatch();

async function getMergedSettings() {
  return dataStore.getSettings();
}

// Universal Compatibility Bridge for Action-based Query & POST Requests
async function handleActionBridge(req, res, next) {
  const action = req.query.action || (req.body && req.body.action);
  const pin = req.query.pin || (req.body && (req.body.pin || req.body.adminPin));

  if (!action && req.method === 'POST' && (req.body.p1Name || req.body.player1Name)) {
    // Implicit registration POST
    return processLegacyRegistration(req.body, res);
  }

  if (!action) return next();

  try {
    const currentSettings = await getMergedSettings();
    const validAdminPin = (currentSettings && currentSettings.admin_pin) || process.env.DEFAULT_ADMIN_PIN || '9903';

    switch (action) {
      case 'getPublicConfig':
      case 'getConfig':
      case 'getCategories':
      case 'getSettings': {
        const flashActiveVal = (currentSettings.flash_active === 'YES' || currentSettings.flash_active === true) ? 'YES' : 'NO';
        return res.json({
          success: true,
          settings: {
            tournament_name: currentSettings.tournament_name || "S.P. BADMINTON TOURNEY 3",
            tournament_subtitle: currentSettings.tournament_subtitle || "Men's Doubles · Knockout · Suryodaya Park",
            venue: currentSettings.venue || "Suryodaya Park Court",
            dates: currentSettings.dates || "28–30 Aug 2026",
            flash_message: currentSettings.flash_message || "Registrations are OPEN! Limited team slots available.",
            flash_active: flashActiveVal,
            registration_status: currentSettings.registration_status || "OPEN",
            upi_id: currentSettings.upi_id || "blistedx@okhdfcbank",
            upi_name: currentSettings.upi_name || "S.P. Badminton Club",
            upi_qr_url: currentSettings.upi_qr_url || "qr_code.png",
            entry_fee: currentSettings.entry_fee || "500",
            stat_categories: currentSettings.stat_categories || "02",
            stat_players: currentSettings.stat_players || "50+",
            stat_days: currentSettings.stat_days || "03"
          },
          categories: currentSettings.categories || [
            { name: "Below 35", status: "ACTIVE", fee: "500", maxPairs: "32" },
            { name: "Above 35", status: "ACTIVE", fee: "500", maxPairs: "32" }
          ],
          config: {
            tournamentName: currentSettings.tournament_name || "S.P. BADMINTON TOURNEY 3",
            subtitle: currentSettings.tournament_subtitle || "Men's Doubles · Knockout · Suryodaya Park",
            dates: currentSettings.dates || "28–30 Aug 2026",
            venue: currentSettings.venue || "Suryodaya Park Court",
            flashAnnouncement: currentSettings.flash_message || "Registrations are OPEN! Limited team slots available.",
            flashActive: flashActiveVal === 'YES',
            registrationStatus: currentSettings.registration_status || "OPEN"
          }
        });
      }

      case 'checkDuplicate': {
        const p1Mobile = (req.query.p1Mobile || (req.body && req.body.p1Mobile) || '').trim();
        const p1Email = (req.query.p1Email || (req.body && req.body.p1Email) || '').trim().toLowerCase();
        const p2Mobile = (req.query.p2Mobile || (req.body && req.body.p2Mobile) || '').trim();

        let existing = null;
        try {
          if (mongoose.connection.readyState === 1) {
            const orConditions = [];
            if (p1Mobile) orConditions.push({ p1Phone: p1Mobile }, { p2Phone: p1Mobile });
            if (p1Email) orConditions.push({ p1Email: p1Email }, { p2Email: p1Email });
            if (p2Mobile) orConditions.push({ p1Phone: p2Mobile }, { p2Phone: p2Mobile });
            if (orConditions.length > 0) {
              existing = await Registration.findOne({ $or: orConditions }).lean();
            }
          }
        } catch (e) {}

        if (!existing) {
          const allRegs = dataStore.getRegistrations();
          existing = allRegs.find(r => {
            if (p1Mobile && (r.p1Phone === p1Mobile || r.player1Phone === p1Mobile || r.p2Phone === p1Mobile || r.player2Phone === p1Mobile)) return true;
            if (p1Email && ((r.p1Email && r.p1Email.toLowerCase() === p1Email) || (r.player1Email && r.player1Email.toLowerCase() === p1Email))) return true;
            if (p2Mobile && (r.p1Phone === p2Mobile || r.player1Phone === p2Mobile || r.p2Phone === p2Mobile || r.player2Phone === p2Mobile)) return true;
            return false;
          });
        }

        if (existing) {
          let field = 'Contact details';
          const p1P = existing.p1Phone || existing.player1Phone;
          const p2P = existing.p2Phone || existing.player2Phone;
          const p1E = existing.p1Email || existing.player1Email;
          if (p1Mobile && (p1P === p1Mobile || p2P === p1Mobile)) field = `Mobile (${p1Mobile})`;
          else if (p1Email && (p1E && p1E.toLowerCase() === p1Email)) field = `Email (${p1Email})`;
          else if (p2Mobile && (p1P === p2Mobile || p2P === p2Mobile)) field = `Partner Mobile (${p2Mobile})`;

          return res.json({ success: true, isDuplicate: true, field, message: `Duplicate registration found: ${field}` });
        }
        return res.json({ success: true, isDuplicate: false });
      }

      case 'register':
      case 'submitRegistration': {
        return processLegacyRegistration(req.body, res);
      }

      case 'checkStatus': {
        const q = (req.query.query || (req.body && req.body.query) || '').trim();
        const cleanQ = q.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const digitsOnly = q.replace(/\D/g, '');
        let reg = null;

        try {
          if (mongoose.connection.readyState === 1 && q) {
            const orConditions = [
              { regId: new RegExp(`^${q}$`, 'i') },
              { regId: new RegExp(cleanQ, 'i') },
              { p1Phone: q },
              { p2Phone: q },
              { p1Email: q.toLowerCase() },
              { p2Email: q.toLowerCase() }
            ];
            if (digitsOnly.length >= 4) {
              orConditions.push({ p1Phone: new RegExp(digitsOnly + '$') });
              orConditions.push({ p2Phone: new RegExp(digitsOnly + '$') });
              orConditions.push({ regId: new RegExp(digitsOnly + '$') });
            }
            reg = await Registration.findOne({ $or: orConditions }).lean();
          }
        } catch (e) {}

        if (!reg) {
          const allRegs = dataStore.getRegistrations();
          reg = allRegs.find(r => {
            const rId = (r.regId || '').toLowerCase();
            const rIdClean = (r.regId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const qLow = q.toLowerCase();
            const p1P = (r.p1Phone || r.player1Phone || '').replace(/\D/g, '');
            const p2P = (r.p2Phone || r.player2Phone || '').replace(/\D/g, '');

            return rId === qLow ||
              rIdClean === cleanQ ||
              (cleanQ && rIdClean.includes(cleanQ)) ||
              (digitsOnly && digitsOnly.length >= 4 && (rIdClean.includes(digitsOnly) || p1P.includes(digitsOnly) || p2P.includes(digitsOnly))) ||
              (r.p1Phone && r.p1Phone.includes(q)) ||
              (r.player1Phone && r.player1Phone.includes(q)) ||
              (r.p2Phone && r.p2Phone.includes(q)) ||
              (r.player2Phone && r.player2Phone.includes(q)) ||
              (r.p1Email && r.p1Email.toLowerCase() === qLow) ||
              (r.player1Email && r.player1Email.toLowerCase() === qLow);
          });
        }

        if (!reg) return res.json({ success: false, found: false, notFound: true, message: `No registration found matching "${q}". Please check again.` });
        
        const p1P = reg.p1Phone || reg.player1Phone || '';
        const maskedPhone = p1P.length >= 4 ? p1P.slice(0, 2) + '******' + p1P.slice(-2) : p1P;
        const p2P = reg.p2Phone || reg.player2Phone || '';
        const maskedPhone2 = p2P.length >= 4 ? p2P.slice(0, 2) + '******' + p2P.slice(-2) : p2P;
        
        return res.json({
          success: true,
          found: true,
          registration: {
            regId: reg.regId,
            category: reg.category || 'Below 35',
            categoryName: reg.categoryName || reg.category || 'Below 35',
            p1Name: reg.p1Name || reg.player1Name,
            player1Name: reg.p1Name || reg.player1Name,
            p1Phone: maskedPhone,
            player1Phone: maskedPhone,
            p2Name: reg.p2Name || reg.player2Name,
            player2Name: reg.p2Name || reg.player2Name,
            p2Phone: maskedPhone2,
            player2Phone: maskedPhone2,
            status: reg.status || 'Pending',
            paymentAmount: reg.paymentAmount || 1000,
            fee: reg.paymentAmount || 1000,
            amount: reg.paymentAmount || 1000,
            upiUtr: reg.paymentUtr || reg.upiUtr || 'N/A',
            timestamp: reg.createdAt ? new Date(reg.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : (reg.timestamp || 'Recent'),
            createdAt: reg.createdAt,
            rejectionReason: reg.rejectionReason || ''
          }
        });
      }

      case 'adminGetRegistrations':
      case 'getRegistrations': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        let list = dataStore.getRegistrations();
        try {
          if (mongoose.connection.readyState === 1) {
            const dbRegs = await Registration.find().sort({ createdAt: -1 }).lean();
            if (dbRegs && dbRegs.length > 0) {
              list = dbRegs.map(r => ({
                regId: r.regId,
                category: r.category,
                categoryName: r.categoryName || r.category,
                player1Name: r.p1Name,
                player1Phone: r.p1Phone,
                player1Email: r.p1Email,
                player1Dob: r.p1Dob,
                player1Age: r.p1Age,
                player1Tshirt: r.p1Tshirt,
                player2Name: r.p2Name,
                player2Phone: r.p2Phone,
                player2Email: r.p2Email,
                player2Dob: r.p2Dob,
                player2Age: r.p2Age,
                player2Tshirt: r.p2Tshirt,
                receiptUrl: r.paymentScreenshotUrl,
                upiUtr: r.paymentUtr,
                status: r.status,
                rejectionReason: r.rejectionReason,
                adminNotes: r.adminNotes,
                createdAt: r.createdAt,
                timestamp: r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''
              }));
            }
          }
        } catch (e) {}
        return res.json({ success: true, registrations: list });
      }

      case 'adminUpdateStatus':
      case 'updateRegistrationStatus': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const regId = req.body.regId || req.query.regId;
        const newStatus = req.body.newStatus || req.body.status || req.query.newStatus;
        const adminNotes = req.body.adminNotes || req.body.rejectionReason || '';
        const updatedReg = dataStore.updateRegistrationStatus(regId, newStatus, adminNotes);
        let dbDoc = null;
        try {
          if (mongoose.connection.readyState === 1) {
            dbDoc = await Registration.findOneAndUpdate({ regId }, { status: newStatus, rejectionReason: adminNotes, adminNotes, updatedAt: new Date() }, { new: true });
          }
        } catch (e) {}

        const finalReg = dbDoc || updatedReg;
        if ((newStatus || '').toUpperCase() === 'APPROVED' && finalReg) {
          emailService.sendPlayerApprovalEmail(finalReg).catch(err => console.warn('Email approval send error:', err.message));
        }

        return res.json({ success: true, message: `Status updated to ${newStatus}`, registration: finalReg });
      }

      case 'adminUpdateRegistration':
      case 'updateRegistration': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const regId = req.body.regId || req.query.regId;
        if (!regId) {
          return res.status(400).json({ success: false, error: 'Registration ID is required.' });
        }

        const p1Name = (req.body.player1Name || req.body.p1Name || '').trim();
        const p1Phone = (req.body.player1Phone || req.body.p1Phone || '').trim();
        const p1Email = (req.body.player1Email || req.body.p1Email || '').trim().toLowerCase();
        const p1Dob = req.body.player1Dob || req.body.p1Dob;
        const p1Age = req.body.player1Age !== undefined ? req.body.player1Age : req.body.p1Age;
        const p1Tshirt = req.body.player1Tshirt || req.body.p1Tshirt;
        const p1BloodGroup = req.body.player1BloodGroup || req.body.p1BloodGroup || '';

        const p2Name = (req.body.player2Name || req.body.p2Name || '').trim();
        const p2Phone = (req.body.player2Phone || req.body.p2Phone || '').trim();
        const p2Email = (req.body.player2Email || req.body.p2Email || '').trim().toLowerCase();
        const p2Dob = req.body.player2Dob || req.body.p2Dob;
        const p2Age = req.body.player2Age !== undefined ? req.body.player2Age : req.body.p2Age;
        const p2Tshirt = req.body.player2Tshirt || req.body.p2Tshirt;
        const p2BloodGroup = req.body.player2BloodGroup || req.body.p2BloodGroup || '';

        const category = req.body.category || 'Below 35';
        const categoryName = req.body.categoryName || category;
        const paymentAmount = Number(req.body.paymentAmount || req.body.fee) || 1000;
        const upiUtr = (req.body.upiUtr || req.body.paymentUtr || '').trim();
        const status = req.body.status || 'Pending';
        const adminNotes = req.body.adminNotes !== undefined ? req.body.adminNotes : (req.body.rejectionReason || '');

        const updateFields = {
          regId,
          category,
          categoryName,
          p1Name,
          player1Name: p1Name,
          p1Phone,
          player1Phone: p1Phone,
          p1Email,
          player1Email: p1Email,
          p1Dob,
          player1Dob: p1Dob,
          p1Age,
          player1Age: p1Age,
          p1Tshirt,
          player1Tshirt: p1Tshirt,
          p1BloodGroup,
          p2Name,
          player2Name: p2Name,
          p2Phone,
          player2Phone: p2Phone,
          p2Email,
          player2Email: p2Email,
          p2Dob,
          player2Dob: p2Dob,
          p2Age,
          player2Age: p2Age,
          p2Tshirt,
          player2Tshirt: p2Tshirt,
          p2BloodGroup,
          paymentAmount,
          paymentUtr: upiUtr,
          upiUtr,
          status,
          adminNotes,
          rejectionReason: adminNotes,
          updatedAt: new Date().toISOString()
        };

        dataStore.addOrUpdateRegistration(updateFields);

        let dbDoc = null;
        try {
          if (mongoose.connection.readyState === 1) {
            dbDoc = await Registration.findOneAndUpdate(
              { regId },
              { $set: updateFields },
              { new: true }
            );
          }
        } catch (e) {
          console.warn('DB update error:', e.message);
        }

        return res.json({
          success: true,
          message: `Registration ${regId} updated successfully.`,
          registration: dbDoc || updateFields
        });
      }

      case 'adminDeleteRegistration':
      case 'deleteRegistration': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const regId = req.body.regId || req.query.regId || req.body.id;
        if (!regId) {
          return res.status(400).json({ success: false, error: 'Registration ID is required.' });
        }
        dataStore.deleteRegistration(regId);
        try {
          if (mongoose.connection.readyState === 1) {
            await Registration.findOneAndDelete({ regId });
          }
        } catch (e) {}
        return res.json({ success: true, message: `Registration ${regId} deleted successfully.` });
      }

      case 'adminGetSettings':
      case 'getTournamentSettings': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const flashActiveVal = (currentSettings.flash_active === 'YES' || currentSettings.flash_active === true) ? 'YES' : 'NO';
        return res.json({
          success: true,
          settings: {
            tournament_name: currentSettings.tournament_name || "S.P. BADMINTON TOURNEY 3",
            tournament_subtitle: currentSettings.tournament_subtitle || "Men's Doubles · Knockout · Suryodaya Park",
            venue: currentSettings.venue || "Suryodaya Park Court",
            dates: currentSettings.dates || "28–30 Aug 2026",
            flash_message: currentSettings.flash_message || "Registrations are OPEN! Limited team slots available.",
            flash_active: flashActiveVal,
            registration_status: currentSettings.registration_status || "OPEN",
            admin_pin: currentSettings.admin_pin || "9903",
            upi_id: currentSettings.upi_id || "blistedx@okhdfcbank",
            upi_name: currentSettings.upi_name || "S.P. Badminton Club",
            upi_qr_url: currentSettings.upi_qr_url || "qr_code.png",
            entry_fee: currentSettings.entry_fee || "500",
            stat_categories: currentSettings.stat_categories || "02",
            stat_players: currentSettings.stat_players || "50+",
            stat_days: currentSettings.stat_days || "03"
          },
          categories: currentSettings.categories || [
            { name: "Below 35", status: "ACTIVE", fee: "500", maxPairs: "32" },
            { name: "Above 35", status: "ACTIVE", fee: "500", maxPairs: "32" }
          ]
        });
      }

      case 'adminUpdateSettings':
      case 'updateTournamentSettings': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const incoming = req.body.settings || req.body;
        const rawSettings = incoming.settings || incoming;
        const rawCats = incoming.categories || incoming.settings?.categories || currentSettings.categories;

        // Parse flash active clearly
        let newFlashActive = 'NO';
        const inActive = rawSettings.flash_active !== undefined ? rawSettings.flash_active : (rawSettings.flashActive !== undefined ? rawSettings.flashActive : currentSettings.flash_active);
        if (inActive === 'YES' || inActive === true || inActive === 'yes' || inActive === 'true') {
          newFlashActive = 'YES';
        } else {
          newFlashActive = 'NO';
        }

        // Handle uploaded QR code if base64 provided
        let upiQrUrl = rawSettings.upi_qr_url || currentSettings.upi_qr_url || 'qr_code.png';
        if (rawSettings.qr_base64) {
          const b64 = rawSettings.qr_base64.replace(/^data:image\/\w+;base64,/, '');
          const filename = `qr_${Date.now()}_${Math.round(Math.random() * 1e4)}.png`;
          const uploadDir = path.join(__dirname, 'uploads');
          try {
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            fs.writeFileSync(path.join(uploadDir, filename), b64, 'base64');
            upiQrUrl = `/uploads/${filename}`;
            rawSettings.upi_qr_url = upiQrUrl;
          } catch (err) {
            console.warn('QR code write error:', err.message);
          }
        }

        const updatedSettings = {
          ...currentSettings,
          ...rawSettings,
          upi_qr_url: upiQrUrl,
          flash_active: newFlashActive,
          flashActive: (newFlashActive === 'YES'),
          categories: rawCats || currentSettings.categories
        };

        // Save to persistent file storage
        dataStore.saveSettings(updatedSettings);
        globalSettingsState = updatedSettings;

        try {
          if (mongoose.connection.readyState === 1) {
            await Settings.findOneAndUpdate({}, {
              ...updatedSettings,
              tournamentName: updatedSettings.tournament_name,
              subtitle: updatedSettings.tournament_subtitle,
              venue: updatedSettings.venue,
              dates: updatedSettings.dates,
              flashAnnouncement: updatedSettings.flash_message,
              flashActive: (newFlashActive === 'YES'),
              flash_active: newFlashActive,
              registrationStatus: updatedSettings.registration_status,
              adminPin: updatedSettings.admin_pin,
              upiId: updatedSettings.upi_id,
              upiPayeeName: updatedSettings.upi_name,
              upiQrUrl: updatedSettings.upi_qr_url,
              rawSettings: updatedSettings,
              updatedAt: new Date()
            }, { upsert: true, new: true, setDefaultsOnInsert: true });
          }
        } catch (e) {
          console.warn('DB settings update fallback:', e.message);
        }

        try {
          const io = req.app.get('io');
          if (io) io.emit('settings_update', updatedSettings);
        } catch (e) {}

        return res.json({
          success: true,
          message: 'Settings saved successfully to tournament database',
          qrUrl: upiQrUrl,
          settings: updatedSettings,
          categories: updatedSettings.categories
        });
      }

      case 'getSchedule':
      case 'getMatchSchedule': {
        let list = dataStore.getMatches();
        try {
          if (mongoose.connection.readyState === 1) {
            const dbMatches = await Match.find().sort({ courtNumber: 1, matchNumber: 1 }).lean();
            if (dbMatches && dbMatches.length > 0) list = dbMatches;
          }
        } catch (e) {}
        return res.json({ success: true, schedule: list });
      }

      case 'adminSaveMatchSchedule':
      case 'saveSchedule':
      case 'adminSaveSchedule': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const scheduleData = req.body.schedule || req.body.matches || req.body.allAdminSchedule || req.body;
        const list = Array.isArray(scheduleData) ? scheduleData : (scheduleData.schedule || []);
        dataStore.saveMatches(list);
        try {
          if (mongoose.connection.readyState === 1 && list.length > 0) {
            for (const item of list) {
              const matchId = item.matchId || item.id;
              if (matchId) {
                await Match.findOneAndUpdate({ matchId }, { ...item, updatedAt: new Date() }, { upsert: true });
              }
            }
          }
        } catch (e) {}
        return res.json({ success: true, message: 'Match schedule saved successfully', schedule: list });
      }

      case 'adminDeleteScheduleMatch':
      case 'deleteScheduleMatch': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const matchId = req.body.matchId || req.body.id || req.query.matchId;
        dataStore.deleteMatch(matchId);
        try {
          if (mongoose.connection.readyState === 1 && matchId) {
            await Match.findOneAndDelete({ matchId });
          }
        } catch (e) {}
        return res.json({ success: true, message: 'Match deleted successfully', schedule: dataStore.getMatches() });
      }

      case 'getSponsors': {
        let sponsorsList = [];
        try {
          if (mongoose.connection.readyState === 1) {
            sponsorsList = await Sponsor.find().sort({ createdAt: -1 }).lean();
          }
        } catch (e) {}
        if (!sponsorsList || sponsorsList.length === 0) {
          const fileFin = dataStore.getFinancials();
          sponsorsList = fileFin.sponsors || [];
        }
        return res.json({ success: true, sponsors: sponsorsList });
      }

      case 'adminGetFinancials':
      case 'getFinancialSummary': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        let expenses = [];
        let sponsors = [];
        let approvedRegs = [];

        try {
          if (mongoose.connection.readyState === 1) {
            expenses = await Expense.find().sort({ date: -1 }).lean();
            sponsors = await Sponsor.find().sort({ createdAt: -1 }).lean();
            approvedRegs = await Registration.find({
              status: { $regex: /^approved$/i }
            }).lean();
          }
        } catch (e) {}

        if (!expenses.length && !sponsors.length) {
          const fileFin = dataStore.getFinancials();
          expenses = fileFin.expenses || [];
          sponsors = fileFin.sponsors || [];
        }
        if (!approvedRegs.length) {
          const allRegs = dataStore.getRegistrations();
          approvedRegs = allRegs.filter(r => (r.status || '').toUpperCase() === 'APPROVED');
        }

        const totalRegRevenue = approvedRegs.reduce((acc, r) => acc + (Number(r.paymentAmount) || 1000), 0);
        const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
        const totalSponsorsReceived = sponsors.reduce((acc, s) => {
          const st = (s.status || '').toUpperCase();
          const amt = Number(s.receivedAmount) || (st === 'RECEIVED' ? Number(s.amount || s.promisedAmount) : 0) || 0;
          return acc + amt;
        }, 0);
        const totalCommitted = sponsors.reduce((acc, s) => acc + (Number(s.amount || s.promisedAmount) || 0), 0);

        return res.json({
          success: true,
          summary: {
            totalRegistrationRevenue: totalRegRevenue,
            totalRegRevenue,
            approvedRegistrationsCount: approvedRegs.length,
            approvedPairsCount: approvedRegs.length,
            totalSponsorsReceived,
            totalCommittedSponsorship: totalCommitted,
            totalExpenses,
            netProfitLoss: (totalRegRevenue + totalSponsorsReceived) - totalExpenses,
            netBalance: (totalRegRevenue + totalSponsorsReceived) - totalExpenses
          },
          expenses,
          sponsors
        });
      }

      case 'saveExpense':
      case 'adminSaveExpense': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const expData = req.body.expense || req.body.expData || req.body;
        const saved = dataStore.saveExpense(expData);
        try {
          if (mongoose.connection.readyState === 1) {
            await Expense.findOneAndUpdate({ expenseId: saved.id }, {
              expenseId: saved.id,
              title: saved.item || saved.description || 'Expense',
              category: saved.category || 'Misc',
              amount: Number(saved.amount) || 0,
              paidTo: saved.paidTo || '',
              paidBy: saved.paidBy || '',
              date: saved.date || new Date(),
              updatedAt: new Date()
            }, { upsert: true });
          }
        } catch (e) {}
        return res.json({ success: true, message: 'Expense saved successfully', expense: saved, financials: dataStore.getFinancials() });
      }

      case 'deleteExpense':
      case 'adminDeleteExpense': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const expId = req.body.expId || req.body.id || req.body.expenseId || req.query.expId || req.query.expenseId;
        dataStore.deleteExpense(expId);
        try {
          if (mongoose.connection.readyState === 1) {
            await Expense.findOneAndDelete({ expenseId: expId });
          }
        } catch (e) {}
        return res.json({ success: true, message: 'Expense deleted successfully', financials: dataStore.getFinancials() });
      }

      case 'saveSponsorFund':
      case 'adminSaveSponsorFund':
      case 'saveSponsor': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const sponData = req.body.sponsor || req.body.sponData || req.body;
        const saved = dataStore.saveSponsor(sponData);
        try {
          if (mongoose.connection.readyState === 1) {
            await Sponsor.findOneAndUpdate({ sponsorId: saved.id }, {
              sponsorId: saved.id,
              name: saved.name || '',
              company: saved.company || saved.name || '',
              tier: saved.tier || 'Partner',
              amount: Number(saved.promisedAmount || saved.amount) || 0,
              status: saved.status === 'RECEIVED' ? 'Received' : 'Committed',
              updatedAt: new Date()
            }, { upsert: true });
          }
        } catch (e) {}
        return res.json({ success: true, message: 'Sponsor fund saved successfully', sponsor: saved, financials: dataStore.getFinancials() });
      }

      case 'deleteSponsorFund':
      case 'adminDeleteSponsorFund':
      case 'deleteSponsor': {
        if (!pin || pin.toString() !== validAdminPin.toString()) {
          return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
        }
        const spId = req.body.spId || req.body.id || req.body.sponsorId || req.query.spId || req.query.sponsorId;
        dataStore.deleteSponsor(spId);
        try {
          if (mongoose.connection.readyState === 1) {
            await Sponsor.findOneAndDelete({ sponsorId: spId });
          }
        } catch (e) {}
        return res.json({ success: true, message: 'Sponsor deleted successfully', financials: dataStore.getFinancials() });
      }

      case 'updateLiveMatch': {
        const payload = req.body.match || req.body.payload || req.body;
        if (payload) {
          const nowMs = Date.now();
          const updatedLive = dataStore.saveLiveMatch({
            ...payload,
            updatedAt: nowMs,
            ts: nowMs
          });
          globalLiveMatchState = updatedLive;

          const mid = updatedLive.matchId || 'Court 1';
          const p1 = updatedLive.p1Name || updatedLive.player1 || updatedLive.pair1 || 'Player 1';
          const p2 = updatedLive.p2Name || updatedLive.player2 || updatedLive.pair2 || 'Player 2';
          const winnerCalculated = updatedLive.winner || updatedLive.winnerName || (updatedLive.setsWon && updatedLive.setsWon[0] > updatedLive.setsWon[1] ? p1 : (updatedLive.setsWon && updatedLive.setsWon[1] > updatedLive.setsWon[0] ? p2 : ''));

          // Synchronize to Neon PostgreSQL matches table
          dataStore.addOrUpdateMatch({
            matchId: mid,
            p1Name: p1,
            p2Name: p2,
            team1_name: p1,
            team2_name: p2,
            category: updatedLive.category || 'Below 35',
            court: updatedLive.court || 'Court 1',
            status: updatedLive.status || (updatedLive.isLive ? 'LIVE' : 'UPCOMING'),
            winner: winnerCalculated,
            scores: updatedLive.games || [],
            sets: updatedLive.setsWon || [0, 0],
            isLive: !!updatedLive.isLive,
            isComplete: !!updatedLive.isComplete,
            durationFormatted: updatedLive.durationFormatted || '',
            durationMinutes: updatedLive.durationMinutes || 0
          });

          // ⚡ Instant 0ms broadcast across all connected clients & hosts
          try {
            const io = req.app.get('io');
            if (io) {
              io.emit('score_update', updatedLive);
              io.emit('tv_score_update', updatedLive);
              io.emit('match_state', updatedLive);
              io.emit('court:update', updatedLive);
              io.emit('score_updated', { matchId: mid, match: updatedLive });
              io.to('tv_broadcast').emit('tv_score_update', updatedLive);
              io.to('court_1').emit('match_state', updatedLive);
            }
          } catch (e) {}
        }
        return res.json({ success: true, liveMatch: globalLiveMatchState || dataStore.getLiveMatch() });
      }

      case 'getAllMatchesReport': {
        const allMatches = dataStore.getMatches();
        const completed = allMatches.filter(m =>
          (m.status || '').toUpperCase() === 'COMPLETED' ||
          m.isComplete === true ||
          (m.winner && m.winner.trim() !== '')
        );

        const reports = completed.map(m => ({
          recordId: m.matchId || m.id,
          matchId: m.matchId || m.id,
          category: m.category || 'Below 35',
          round: m.round || 'Knockout',
          court: m.court || 'Court 1',
          p1Name: m.p1Name || m.pair1 || m.team1_p1 || m.team1_name || 'Team 1',
          p2Name: m.p2Name || m.pair2 || m.team2_p1 || m.team2_name || 'Team 2',
          winner: m.winner || '',
          score: m.score || '',
          games: m.scores || m.games || [],
          setsWon: m.sets || m.setsWon || [0, 0],
          durationFormatted: m.durationFormatted || (m.durationMinutes ? `${m.durationMinutes} Mins` : ''),
          completedAt: m.updatedAt || new Date().toISOString()
        }));

        return res.json({ success: true, reports });
      }

      case 'deleteMatchReport': {
        const body = req.body || {};
        const query = req.query || {};
        const recordId = body.recordId || query.recordId || body.id || query.id;
        const matchId = body.matchId || query.matchId;

        try {
          if (mongoose.connection.readyState === 1) {
            if (recordId) {
              const cond = [{ recordId: recordId }];
              if (mongoose.isValidObjectId(recordId)) cond.push({ _id: recordId });
              await MatchHistory.deleteMany({ $or: cond });
            } else if (matchId) {
              await MatchHistory.deleteMany({ matchId: matchId });
            }
          }
        } catch (delErr) {
          console.warn('Delete match report notice:', delErr.message);
        }
        return res.json({ success: true, message: 'Match record deleted from database successfully.' });
      }

      case 'clearAllMatchReports': {
        try {
          if (mongoose.connection.readyState === 1) {
            await MatchHistory.deleteMany({});
            await Match.updateMany(
              { status: { $in: ['COMPLETED', 'Completed'] } },
              { $set: { status: 'UPCOMING', isComplete: false, isLive: false, winner: '' } }
            );
          }
        } catch (clearErr) {
          console.warn('Clear all match reports notice:', clearErr.message);
        }
        return res.json({ success: true, message: 'All tournament match history cleared from database.' });
      }

      case 'tvHeartbeat': {
        const body = req.body || {};
        const query = req.query || {};
        const deviceId = body.deviceId || query.deviceId || `TV_${req.ip || 'Unknown'}`;
        const name = body.name || query.name || 'Courtside TV Screen';
        const screen = body.screen || query.screen || '1920x1080';
        const isOffline = body.status === 'OFFLINE' || query.status === 'OFFLINE';

        try {
          if (mongoose.connection.readyState === 1) {
            if (isOffline) {
              await TvPresence.deleteMany({ deviceId });
            } else {
              await TvPresence.findOneAndUpdate(
                { deviceId },
                { deviceId, name, screen, lastSeen: new Date() },
                { upsert: true, new: true }
              );
            }
          }
        } catch (e) {}

        if (isOffline) {
          globalTvScreens.delete(deviceId);
        } else {
          globalTvScreens.set(deviceId, {
            deviceId,
            name,
            screen,
            ip: req.ip || '',
            lastSeen: Date.now()
          });
        }

        let screensList = [];
        try {
          if (mongoose.connection.readyState === 1) {
            const cutoff = new Date(Date.now() - 15000);
            screensList = await TvPresence.find({ lastSeen: { $gte: cutoff } }).lean();
          }
        } catch (e) {}

        if (!screensList || screensList.length === 0) {
          const now = Date.now();
          for (const [id, dev] of globalTvScreens.entries()) {
            if (now - dev.lastSeen > 15000) globalTvScreens.delete(id);
          }
          screensList = Array.from(globalTvScreens.values());
        }

        return res.json({
          success: true,
          count: screensList.length,
          screens: screensList
        });
      }

      case 'getTvPresence': {
        let screensList = [];
        try {
          if (mongoose.connection.readyState === 1) {
            const cutoff = new Date(Date.now() - 15000);
            screensList = await TvPresence.find({ lastSeen: { $gte: cutoff } }).lean();
          }
        } catch (e) {}

        if (!screensList || screensList.length === 0) {
          const now = Date.now();
          for (const [id, dev] of globalTvScreens.entries()) {
            if (now - dev.lastSeen > 15000) globalTvScreens.delete(id);
          }
          screensList = Array.from(globalTvScreens.values());
        }

        return res.json({
          success: true,
          count: screensList.length,
          screens: screensList
        });
      }

      case 'getLiveMatch': {
        const targetMatchId = req.query.matchId || (req.body && req.body.matchId) || 'Court 1';
        const finalLive = dataStore.getLiveMatch() || globalLiveMatchState;
        return res.json({
          success: true,
          liveMatch: finalLive
        });
      }

      default:
        return next();
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function processLegacyRegistration(body, res) {
  try {
    const p1Phone = body.p1Phone || body.player1Phone;
    const p1Dob = body.p1Dob || body.player1Dob;
    const p1Name = body.p1Name || body.player1Name;
    const p1Email = body.p1Email || body.player1Email;
    const category = body.category || 'Below 35';

    if (!p1Name || !p1Phone || !p1Dob) {
      return res.status(400).json({ success: false, error: 'Please provide all mandatory player details.' });
    }

    const regId = await generateUniqueRegId(p1Phone, p1Dob);

    // Save screenshot if base64 provided
    let paymentScreenshotUrl = body.paymentScreenshotUrl || body.receiptUrl || '';
    if (body.receiptBase64 || body.receiptFileBase64) {
      const b64 = (body.receiptBase64 || body.receiptFileBase64).replace(/^data:image\/\w+;base64,/, '');
      const filename = `receipt_${Date.now()}_${Math.round(Math.random() * 1e6)}.png`;
      const uploadDir = path.join(__dirname, 'uploads', 'receipts');
      try {
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, filename), b64, 'base64');
        paymentScreenshotUrl = `/uploads/receipts/${filename}`;
      } catch (err) {
        console.warn('Screenshot write error:', err.message);
      }
    }

    const regData = {
      regId,
      category,
      categoryName: category,
      p1Name: p1Name.trim(),
      player1Name: p1Name.trim(),
      p1Phone: p1Phone.trim(),
      player1Phone: p1Phone.trim(),
      p1Email: (p1Email || '').trim().toLowerCase(),
      player1Email: (p1Email || '').trim().toLowerCase(),
      p1Dob,
      player1Dob: p1Dob,
      p1Age: body.p1Age || body.player1Age || '',
      player1Age: body.p1Age || body.player1Age || '',
      p1Tshirt: body.p1Tshirt || body.player1Tshirt || 'L',
      player1Tshirt: body.p1Tshirt || body.player1Tshirt || 'L',
      p1BloodGroup: body.p1BloodGroup || '',

      p2Name: (body.p2Name || body.player2Name || '').trim(),
      player2Name: (body.p2Name || body.player2Name || '').trim(),
      p2Phone: (body.p2Phone || body.player2Phone || '').trim(),
      player2Phone: (body.p2Phone || body.player2Phone || '').trim(),
      p2Email: (body.p2Email || body.player2Email || '').trim().toLowerCase(),
      player2Email: (body.p2Email || body.player2Email || '').trim().toLowerCase(),
      p2Dob: body.p2Dob || body.player2Dob || '',
      player2Dob: body.p2Dob || body.player2Dob || '',
      p2Age: body.p2Age || body.player2Age || '',
      player2Age: body.p2Age || body.player2Age || '',
      p2Tshirt: body.p2Tshirt || body.player2Tshirt || '',
      player2Tshirt: body.p2Tshirt || body.player2Tshirt || '',

      paymentAmount: Number(body.paymentAmount) || 1000,
      paymentUtr: (body.paymentUtr || body.upiUtr || '').trim(),
      upiUtr: (body.paymentUtr || body.upiUtr || '').trim(),
      paymentScreenshotUrl,
      receiptUrl: paymentScreenshotUrl,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    };

    // Save to PostgreSQL
    dataStore.addOrUpdateRegistration(regData);

    // Trigger automated email notifications
    emailService.sendPlayerRegistrationReceipt(regData).catch(e => console.warn('Receipt email error:', e.message));
    emailService.sendAdminRegistrationAlert(regData).catch(e => console.warn('Admin alert email error:', e.message));

    return res.json({
      success: true,
      message: 'Registration submitted successfully! Your entry is now pending admin verification.',
      regId: regData.regId,
      registration: regData
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Attach compatibility bridge
app.use('/exec', handleActionBridge);
app.use(handleActionBridge);

// Portal Page Routes
app.get('/', (req, res) => {
  const page = (req.query.page || '').toLowerCase();
  if (page === 'admin') return res.sendFile(path.join(__dirname, 'admin.html'));
  if (page === 'scorer') return res.sendFile(path.join(__dirname, 'scorer.html'));
  if (page === 'tv') return res.sendFile(path.join(__dirname, 'tv.html'));
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.get('/scorer', (req, res) => res.sendFile(path.join(__dirname, 'scorer.html')));
app.get('/scorer.html', (req, res) => res.sendFile(path.join(__dirname, 'scorer.html')));

app.get('/tv', (req, res) => res.sendFile(path.join(__dirname, 'tv.html')));
app.get('/tv.html', (req, res) => res.sendFile(path.join(__dirname, 'tv.html')));

app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/legacy', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/legacy-admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/legacy-scorer', (req, res) => res.sendFile(path.join(__dirname, 'scorer.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/privacy.html', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/terms.html', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/404', (req, res) => res.status(404).sendFile(path.join(__dirname, '404.html')));
app.get('/404.html', (req, res) => res.status(404).sendFile(path.join(__dirname, '404.html')));

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(__dirname, 'manifest.json'));
});
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'sw.js'));
});
app.get('/cookie-consent.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'cookie-consent.js'));
});
app.get('/pwa-install.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'pwa-install.js'));
});
app.get('/analytics.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'analytics.js'));
});
app.get('/social-share.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'social-share.js'));
});

app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(path.join(__dirname, 'robots.txt'));
});
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Lightweight In-Memory & PostgreSQL Analytics Event Collector
const sp3AnalyticsEvents = [];
app.post('/api/analytics/event', (req, res) => {
  try {
    const ev = req.body;
    if (ev && ev.event) {
      ev.ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      ev.receivedAt = new Date().toISOString();
      sp3AnalyticsEvents.push(ev);
      if (sp3AnalyticsEvents.length > 500) sp3AnalyticsEvents.shift();

      query(`
        INSERT INTO analytics_events (event, path, hash, referrer, session_id, screen, theme, data, ip)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        ev.event,
        ev.path || '',
        ev.hash || '',
        ev.referrer || '',
        ev.sessionId || '',
        ev.screen || '',
        ev.theme || '',
        JSON.stringify(ev.data || {}),
        ev.ip || ''
      ]).catch(() => {});
    }
    return res.status(204).end();
  } catch (e) {
    return res.status(204).end();
  }
});
app.get('/api/analytics/stats', (req, res) => {
  return res.json({
    totalTracked: sp3AnalyticsEvents.length,
    recentEvents: sp3AnalyticsEvents.slice(-50)
  });
});

app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'favicon.ico')));
app.get('/favicon.png', (req, res) => res.sendFile(path.join(__dirname, 'favicon.png')));
app.get('/apple-touch-icon.png', (req, res) => res.sendFile(path.join(__dirname, 'apple-touch-icon.png')));
app.get('/qr_code.png', (req, res) => res.sendFile(path.join(__dirname, 'qr_code.png')));
app.get('/logo.png', (req, res) => res.sendFile(path.join(__dirname, 'logo.png')));
app.get('/config.js', (req, res) => res.sendFile(path.join(__dirname, 'config.js')));
app.get('/alert-modal.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'alert-modal.js'));
});

// Health Check (Neon PostgreSQL)
app.get('/api/health', async (req, res) => {
  let dbStatus = 'Offline';
  try {
    const r = await query('SELECT 1 as alive');
    if (r.rows && r.rows[0] && r.rows[0].alive === 1) {
      dbStatus = 'Connected (Neon PostgreSQL · Online Database)';
    }
  } catch (e) {
    dbStatus = 'PostgreSQL Error: ' + e.message;
  }
  res.json({
    status: 'online',
    app: 'S.P. Badminton Tourney 3 Server',
    time: new Date().toISOString(),
    database: dbStatus
  });
});

// 404 Catch-All Handler (Badminton Themed Out-of-Bounds)
app.use((req, res) => {
  if (req.accepts('html')) {
    res.status(404).sendFile(path.join(__dirname, '404.html'));
  } else {
    res.status(404).json({ success: false, error: 'Resource not found / Out of Bounds' });
  }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  server.listen(PORT, () => {
    console.log('\n======================================================');
    console.log(`🏸  S.P. Badminton Tourney 3 · Professional Full-Stack Server`);
    console.log('======================================================');
    console.log(`🚀 Server running on: http://localhost:${PORT}`);
    console.log(`👉 🏆 Public Portal:    http://localhost:${PORT}`);
    console.log(`👉 ⚙️  Admin Portal:     http://localhost:${PORT}/admin`);
    console.log(`👉 🏸 Scorer Tablet:    http://localhost:${PORT}/scorer`);
    console.log(`👉 📺 TV Broadcast Live: http://localhost:${PORT}/tv`);
    console.log(`👉 📡 Realtime Socket:  Socket.io active on court & TV channels`);
    console.log('======================================================\n');
  });

  try {
    initPostgres().then(async () => {
      console.log('✅ Neon PostgreSQL Engine ready!');
      await dataStore.syncFromDb();
    }).catch(e => console.warn('Postgres init warning:', e.message));
  } catch (err) {
    console.warn('DB init warning:', err.message);
  }
}

if (!process.env.VERCEL) {
  startServer();
}

module.exports = app;
