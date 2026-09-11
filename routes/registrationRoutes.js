const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Settings = require('../models/Settings');
const dataStore = require('../config/dataStore');
const { requireAdmin } = require('../middleware/auth');
const emailService = require('../services/emailService');

// Ensure upload directory exists safely
const uploadDir = process.env.VERCEL ? path.join('/tmp', 'uploads', 'receipts') : path.join(__dirname, '..', 'uploads', 'receipts');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('Upload directory initialization notice:', e.message);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch (e) {
      // ignore
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanName = `receipt_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, cleanName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPG, PNG, WEBP) are allowed for payment screenshots'));
    }
  }
});

// Helper: Custom Reg ID generator
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
    if (anyDigits.length >= 4) {
      last2Dob = anyDigits.slice(-2);
    } else if (anyDigits.length >= 2) {
      last2Dob = anyDigits.slice(-2);
    }
  }

  const baseId = `SP3-${last2Phone}${last2Dob}`;
  let candidate = baseId;
  let suffixCode = 65; // 'A'

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

// 1. Check duplicate contacts before registration
router.get('/check-duplicate', async (req, res) => {
  try {
    const { p1Mobile, p1Email, p2Mobile } = req.query;
    const cleanP1Mobile = (p1Mobile || '').trim();
    const cleanP1Email = (p1Email || '').trim().toLowerCase();
    const cleanP2Mobile = (p2Mobile || '').trim();

    const query = { $or: [] };
    if (cleanP1Mobile) query.$or.push({ p1Phone: cleanP1Mobile }, { p2Phone: cleanP1Mobile });
    if (cleanP1Email) query.$or.push({ p1Email: cleanP1Email }, { p2Email: cleanP1Email });
    if (cleanP2Mobile) query.$or.push({ p1Phone: cleanP2Mobile }, { p2Phone: cleanP2Mobile });

    if (query.$or.length === 0) {
      return res.json({ success: true, isDuplicate: false });
    }

    let existing = null;
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        existing = await Registration.findOne(query).lean();
      }
    } catch (e) {}

    if (!existing) {
      const allRegs = dataStore.getRegistrations();
      existing = allRegs.find(r => {
        if (cleanP1Mobile && (r.p1Phone === cleanP1Mobile || r.player1Phone === cleanP1Mobile || r.p2Phone === cleanP1Mobile || r.player2Phone === cleanP1Mobile)) return true;
        if (cleanP1Email && ((r.p1Email && r.p1Email.toLowerCase() === cleanP1Email) || (r.player1Email && r.player1Email.toLowerCase() === cleanP1Email))) return true;
        if (cleanP2Mobile && (r.p1Phone === cleanP2Mobile || r.player1Phone === cleanP2Mobile || r.p2Phone === cleanP2Mobile || r.player2Phone === cleanP2Mobile)) return true;
        return false;
      });
    }

    if (existing) {
      let field = 'Contact details';
      if (cleanP1Mobile && (existing.p1Phone === cleanP1Mobile || existing.p2Phone === cleanP1Mobile)) field = `Mobile: ${cleanP1Mobile}`;
      else if (cleanP1Email && (existing.p1Email === cleanP1Email || existing.p2Email === cleanP1Email)) field = `Email: ${cleanP1Email}`;
      else if (cleanP2Mobile && (existing.p1Phone === cleanP2Mobile || existing.p2Phone === cleanP2Mobile)) field = `Partner Mobile: ${cleanP2Mobile}`;

      return res.json({
        success: true,
        isDuplicate: true,
        field,
        message: `An entry with ${field} is already registered.`
      });
    }

    return res.json({ success: true, isDuplicate: false });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Public Registration Submission (with multipart file upload or base64)
router.post('/submit', upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const body = req.body;

    let settings = null;
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        settings = await Settings.findOne().lean();
      }
    } catch (e) {}
    if (!settings) {
      settings = dataStore.getSettings();
    }
    const regStatus = (settings && (settings.registrationStatus || settings.registration_status)) || 'OPEN';
    if (regStatus.toUpperCase() === 'CLOSED') {
      return res.status(400).json({ success: false, error: 'Registrations are currently closed for this tournament.' });
    }

    // Required fields check
    if (!body.category || !body.p1Name || !body.p1Phone || !body.p1Email || !body.p1Dob) {
      return res.status(400).json({ success: false, error: 'Please provide all mandatory player details.' });
    }

    // Generate unique Custom Reg ID
    const regId = await generateUniqueRegId(body.p1Phone, body.p1Dob);

    // Determine screenshot URL
    let paymentScreenshotUrl = body.paymentScreenshotUrl || '';
    if (req.file) {
      paymentScreenshotUrl = `/uploads/receipts/${req.file.filename}`;
    } else if (body.receiptBase64) {
      const base64Data = body.receiptBase64.replace(/^data:image\/\w+;base64,/, '');
      const filename = `receipt_${Date.now()}_${Math.round(Math.random() * 1e6)}.png`;
      fs.writeFileSync(path.join(uploadDir, filename), base64Data, 'base64');
      paymentScreenshotUrl = `/uploads/receipts/${filename}`;
    }

    // Find category name
    let categoryName = body.category;
    if (settings && settings.categories) {
      const cats = Array.isArray(settings.categories) ? settings.categories : [];
      const matchCat = cats.find(c => c.code === body.category || c.name === body.category);
      if (matchCat) categoryName = matchCat.name;
    }

    const regData = {
      regId,
      category: body.category,
      categoryName,
      p1Name: body.p1Name.trim(),
      player1Name: body.p1Name.trim(),
      p1Phone: body.p1Phone.trim(),
      player1Phone: body.p1Phone.trim(),
      p1Email: body.p1Email.trim().toLowerCase(),
      player1Email: body.p1Email.trim().toLowerCase(),
      p1Dob: body.p1Dob,
      player1Dob: body.p1Dob,
      p1Age: body.p1Age || '',
      player1Age: body.p1Age || '',
      p1Tshirt: body.p1Tshirt || 'L',
      player1Tshirt: body.p1Tshirt || 'L',
      p1BloodGroup: body.p1BloodGroup || '',
      p1City: body.p1City || 'Delhi NCR',

      p2Name: (body.p2Name || '').trim(),
      player2Name: (body.p2Name || '').trim(),
      p2Phone: (body.p2Phone || '').trim(),
      player2Phone: (body.p2Phone || '').trim(),
      p2Email: (body.p2Email || '').trim().toLowerCase(),
      player2Email: (body.p2Email || '').trim().toLowerCase(),
      p2Dob: body.p2Dob || '',
      player2Dob: body.p2Dob || '',
      p2Age: body.p2Age || '',
      player2Age: body.p2Age || '',
      p2Tshirt: body.p2Tshirt || '',
      player2Tshirt: body.p2Tshirt || '',
      p2BloodGroup: body.p2BloodGroup || '',

      paymentAmount: Number(body.paymentAmount) || 0,
      paymentUtr: (body.paymentUtr || '').trim(),
      upiUtr: (body.paymentUtr || '').trim(),
      paymentScreenshotUrl,
      receiptUrl: paymentScreenshotUrl,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    // Save to persistent database / cache
    dataStore.addOrUpdateRegistration(regData);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const newReg = new Registration(regData);
        await newReg.save();
      }
    } catch (e) {
      console.warn('Mongoose save registration notice:', e.message);
    }

    // Trigger automated email notifications
    emailService.sendPlayerRegistrationReceipt(regData).catch(e => console.warn('Receipt email error:', e.message));
    emailService.sendAdminRegistrationAlert(regData).catch(e => console.warn('Admin alert email error:', e.message));

    return res.json({
      success: true,
      message: 'Registration submitted successfully! Your entry is currently pending admin verification.',
      regId,
      registration: regData
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Status Lookup / Verification (Public)
router.get('/status', async (req, res) => {
  try {
    const query = (req.query.query || '').trim();
    if (!query) {
      return res.status(400).json({ success: false, error: 'Please enter a Registration ID, Mobile number, or Email.' });
    }

    let reg = null;
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        reg = await Registration.findOne({
          $or: [
            { regId: new RegExp(`^${query}$`, 'i') },
            { p1Phone: query },
            { p2Phone: query },
            { p1Email: query.toLowerCase() },
            { p2Email: query.toLowerCase() }
          ]
        }).lean();
      }
    } catch (e) {}

    if (!reg) {
      const allRegs = dataStore.getRegistrations();
      const qLow = query.toLowerCase();
      reg = allRegs.find(r =>
        (r.regId && r.regId.toLowerCase() === qLow) ||
        r.p1Phone === query ||
        r.player1Phone === query ||
        r.p2Phone === query ||
        r.player2Phone === query ||
        (r.p1Email && r.p1Email.toLowerCase() === qLow) ||
        (r.player1Email && r.player1Email.toLowerCase() === qLow)
      );
    }

    if (!reg) {
      return res.json({ success: false, notFound: true, message: `No registration found matching "${query}". Please check and try again.` });
    }

    const p1P = reg.p1Phone || reg.player1Phone || '';
    const maskedP1 = p1P.length >= 4 ? p1P.slice(0, 2) + '******' + p1P.slice(-2) : p1P;

    return res.json({
      success: true,
      registration: {
        regId: reg.regId,
        category: reg.category,
        categoryName: reg.categoryName || reg.category,
        p1Name: reg.p1Name || reg.player1Name,
        p1Phone: maskedP1,
        p2Name: reg.p2Name || reg.player2Name,
        status: reg.status,
        paymentAmount: reg.paymentAmount,
        createdAt: reg.createdAt,
        rejectionReason: reg.rejectionReason || ''
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Admin: Get all registrations with filtering (Protected)
router.get('/admin/list', requireAdmin, async (req, res) => {
  try {
    const { category, status, search } = req.query;
    let registrations = [];

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const filter = {};
        if (category && category !== 'ALL') filter.category = category;
        if (status && status !== 'ALL') filter.status = status;
        if (search) {
          filter.$or = [
            { regId: new RegExp(search, 'i') },
            { p1Name: new RegExp(search, 'i') },
            { p2Name: new RegExp(search, 'i') },
            { p1Phone: new RegExp(search, 'i') },
            { p1Email: new RegExp(search, 'i') },
            { paymentUtr: new RegExp(search, 'i') }
          ];
        }
        registrations = await Registration.find(filter).sort({ createdAt: -1 }).lean();
      }
    } catch (e) {}

    if (!registrations || registrations.length === 0) {
      registrations = dataStore.getRegistrations();
      if (category && category !== 'ALL') registrations = registrations.filter(r => (r.category || '').toLowerCase() === category.toLowerCase());
      if (status && status !== 'ALL') registrations = registrations.filter(r => (r.status || '').toUpperCase() === status.toUpperCase());
      if (search) {
        const s = search.toLowerCase();
        registrations = registrations.filter(r =>
          (r.regId && r.regId.toLowerCase().includes(s)) ||
          (r.p1Name && r.p1Name.toLowerCase().includes(s)) ||
          (r.player1Name && r.player1Name.toLowerCase().includes(s)) ||
          (r.p2Name && r.p2Name.toLowerCase().includes(s)) ||
          (r.player2Name && r.player2Name.toLowerCase().includes(s)) ||
          (r.p1Phone && r.p1Phone.includes(s)) ||
          (r.paymentUtr && r.paymentUtr.toLowerCase().includes(s))
        );
      }
    }

    const normalizedList = registrations.map(r => ({
      _id: r._id || r.regId,
      regId: r.regId,
      category: r.category,
      categoryName: r.categoryName || r.category,
      p1Name: r.p1Name || r.player1Name,
      player1Name: r.p1Name || r.player1Name,
      p1Phone: r.p1Phone || r.player1Phone,
      player1Phone: r.p1Phone || r.player1Phone,
      p1Email: r.p1Email || r.player1Email,
      player1Email: r.p1Email || r.player1Email,
      p1Dob: r.p1Dob || r.player1Dob,
      player1Dob: r.p1Dob || r.player1Dob,
      p1Age: r.p1Age !== undefined ? r.p1Age : r.player1Age,
      player1Age: r.p1Age !== undefined ? r.p1Age : r.player1Age,
      p1Tshirt: r.p1Tshirt || r.player1Tshirt,
      player1Tshirt: r.p1Tshirt || r.player1Tshirt,
      p1BloodGroup: r.p1BloodGroup,
      p2Name: r.p2Name || r.player2Name,
      player2Name: r.p2Name || r.player2Name,
      p2Phone: r.p2Phone || r.player2Phone,
      player2Phone: r.p2Phone || r.player2Phone,
      p2Email: r.p2Email || r.player2Email,
      player2Email: r.p2Email || r.player2Email,
      p2Dob: r.p2Dob || r.player2Dob,
      player2Dob: r.p2Dob || r.player2Dob,
      p2Age: r.p2Age !== undefined ? r.p2Age : r.player2Age,
      player2Age: r.p2Age !== undefined ? r.p2Age : r.player2Age,
      p2Tshirt: r.p2Tshirt || r.player2Tshirt,
      player2Tshirt: r.p2Tshirt || r.player2Tshirt,
      p2BloodGroup: r.p2BloodGroup,
      paymentAmount: r.paymentAmount,
      paymentUtr: r.paymentUtr || r.upiUtr,
      upiUtr: r.paymentUtr || r.upiUtr,
      paymentScreenshotUrl: r.paymentScreenshotUrl || r.receiptUrl,
      receiptUrl: r.paymentScreenshotUrl || r.receiptUrl,
      paymentStatus: r.paymentStatus,
      status: r.status,
      rejectionReason: r.rejectionReason,
      adminNotes: r.adminNotes,
      createdAt: r.createdAt,
      timestamp: r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '',
      updatedAt: r.updatedAt
    }));

    const allCurrent = dataStore.getRegistrations();
    const stats = {
      total: allCurrent.length,
      approved: allCurrent.filter(r => (r.status || '').toUpperCase() === 'APPROVED').length,
      pending: allCurrent.filter(r => (r.status || '').toUpperCase() === 'PENDING').length,
      rejected: allCurrent.filter(r => (r.status || '').toUpperCase() === 'REJECTED').length
    };

    return res.json({ success: true, registrations: normalizedList, stats });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Admin: Update Registration Status (Approve / Reject / Pending) (Protected)
router.post('/admin/update-status', requireAdmin, async (req, res) => {
  try {
    const { regId, newStatus, rejectionReason, adminNotes } = req.body;
    if (!regId || !newStatus) {
      return res.status(400).json({ success: false, error: 'Registration ID and new status are required.' });
    }

    const updatedReg = dataStore.updateRegistrationStatus(regId, newStatus, adminNotes);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const reg = await Registration.findOne({ regId });
        if (reg) {
          reg.status = newStatus;
          if (rejectionReason !== undefined) reg.rejectionReason = rejectionReason;
          if (adminNotes !== undefined) reg.adminNotes = adminNotes;
          reg.updatedAt = new Date();
          await reg.save();
        }
      }
    } catch (e) {}

    if ((newStatus || '').toUpperCase() === 'APPROVED' && updatedReg) {
      emailService.sendPlayerApprovalEmail(updatedReg).catch(e => console.warn('Approval email error:', e.message));
    }

    return res.json({ success: true, message: `Registration ${regId} updated to ${newStatus}`, registration: updatedReg });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Admin: Full Edit Registration Details (Protected)
router.put('/admin/:regId', requireAdmin, async (req, res) => {
  try {
    const { regId } = req.params;
    const body = req.body;

    const allRegs = dataStore.getRegistrations();
    const existing = allRegs.find(r => r.regId === regId) || { regId };
    const merged = { ...existing, ...body, regId, updatedAt: new Date().toISOString() };
    dataStore.addOrUpdateRegistration(merged);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await Registration.findOneAndUpdate({ regId }, merged, { upsert: true });
      }
    } catch (e) {}

    return res.json({
      success: true,
      message: `Registration ${regId} updated successfully.`,
      registration: merged
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Admin: Full Edit Registration (POST alias for maximum compatibility)
router.post('/admin/edit', requireAdmin, async (req, res) => {
  try {
    const regId = req.body.regId || req.query.regId;
    if (!regId) return res.status(400).json({ success: false, error: 'Registration ID is required.' });

    const body = req.body;
    const allRegs = dataStore.getRegistrations();
    const existing = allRegs.find(r => r.regId === regId) || { regId };
    const merged = { ...existing, ...body, regId, updatedAt: new Date().toISOString() };
    dataStore.addOrUpdateRegistration(merged);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await Registration.findOneAndUpdate({ regId }, merged, { upsert: true });
      }
    } catch (e) {}

    return res.json({
      success: true,
      message: `Registration ${regId} updated successfully.`,
      registration: merged
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
