const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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

  while (await Registration.exists({ regId: candidate })) {
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

    const existing = await Registration.findOne(query);
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

    // Check registration status from settings
    const settings = await Settings.findOne();
    if (settings && settings.registrationStatus === 'Closed') {
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
      const matchCat = settings.categories.find(c => c.code === body.category || c.name === body.category);
      if (matchCat) categoryName = matchCat.name;
    }

    const newReg = new Registration({
      regId,
      category: body.category,
      categoryName,
      p1Name: body.p1Name.trim(),
      p1Phone: body.p1Phone.trim(),
      p1Email: body.p1Email.trim().toLowerCase(),
      p1Dob: body.p1Dob,
      p1Age: body.p1Age || '',
      p1Tshirt: body.p1Tshirt || 'L',
      p1BloodGroup: body.p1BloodGroup || '',
      p1City: body.p1City || 'Delhi NCR',

      p2Name: (body.p2Name || '').trim(),
      p2Phone: (body.p2Phone || '').trim(),
      p2Email: (body.p2Email || '').trim().toLowerCase(),
      p2Dob: body.p2Dob || '',
      p2Age: body.p2Age || '',
      p2Tshirt: body.p2Tshirt || '',
      p2BloodGroup: body.p2BloodGroup || '',

      paymentAmount: Number(body.paymentAmount) || 0,
      paymentUtr: (body.paymentUtr || '').trim(),
      paymentScreenshotUrl,
      status: 'Pending'
    });

    await newReg.save();

    // Sync with persistent local dataStore
    try {
      dataStore.addOrUpdateRegistration({
        regId: newReg.regId,
        category: newReg.category,
        categoryName: newReg.categoryName,
        p1Name: newReg.p1Name,
        player1Name: newReg.p1Name,
        p1Phone: newReg.p1Phone,
        player1Phone: newReg.p1Phone,
        p1Email: newReg.p1Email,
        player1Email: newReg.p1Email,
        p1Dob: newReg.p1Dob,
        player1Dob: newReg.p1Dob,
        p1Age: newReg.p1Age,
        player1Age: newReg.p1Age,
        p1Tshirt: newReg.p1Tshirt,
        player1Tshirt: newReg.p1Tshirt,
        p1BloodGroup: newReg.p1BloodGroup,
        p2Name: newReg.p2Name,
        player2Name: newReg.p2Name,
        p2Phone: newReg.p2Phone,
        player2Phone: newReg.p2Phone,
        p2Email: newReg.p2Email,
        player2Email: newReg.p2Email,
        p2Dob: newReg.p2Dob,
        player2Dob: newReg.p2Dob,
        p2Age: newReg.p2Age,
        player2Age: newReg.p2Age,
        p2Tshirt: newReg.p2Tshirt,
        player2Tshirt: newReg.p2Tshirt,
        p2BloodGroup: newReg.p2BloodGroup,
        paymentAmount: newReg.paymentAmount,
        paymentUtr: newReg.paymentUtr,
        upiUtr: newReg.paymentUtr,
        paymentScreenshotUrl: newReg.paymentScreenshotUrl,
        receiptUrl: newReg.paymentScreenshotUrl,
        status: newReg.status,
        createdAt: newReg.createdAt ? newReg.createdAt.toISOString() : new Date().toISOString()
      });
    } catch (dsErr) {
      console.warn('DataStore sync notice:', dsErr.message);
    }

    // Trigger automated email notifications
    emailService.sendPlayerRegistrationReceipt(newReg).catch(e => console.warn('Receipt email error:', e.message));
    emailService.sendAdminRegistrationAlert(newReg).catch(e => console.warn('Admin alert email error:', e.message));

    return res.json({
      success: true,
      message: 'Registration submitted successfully! Your entry is currently pending admin verification.',
      regId: newReg.regId,
      registration: newReg
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

    const reg = await Registration.findOne({
      $or: [
        { regId: new RegExp(`^${query}$`, 'i') },
        { p1Phone: query },
        { p2Phone: query },
        { p1Email: query.toLowerCase() },
        { p2Email: query.toLowerCase() }
      ]
    });

    if (!reg) {
      return res.json({ success: false, notFound: true, message: `No registration found matching "${query}". Please check and try again.` });
    }

    return res.json({
      success: true,
      registration: {
        regId: reg.regId,
        category: reg.category,
        categoryName: reg.categoryName,
        p1Name: reg.p1Name,
        p1Phone: reg.p1Phone.slice(0, 2) + '******' + reg.p1Phone.slice(-2),
        p2Name: reg.p2Name,
        status: reg.status,
        paymentAmount: reg.paymentAmount,
        createdAt: reg.createdAt,
        rejectionReason: reg.rejectionReason
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

    const registrations = await Registration.find(filter).sort({ createdAt: -1 });

    const normalizedList = registrations.map(r => ({
      _id: r._id,
      regId: r.regId,
      category: r.category,
      categoryName: r.categoryName || r.category,
      
      // Player 1
      p1Name: r.p1Name,
      player1Name: r.p1Name,
      p1Phone: r.p1Phone,
      player1Phone: r.p1Phone,
      p1Email: r.p1Email,
      player1Email: r.p1Email,
      p1Dob: r.p1Dob,
      player1Dob: r.p1Dob,
      p1Age: r.p1Age,
      player1Age: r.p1Age,
      p1Tshirt: r.p1Tshirt,
      player1Tshirt: r.p1Tshirt,
      p1BloodGroup: r.p1BloodGroup,

      // Player 2
      p2Name: r.p2Name,
      player2Name: r.p2Name,
      p2Phone: r.p2Phone,
      player2Phone: r.p2Phone,
      p2Email: r.p2Email,
      player2Email: r.p2Email,
      p2Dob: r.p2Dob,
      player2Dob: r.p2Dob,
      p2Age: r.p2Age,
      player2Age: r.p2Age,
      p2Tshirt: r.p2Tshirt,
      player2Tshirt: r.p2Tshirt,
      p2BloodGroup: r.p2BloodGroup,

      // Payment & Status
      paymentAmount: r.paymentAmount,
      paymentUtr: r.paymentUtr,
      upiUtr: r.paymentUtr,
      paymentScreenshotUrl: r.paymentScreenshotUrl,
      receiptUrl: r.paymentScreenshotUrl,
      paymentStatus: r.paymentStatus,
      status: r.status,
      rejectionReason: r.rejectionReason,
      adminNotes: r.adminNotes,
      createdAt: r.createdAt,
      timestamp: r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '',
      updatedAt: r.updatedAt
    }));

    const stats = {
      total: await Registration.countDocuments(),
      approved: await Registration.countDocuments({ status: 'Approved' }),
      pending: await Registration.countDocuments({ status: 'Pending' }),
      rejected: await Registration.countDocuments({ status: 'Rejected' })
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

    const reg = await Registration.findOne({ regId });
    if (!reg) {
      return res.status(404).json({ success: false, error: `Registration ${regId} not found.` });
    }

    reg.status = newStatus;
    if (rejectionReason !== undefined) reg.rejectionReason = rejectionReason;
    if (adminNotes !== undefined) reg.adminNotes = adminNotes;
    reg.updatedAt = new Date();

    await reg.save();

    if ((newStatus || '').toUpperCase() === 'APPROVED') {
      emailService.sendPlayerApprovalEmail(reg).catch(e => console.warn('Approval email error:', e.message));
    }

    return res.json({ success: true, message: `Registration ${regId} updated to ${newStatus}`, registration: reg });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Admin: Delete Registration (Protected)
// 7. Admin: Full Edit Registration Details (Protected)
router.put('/admin/:regId', requireAdmin, async (req, res) => {
  try {
    const { regId } = req.params;
    const body = req.body;

    const reg = await Registration.findOne({ regId });
    if (!reg) {
      return res.status(404).json({ success: false, error: `Registration ${regId} not found.` });
    }

    if (body.category) reg.category = body.category;
    if (body.categoryName) reg.categoryName = body.categoryName;
    if (body.p1Name || body.player1Name) reg.p1Name = (body.p1Name || body.player1Name).trim();
    if (body.p1Phone || body.player1Phone) reg.p1Phone = (body.p1Phone || body.player1Phone).trim();
    if (body.p1Email || body.player1Email) reg.p1Email = (body.p1Email || body.player1Email).trim().toLowerCase();
    if (body.p1Dob || body.player1Dob) reg.p1Dob = body.p1Dob || body.player1Dob;
    if (body.p1Age !== undefined || body.player1Age !== undefined) reg.p1Age = body.p1Age !== undefined ? body.p1Age : body.player1Age;
    if (body.p1Tshirt || body.player1Tshirt) reg.p1Tshirt = body.p1Tshirt || body.player1Tshirt;
    if (body.p1BloodGroup !== undefined) reg.p1BloodGroup = body.p1BloodGroup;

    if (body.p2Name !== undefined || body.player2Name !== undefined) reg.p2Name = (body.p2Name !== undefined ? body.p2Name : body.player2Name || '').trim();
    if (body.p2Phone !== undefined || body.player2Phone !== undefined) reg.p2Phone = (body.p2Phone !== undefined ? body.p2Phone : body.player2Phone || '').trim();
    if (body.p2Email !== undefined || body.player2Email !== undefined) reg.p2Email = (body.p2Email !== undefined ? body.p2Email : body.player2Email || '').trim().toLowerCase();
    if (body.p2Dob !== undefined || body.player2Dob !== undefined) reg.p2Dob = body.p2Dob !== undefined ? body.p2Dob : body.player2Dob;
    if (body.p2Age !== undefined || body.player2Age !== undefined) reg.p2Age = body.p2Age !== undefined ? body.p2Age : body.player2Age;
    if (body.p2Tshirt !== undefined || body.player2Tshirt !== undefined) reg.p2Tshirt = body.p2Tshirt !== undefined ? body.p2Tshirt : body.player2Tshirt;
    if (body.p2BloodGroup !== undefined) reg.p2BloodGroup = body.p2BloodGroup;

    if (body.paymentAmount !== undefined) reg.paymentAmount = Number(body.paymentAmount);
    if (body.paymentUtr !== undefined || body.upiUtr !== undefined) reg.paymentUtr = (body.paymentUtr !== undefined ? body.paymentUtr : body.upiUtr || '').trim();
    if (body.status) reg.status = body.status;
    if (body.adminNotes !== undefined) reg.adminNotes = body.adminNotes;
    if (body.rejectionReason !== undefined) reg.rejectionReason = body.rejectionReason;

    reg.updatedAt = new Date();
    await reg.save();

    return res.json({
      success: true,
      message: `Registration ${regId} updated successfully.`,
      registration: reg
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Admin: Full Edit Registration (POST alias for maximum compatibility)
router.post('/admin/edit', requireAdmin, async (req, res) => {
  try {
    const regId = req.body.regId || req.query.regId;
    if (!regId) return res.status(400).json({ success: false, error: 'Registration ID is required.' });

    const body = req.body;
    const reg = await Registration.findOne({ regId });
    if (!reg) return res.status(404).json({ success: false, error: `Registration ${regId} not found.` });

    if (body.category) reg.category = body.category;
    if (body.categoryName) reg.categoryName = body.categoryName;
    if (body.p1Name || body.player1Name) reg.p1Name = (body.p1Name || body.player1Name).trim();
    if (body.p1Phone || body.player1Phone) reg.p1Phone = (body.p1Phone || body.player1Phone).trim();
    if (body.p1Email || body.player1Email) reg.p1Email = (body.p1Email || body.player1Email).trim().toLowerCase();
    if (body.p1Dob || body.player1Dob) reg.p1Dob = body.p1Dob || body.player1Dob;
    if (body.p1Age !== undefined || body.player1Age !== undefined) reg.p1Age = body.p1Age !== undefined ? body.p1Age : body.player1Age;
    if (body.p1Tshirt || body.player1Tshirt) reg.p1Tshirt = body.p1Tshirt || body.player1Tshirt;
    if (body.p1BloodGroup !== undefined) reg.p1BloodGroup = body.p1BloodGroup;

    if (body.p2Name !== undefined || body.player2Name !== undefined) reg.p2Name = (body.p2Name !== undefined ? body.p2Name : body.player2Name || '').trim();
    if (body.p2Phone !== undefined || body.player2Phone !== undefined) reg.p2Phone = (body.p2Phone !== undefined ? body.p2Phone : body.player2Phone || '').trim();
    if (body.p2Email !== undefined || body.player2Email !== undefined) reg.p2Email = (body.p2Email !== undefined ? body.p2Email : body.player2Email || '').trim().toLowerCase();
    if (body.p2Dob !== undefined || body.player2Dob !== undefined) reg.p2Dob = body.p2Dob !== undefined ? body.p2Dob : body.player2Dob;
    if (body.p2Age !== undefined || body.player2Age !== undefined) reg.p2Age = body.p2Age !== undefined ? body.p2Age : body.player2Age;
    if (body.p2Tshirt !== undefined || body.player2Tshirt !== undefined) reg.p2Tshirt = body.p2Tshirt !== undefined ? body.p2Tshirt : body.player2Tshirt;
    if (body.p2BloodGroup !== undefined) reg.p2BloodGroup = body.p2BloodGroup;

    if (body.paymentAmount !== undefined) reg.paymentAmount = Number(body.paymentAmount);
    if (body.paymentUtr !== undefined || body.upiUtr !== undefined) reg.paymentUtr = (body.paymentUtr !== undefined ? body.paymentUtr : body.upiUtr || '').trim();
    if (body.status) reg.status = body.status;
    if (body.adminNotes !== undefined) reg.adminNotes = body.adminNotes;
    if (body.rejectionReason !== undefined) reg.rejectionReason = body.rejectionReason;

    reg.updatedAt = new Date();
    await reg.save();

    return res.json({
      success: true,
      message: `Registration ${regId} updated successfully.`,
      registration: reg
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
