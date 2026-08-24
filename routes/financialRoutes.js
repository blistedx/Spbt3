const express = require('express');
const router = express.Router();
const { Expense, Sponsor } = require('../models/Financials');
const Registration = require('../models/Registration');
const { requireAdmin } = require('../middleware/auth');

// 1. Get Financial Summary & Ledger Analytics (Admin Protected)
router.get('/summary', requireAdmin, async (req, res) => {
  try {
    // Total Registrations Income (Approved registrations with payment)
    const approvedRegs = await Registration.find({ status: 'Approved' });
    const totalRegRevenue = approvedRegs.reduce((acc, r) => acc + (Number(r.paymentAmount) || 0), 0);

    // Total Expenses
    const expenses = await Expense.find().sort({ date: -1 });
    const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    // Total Sponsorships Received
    const sponsors = await Sponsor.find().sort({ createdAt: -1 });
    const totalSponsorship = sponsors.reduce((acc, s) => acc + (s.status === 'Received' ? (Number(s.amount) || 0) : 0), 0);
    const totalCommittedSponsorship = sponsors.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);

    // Net Balance
    const totalIncome = totalRegRevenue + totalSponsorship;
    const netBalance = totalIncome - totalExpenses;

    // Expenses breakdown by Category
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
    const expense = await Expense.findOneAndUpdate(
      { expenseId: cleanId },
      {
        expenseId: cleanId,
        title,
        category: category || 'Other',
        amount: Number(amount) || 0,
        paidTo: paidTo || '',
        paidBy: paidBy || 'Hemant Kalra',
        notes: notes || '',
        date: date || new Date().toISOString().split('T')[0]
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: 'Expense recorded successfully', expense });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Delete Expense (Admin Protected)
router.delete('/expenses/:expenseId', requireAdmin, async (req, res) => {
  try {
    const { expenseId } = req.params;
    const deleted = await Expense.findOneAndDelete({ expenseId });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Expense not found' });
    }
    return res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Public / All Sponsors
router.get('/sponsors', async (req, res) => {
  try {
    const sponsors = await Sponsor.find().sort({ createdAt: -1 });
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
    const sponsor = await Sponsor.findOneAndUpdate(
      { sponsorId: cleanId },
      {
        sponsorId: cleanId,
        name,
        company: company || '',
        tier: tier || 'Associate Sponsor',
        amount: Number(amount) || 0,
        logoUrl: logoUrl || '',
        website: website || '',
        contactPhone: contactPhone || '',
        status: status || 'Received'
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, message: 'Sponsor saved successfully', sponsor });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete Sponsor (Admin Protected)
router.delete('/sponsors/:sponsorId', requireAdmin, async (req, res) => {
  try {
    const { sponsorId } = req.params;
    const deleted = await Sponsor.findOneAndDelete({ sponsorId });
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Sponsor record not found' });
    }
    return res.json({ success: true, message: 'Sponsor deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
