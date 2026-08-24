import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, DollarSign, TrendingUp, Check, X, Eye, RefreshCw, KeyRound, Plus, Trash2, Pencil } from 'lucide-react';

export default function AdminPortal() {
  const [pin, setPin] = useState(localStorage.getItem('SP3_ADMIN_PIN') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('registrations'); // 'registrations' | 'financials' | 'settings'
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [editingReg, setEditingReg] = useState(null);

  // New Expense form
  const [newExpense, setNewExpense] = useState({ title: '', category: 'Shuttles', amount: '', paidTo: '', notes: '' });

  useEffect(() => {
    if (pin) {
      verifyPinAndLoad(pin);
    }
  }, []);

  const verifyPinAndLoad = async (enteredPin) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin, role: 'admin' })
      });
      const data = await res.json();
      if (data.success && data.role === 'admin') {
        setIsAuthenticated(true);
        localStorage.setItem('SP3_ADMIN_PIN', enteredPin);
        loadAdminData(enteredPin);
      } else {
        alert(data.error || 'Invalid Admin PIN');
        setIsAuthenticated(false);
      }
    } catch (err) {
      alert('Authentication error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async (adminPin) => {
    setLoading(true);
    try {
      // 1. Load Registrations
      const regRes = await fetch(`/api/registrations/admin/list?pin=${encodeURIComponent(adminPin)}`);
      const regData = await regRes.json();
      if (regData.success) {
        setRegistrations(regData.registrations || []);
      }

      // 2. Load Financials
      const finRes = await fetch(`/api/financials/summary?pin=${encodeURIComponent(adminPin)}`);
      const finData = await finRes.json();
      if (finData.success) {
        setFinancials(finData);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (regId, newStatus) => {
    try {
      const res = await fetch('/api/registrations/admin/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify({ regId, newStatus })
      });
      const data = await res.json();
      if (data.success) {
        loadAdminData(pin);
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleSaveEditedReg = async (e) => {
    e.preventDefault();
    if (!editingReg || !editingReg.regId) return;
    try {
      const res = await fetch(`/api/registrations/admin/${editingReg.regId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify(editingReg)
      });
      const data = await res.json();
      if (data.success) {
        setEditingReg(null);
        loadAdminData(pin);
      } else {
        alert(data.error || 'Failed to update registration');
      }
    } catch (err) {
      alert('Error saving registration: ' + err.message);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.title || !newExpense.amount) return;

    try {
      const res = await fetch('/api/financials/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pin': pin },
        body: JSON.stringify(newExpense)
      });
      const data = await res.json();
      if (data.success) {
        setNewExpense({ title: '', category: 'Shuttles', amount: '', paidTo: '', notes: '' });
        loadAdminData(pin);
      }
    } catch (err) {
      alert('Error recording expense: ' + err.message);
    }
  };

  const handleDeleteExpense = async (expId) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await fetch(`/api/financials/expenses/${expId}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': pin }
      });
      loadAdminData(pin);
    } catch (err) {
      alert('Error deleting expense: ' + err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '420px', margin: '80px auto', padding: '16px' }}>
        <div className="glass-panel" style={{ padding: '36px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
            <KeyRound size={28} color="#4ade80" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
            Admin Portal Access
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>
            Enter Master Admin PIN (Default: <code>9903</code>)
          </p>

          <form onSubmit={(e) => { e.preventDefault(); verifyPinAndLoad(pin); }}>
            <input
              type="password"
              className="input-field font-mono"
              placeholder="Admin PIN..."
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '0.2em', marginBottom: '16px' }}
              required
            />
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Authenticating...' : 'Unlock Dashboard →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredRegs = registrations.filter(r => {
    const matchCat = filterCategory === 'ALL' || r.category === filterCategory;
    const matchStatus = filterStatus === 'ALL' || (r.status || '').toUpperCase() === filterStatus;
    const matchQ = !searchQuery ||
      (r.regId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.p1Name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.p2Name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.p1Phone || '').includes(searchQuery);

    return matchCat && matchStatus && matchQ;
  });

  const summary = financials?.summary || {};

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px' }}>
      {/* 1. Header & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={24} color="#4ade80" /> Tournament Control Panel
          </h2>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Connected to MongoDB Cloud Database</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => loadAdminData(pin)}>
            <RefreshCw size={14} /> Refresh Data
          </button>
          <button className="btn-secondary" onClick={() => { setIsAuthenticated(false); localStorage.removeItem('SP3_ADMIN_PIN'); }}>
            Lock / Logout
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} /> Total Registered Pairs
          </span>
          <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {registrations.length}
          </div>
          <span style={{ fontSize: '11px', color: '#4ade80' }}>
            {registrations.filter(r => r.status === 'Approved').length} Approved
          </span>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={14} /> Registration Revenue
          </span>
          <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: '#4ade80', marginTop: '6px' }}>
            ₹{(summary.totalRegRevenue || 0).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Entry Fees</span>
        </div>

        <div className="glass-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={14} /> Total Expenses
          </span>
          <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: '#f87171', marginTop: '6px' }}>
            ₹{(summary.totalExpenses || 0).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Shuttles, Courts, Kits</span>
        </div>

        <div className="glass-card" style={{ padding: '18px', border: (summary.netBalance >= 0) ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(239,68,68,0.4)' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Net Financial Balance</span>
          <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: (summary.netBalance >= 0) ? '#4ade80' : '#f87171', marginTop: '6px' }}>
            {summary.netBalance >= 0 ? '+' : '-'}₹{Math.abs(summary.netBalance || 0).toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '11px', color: (summary.netBalance >= 0) ? '#4ade80' : '#f87171' }}>
            {summary.netBalance >= 0 ? 'Surplus / Profit' : 'Deficit'}
          </span>
        </div>
      </div>

      {/* 3. Sub-tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className={activeTab === 'registrations' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('registrations')}>
          Player Registrations ({registrations.length})
        </button>
        <button className={activeTab === 'financials' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('financials')}>
          Financials & Ledger
        </button>
      </div>

      {/* Tab 1: Registrations Table */}
      {activeTab === 'registrations' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search by ID, name, phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ maxWidth: '280px' }}
            />

            <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: '160px' }}>
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 8px' }}>Reg ID</th>
                  <th style={{ padding: '12px 8px' }}>Player 1</th>
                  <th style={{ padding: '12px 8px' }}>Player 2</th>
                  <th style={{ padding: '12px 8px' }}>Category</th>
                  <th style={{ padding: '12px 8px' }}>Fee / UTR</th>
                  <th style={{ padding: '12px 8px' }}>Status</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegs.map(r => (
                  <tr key={r._id || r.regId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 700, color: '#4ade80' }} className="font-mono">
                      {r.regId}
                      <div style={{ color: '#64748b', fontSize: '10px', fontWeight: 400 }}>
                        {r.createdAt || r.timestamp
                          ? new Date(r.createdAt || r.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                          : 'Recent'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <strong>{r.p1Name}</strong>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>{r.p1Phone} · Age: {r.p1Age || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {r.p2Name ? (
                        <>
                          <strong>{r.p2Name}</strong>
                          <div style={{ color: '#64748b', fontSize: '11px' }}>{r.p2Phone || ''}</div>
                        </>
                      ) : <span style={{ color: '#64748b' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {r.categoryName || r.category}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ color: '#facc15', fontWeight: 600 }}>₹{r.paymentAmount}</span>
                      <div className="font-mono" style={{ color: '#94a3b8', fontSize: '10px' }}>{r.paymentUtr || r.upiUtr || 'No UTR'}</div>
                      {r.receiptUrl && (
                        <button
                          onClick={() => setSelectedReceipt(r.receiptUrl)}
                          style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '11px', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          View Receipt
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span className={`badge badge-${(r.status || 'pending').toLowerCase()}`}>
                        {r.status || 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingReg({ ...r })}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}
                          title="Edit Registration Details"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(r.regId, 'Approved')}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}
                          title="Approve Player"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(r.regId, 'Rejected')}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.2)', color: '#f87171' }}
                          title="Reject Player"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Financials & Ledger */}
      {activeTab === 'financials' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Add Expense Form */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} color="#4ade80" /> Log Tournament Expense
            </h3>
            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Expense Title / Item</label>
                <input type="text" className="input-field" placeholder="e.g. 10 Tubes Yonex Shuttles" required value={newExpense.title} onChange={e => setNewExpense({ ...newExpense, title: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Category</label>
                  <select className="input-field" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}>
                    <option value="Shuttles">Shuttles</option>
                    <option value="Trophies & Medals">Trophies & Medals</option>
                    <option value="Refreshments & Water">Refreshments</option>
                    <option value="Court Rental">Court Rental</option>
                    <option value="T-Shirts & Kits">T-Shirts & Kits</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="input-label">Amount (₹)</label>
                  <input type="number" className="input-field" placeholder="e.g. 5000" required value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="input-label">Paid To / Vendor</label>
                <input type="text" className="input-field" placeholder="Vendor Name" value={newExpense.paidTo} onChange={e => setNewExpense({ ...newExpense, paidTo: e.target.value })} />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '6px' }}>
                Save Expense Record
              </button>
            </form>
          </div>

          {/* Expenses List */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
              Logged Expenses ({(financials?.expenses || []).length})
            </h3>
            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(financials?.expenses || []).map(exp => (
                <div key={exp._id || exp.expenseId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                  <div>
                    <strong>{exp.title}</strong>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{exp.category} · {exp.paidTo || 'Cash'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="font-mono" style={{ fontWeight: 700, color: '#f87171' }}>
                      -₹{exp.amount}
                    </span>
                    <button onClick={() => handleDeleteExpense(exp.expenseId)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Registration Modal */}
      {editingReg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-panel" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  ✏️ Edit Registration ({editingReg.regId})
                </h3>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Update player details & payment reference</span>
              </div>
              <button onClick={() => setEditingReg(null)} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '22px', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEditedReg} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Category</label>
                <select className="input-field" value={editingReg.category} onChange={e => setEditingReg({ ...editingReg, category: e.target.value })}>
                  <option value="Below 35">Below 35</option>
                  <option value="Above 35">Above 35</option>
                  <option value="MEN_DOUBLES_OPEN">Men's Doubles Open</option>
                  <option value="MEN_SINGLES_OPEN">Men's Singles Open</option>
                </select>
              </div>

              {/* Player 1 */}
              <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80', display: 'block', marginBottom: '8px' }}>👤 Player 1 Details</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                  <div>
                    <label className="input-label">Full Name *</label>
                    <input type="text" className="input-field" required value={editingReg.p1Name || ''} onChange={e => setEditingReg({ ...editingReg, p1Name: e.target.value, player1Name: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Mobile *</label>
                    <input type="tel" className="input-field" required value={editingReg.p1Phone || ''} onChange={e => setEditingReg({ ...editingReg, p1Phone: e.target.value, player1Phone: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="input-label">Email Address</label>
                    <input type="email" className="input-field" value={editingReg.p1Email || ''} onChange={e => setEditingReg({ ...editingReg, p1Email: e.target.value, player1Email: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Date of Birth</label>
                    <input type="date" className="input-field" value={editingReg.p1Dob || ''} onChange={e => setEditingReg({ ...editingReg, p1Dob: e.target.value, player1Dob: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Player 2 */}
              <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', padding: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa', display: 'block', marginBottom: '8px' }}>👥 Player 2 (Partner)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                  <div>
                    <label className="input-label">Partner Name</label>
                    <input type="text" className="input-field" value={editingReg.p2Name || ''} onChange={e => setEditingReg({ ...editingReg, p2Name: e.target.value, player2Name: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Partner Mobile</label>
                    <input type="tel" className="input-field" value={editingReg.p2Phone || ''} onChange={e => setEditingReg({ ...editingReg, p2Phone: e.target.value, player2Phone: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="input-label">Partner Email</label>
                    <input type="email" className="input-field" value={editingReg.p2Email || ''} onChange={e => setEditingReg({ ...editingReg, p2Email: e.target.value, player2Email: e.target.value })} />
                  </div>
                  <div>
                    <label className="input-label">Partner DOB</label>
                    <input type="date" className="input-field" value={editingReg.p2Dob || ''} onChange={e => setEditingReg({ ...editingReg, p2Dob: e.target.value, player2Dob: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Payment & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">UPI UTR</label>
                  <input type="text" className="input-field font-mono" value={editingReg.paymentUtr || editingReg.upiUtr || ''} onChange={e => setEditingReg({ ...editingReg, paymentUtr: e.target.value, upiUtr: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Fee (₹)</label>
                  <input type="number" className="input-field font-mono" value={editingReg.paymentAmount || 1000} onChange={e => setEditingReg({ ...editingReg, paymentAmount: e.target.value })} />
                </div>
                <div>
                  <label className="input-label">Status</label>
                  <select className="input-field" value={editingReg.status || 'Pending'} onChange={e => setEditingReg({ ...editingReg, status: e.target.value })}>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Admin Notes</label>
                <input type="text" className="input-field" placeholder="Remarks..." value={editingReg.adminNotes || ''} onChange={e => setEditingReg({ ...editingReg, adminNotes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditingReg(null)}>Cancel</button>
                <button type="submit" className="btn-primary">💾 Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ maxWidth: '500px', width: '100%', padding: '20px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Payment Proof Screenshot</h3>
            <img src={selectedReceipt} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px', marginBottom: '16px' }} />
            <button className="btn-primary" onClick={() => setSelectedReceipt(null)}>
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
