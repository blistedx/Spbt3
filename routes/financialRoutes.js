const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Expense, Sponsor } = require('../models/Financials');
const Registration = require('../models/Registration');
const dataStore = require('../config/dataStore');
const { requireAdmin } = require('../middleware/auth');

// 1. Get Financial Summary & Ledger Analytics (Admin Protected)
router.get('/summary', requireAdmin, async (req, res) => {
  try {
    let approvedRegs = [];
    let expenses = [];
    let sponsors = [];

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        approvedRegs = await Registration.find({ status: 'Approved' }).lean();
        expenses = await Expense.find().sort({ date: -1 }).lean();
        sponsors = await Sponsor.find().sort({ createdAt: -1 }).lean();
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
    const totalSponsorship = sponsors.reduce((acc, s) => acc + (s.status === 'Received' ? (Number(s.amount) || 0) : 0), 0);
    const totalCommittedSponsorship = sponsors.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

    const totalIncome = totalRegRevenue + totalSponsorship;
    const netBalance = totalIncome - totalExpenses;

    const categoryBreakdown = {};
    expenses.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + Number(e.amount);
    });

    return res.json({
      success: true,
      summary: {
        totalRegRevenue,
        approvedPlayerCount: approvedRegs.length,
        totalSponsorship,
        totalCommittedSponsorship,
        totalIncome,
        totalExpenses,
        netBalance,
        categoryBreakdown
      },
      expenses,
      sponsors
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Add / Update Expense (Admin Protected)
router.post('/expenses', requireAdmin, async (req, res) => {
  try {
    const { expenseId, title, category, amount, paidTo, paidBy, notes, date } = req.body;
    if (!title || amount === undefined) {
      return res.status(400).json({ success: false, error: 'Title and amount are required' });
    }

    const cleanId = expenseId || `EXP-${Date.now()}`;
    const expObj = {
      id: cleanId,
      expenseId: cleanId,
      item: title,
      title,
      category: category || 'Other',
      amount: Number(amount) || 0,
      paidTo: paidTo || '',
      paidBy: paidBy || 'Hemant Kalra',
      notes: notes || '',
      date: date || new Date().toISOString().split('T')[0]
    };

    dataStore.saveExpense(expObj);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await Expense.findOneAndUpdate(
          { expenseId: cleanId },
          expObj,
          { upsert: true, new: true }
        );
      }
    } catch (e) {}

    return res.json({ success: true, message: 'Expense recorded successfully', expense: expObj });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Delete Expense (Admin Protected)
router.delete('/expenses/:expenseId', requireAdmin, async (req, res) => {
  try {
    const { expenseId } = req.params;
    dataStore.deleteExpense(expenseId);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await Expense.findOneAndDelete({ expenseId });
      }
    } catch (e) {}

    return res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Public / All Sponsors
router.get('/sponsors', async (req, res) => {
  try {
    let sponsors = [];
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        sponsors = await Sponsor.find().sort({ createdAt: -1 }).lean();
      }
    } catch (e) {}

    if (!sponsors || sponsors.length === 0) {
      const fileFin = dataStore.getFinancials();
      sponsors = fileFin.sponsors || [];
    }

    return res.json({ success: true, sponsors });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Add / Update Sponsor (Admin Protected)
router.post('/sponsors', requireAdmin, async (req, res) => {
  try {
    const { sponsorId, name, company, tier, amount, logoUrl, website, contactPhone, status } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Sponsor name is required' });
    }

    const cleanId = sponsorId || `SPON-${Date.now()}`;
    const sponObj = {
      id: cleanId,
      sponsorId: cleanId,
      name,
      company: company || '',
      tier: tier || 'Associate Sponsor',
      amount: Number(amount) || 0,
      promisedAmount: Number(amount) || 0,
      logoUrl: logoUrl || '',
      website: website || '',
      contactPhone: contactPhone || '',
      status: status || 'Received'
    };

    dataStore.saveSponsor(sponObj);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await Sponsor.findOneAndUpdate(
          { sponsorId: cleanId },
          sponObj,
          { upsert: true, new: true }
        );
      }
    } catch (e) {}

    return res.json({ success: true, message: 'Sponsor saved successfully', sponsor: sponObj });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete Sponsor (Admin Protected)
router.delete('/sponsors/:sponsorId', requireAdmin, async (req, res) => {
  try {
    const { sponsorId } = req.params;
    dataStore.deleteSponsor(sponsorId);

    try {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        await Sponsor.findOneAndDelete({ sponsorId });
      }
    } catch (e) {}

    return res.json({ success: true, message: 'Sponsor deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
