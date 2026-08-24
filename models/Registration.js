const mongoose = require('mongoose');

const RegistrationSchema = new mongoose.Schema({
  regId: { type: String, unique: true, required: true, index: true },
  category: { type: String, required: true },
  categoryName: { type: String },

  // Player 1 Details
  p1Name: { type: String, required: true, trim: true },
  p1Phone: { type: String, required: true, trim: true, index: true },
  p1Email: { type: String, required: true, trim: true, lowercase: true, index: true },
  p1Dob: { type: String, required: true },
  p1Age: { type: String },
  p1Tshirt: { type: String, default: 'L' },
  p1BloodGroup: { type: String, default: '' },
  p1City: { type: String, default: 'Delhi NCR' },

  // Player 2 Details (Optional for Singles)
  p2Name: { type: String, default: '', trim: true },
  p2Phone: { type: String, default: '', trim: true },
  p2Email: { type: String, default: '', trim: true, lowercase: true },
  p2Dob: { type: String, default: '' },
  p2Age: { type: String, default: '' },
  p2Tshirt: { type: String, default: '' },
  p2BloodGroup: { type: String, default: '' },

  // Payment Details
  paymentAmount: { type: Number, default: 0 },
  paymentUtr: { type: String, default: '', trim: true },
  paymentScreenshotUrl: { type: String, default: '' },
  paymentStatus: { type: String, default: 'Paid' },

  // Review & Admin Status
  status: {
    type: String,
    default: 'Pending',
    index: true
  },
  rejectionReason: { type: String, default: '' },
  adminNotes: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Registration', RegistrationSchema);

