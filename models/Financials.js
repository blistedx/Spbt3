const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  expenseId: { type: String, unique: true, required: true },
  title: { type: String, required: true },
  category: {
    type: String,
    default: 'Other'
  },
  amount: { type: Number, required: true },
  paidTo: { type: String, default: '' },
  paidBy: { type: String, default: 'Hemant Kalra' },
  receiptUrl: { type: String, default: '' },
  date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

const SponsorSchema = new mongoose.Schema({
  sponsorId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  company: { type: String, default: '' },
  tier: { type: String, default: 'Associate Sponsor' },
  amount: { type: Number, default: 0 },
  logoUrl: { type: String, default: '' },
  website: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  status: { type: String, default: 'Received' },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

const Expense = mongoose.model('Expense', ExpenseSchema);
const Sponsor = mongoose.model('Sponsor', SponsorSchema);

module.exports = { Expense, Sponsor };

