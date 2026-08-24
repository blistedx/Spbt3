import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { User, Phone, Mail, Calendar, Upload, AlertCircle, CheckCircle2, QrCode, ShieldAlert } from 'lucide-react';

export default function RegistrationForm({ config }) {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    category: 'MEN_DOUBLES_OPEN',
    p1Name: '',
    p1Phone: '',
    p1Email: '',
    p1Dob: '',
    p1Age: '',
    p1Tshirt: 'L',
    p1BloodGroup: 'O+',
    p2Name: '',
    p2Phone: '',
    p2Email: '',
    p2Dob: '',
    p2Age: '',
    p2Tshirt: 'L',
    p2BloodGroup: 'O+',
    paymentUtr: '',
    paymentAmount: 1000
  });

  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [dupWarning, setDupWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    if (config && config.categories && config.categories.length > 0) {
      setCategories(config.categories);
      const firstCat = config.categories[0];
      setFormData(prev => ({
        ...prev,
        category: firstCat.code || firstCat.name,
        paymentAmount: firstCat.entryFee || 1000
      }));
    }
  }, [config]);

  // Calculate Real Age
  const handleDobChange = (e, player) => {
    const dob = e.target.value;
    let ageStr = '';
    if (dob) {
      const birth = new Date(dob);
      const today = new Date();
      let years = today.getFullYear() - birth.getFullYear();
      let m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        years--;
      }
      ageStr = `${years} years`;
    }

    if (player === 1) {
      setFormData(prev => ({ ...prev, p1Dob: dob, p1Age: ageStr }));
    } else {
      setFormData(prev => ({ ...prev, p2Dob: dob, p2Age: ageStr }));
    }
  };

  // Check duplicate on blur
  const checkDuplicate = async (mobile, email) => {
    if (!mobile && !email) return;
    try {
      const res = await fetch(`/api/registrations/check-duplicate?p1Mobile=${encodeURIComponent(mobile || '')}&p1Email=${encodeURIComponent(email || '')}`);
      const data = await res.json();
      if (data.isDuplicate) {
        setDupWarning(data.message || 'Duplicate registration found for this contact info.');
      } else {
        setDupWarning('');
      }
    } catch (err) {
      console.warn('Dup check error:', err);
    }
  };

  const handleCategoryChange = (e) => {
    const code = e.target.value;
    const match = categories.find(c => c.code === code || c.name === code);
    const fee = match ? match.entryFee : 1000;
    setFormData(prev => ({ ...prev, category: code, paymentAmount: fee }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.p1Name || !formData.p1Phone || !formData.p1Dob || !formData.p1Email) {
      alert('Please fill out all mandatory Player 1 details.');
      return;
    }
    if (!termsAccepted) {
      setShowTermsModal(true);
      alert('Please read and accept the Tournament Rules & Regulations to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        data.append(key, formData[key]);
      });

      if (receiptFile) {
        data.append('paymentScreenshot', receiptFile);
      }

      const response = await fetch('/api/registrations/submit', {
        method: 'POST',
        body: data
      });

      const result = await response.json();
      setSubmitting(false);

      if (result.success) {
        setSuccessResult(result);
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        alert(result.error || 'Submission failed. Please check your data.');
      }
    } catch (err) {
      setSubmitting(false);
      alert('Connection error: ' + err.message);
    }
  };

  const selectedCategoryObj = categories.find(c => (c.code === formData.category || c.name === formData.category)) || {};
  const isDoubles = selectedCategoryObj.type !== 'Singles';

  if (successResult) {
    return (
      <div className="glass-panel" style={{ maxWidth: '640px', margin: '40px auto', padding: '36px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
          <CheckCircle2 size={36} color="#4ade80" />
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', color: '#f8fafc' }}>
          Registration Submitted Successfully!
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
          Your entry has been recorded in the database and is pending organizer approval.
        </p>

        <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px dashed #22c55e', borderRadius: '14px', padding: '20px', marginBottom: '28px' }}>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.08em' }}>Official Tournament Registration ID</span>
          <div className="font-mono" style={{ fontSize: '28px', fontWeight: 800, color: '#4ade80', marginTop: '6px' }}>
            {successResult.regId}
          </div>
          <span style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px', display: 'block' }}>
            Save this ID to check your verification status & court schedule anytime.
          </span>
        </div>

        <button className="btn-primary" onClick={() => { setSuccessResult(null); setFormData(prev => ({ ...prev, p1Name: '', p1Phone: '', p1Email: '' })); }}>
          Register Another Entry
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      {dupWarning && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <ShieldAlert size={20} color="#f87171" />
          <span style={{ color: '#fca5a5', fontSize: '14px' }}>{dupWarning}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc' }}>
            🏆 Official Player Registration
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
            S.P. Badminton Tourney 3 · Live Automated Verification
          </p>
        </div>

        {/* 1. Category Selection */}
        <div style={{ marginBottom: '28px' }}>
          <label className="input-label">Select Championship Category</label>
          <select className="input-field" value={formData.category} onChange={handleCategoryChange} style={{ fontSize: '15px', fontWeight: 600 }}>
            {categories.map(c => (
              <option key={c._id || c.code} value={c.code || c.name} style={{ background: '#121c16', color: '#fff' }}>
                {c.name} — ₹{c.entryFee} / {c.type}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Player 1 Details */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#4ade80', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} /> Player 1 (Lead / Contact)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label className="input-label">Full Name *</label>
              <input type="text" className="input-field" placeholder="e.g. Aarav Sharma" required value={formData.p1Name} onChange={e => setFormData({ ...formData, p1Name: e.target.value })} />
            </div>

            <div>
              <label className="input-label">Mobile Number *</label>
              <input type="tel" className="input-field" placeholder="10-digit mobile" required value={formData.p1Phone} onChange={e => setFormData({ ...formData, p1Phone: e.target.value })} onBlur={() => checkDuplicate(formData.p1Phone, formData.p1Email)} />
            </div>

            <div>
              <label className="input-label">Email Address *</label>
              <input type="email" className="input-field" placeholder="player@example.com" required value={formData.p1Email} onChange={e => setFormData({ ...formData, p1Email: e.target.value })} onBlur={() => checkDuplicate(formData.p1Phone, formData.p1Email)} />
            </div>

            <div>
              <label className="input-label">Date of Birth * (Age: {formData.p1Age || '—'})</label>
              <input type="date" className="input-field" required value={formData.p1Dob} onChange={e => handleDobChange(e, 1)} />
            </div>

            <div>
              <label className="input-label">T-Shirt Size</label>
              <select className="input-field" value={formData.p1Tshirt} onChange={e => setFormData({ ...formData, p1Tshirt: e.target.value })}>
                <option value="S">S (38)</option>
                <option value="M">M (40)</option>
                <option value="L">L (42)</option>
                <option value="XL">XL (44)</option>
                <option value="XXL">XXL (46)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Player 2 Details (If Doubles) */}
        {isDoubles && (
          <div style={{ marginBottom: '28px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#60a5fa', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} /> Player 2 (Doubles Partner)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label className="input-label">Partner Full Name</label>
                <input type="text" className="input-field" placeholder="e.g. Vikram Malhotra" value={formData.p2Name} onChange={e => setFormData({ ...formData, p2Name: e.target.value })} />
              </div>

              <div>
                <label className="input-label">Partner Mobile Number</label>
                <input type="tel" className="input-field" placeholder="10-digit mobile" value={formData.p2Phone} onChange={e => setFormData({ ...formData, p2Phone: e.target.value })} onBlur={() => checkDuplicate(formData.p2Phone, '')} />
              </div>

              <div>
                <label className="input-label">Partner Date of Birth (Age: {formData.p2Age || '—'})</label>
                <input type="date" className="input-field" value={formData.p2Dob} onChange={e => handleDobChange(e, 2)} />
              </div>

              <div>
                <label className="input-label">Partner T-Shirt Size</label>
                <select className="input-field" value={formData.p2Tshirt} onChange={e => setFormData({ ...formData, p2Tshirt: e.target.value })}>
                  <option value="S">S (38)</option>
                  <option value="M">M (40)</option>
                  <option value="L">L (42)</option>
                  <option value="XL">XL (44)</option>
                  <option value="XXL">XXL (46)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 4. Payment & Proof */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#facc15', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={18} /> Entry Fee Payment (₹{formData.paymentAmount})
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
              <img src="/qr_code.png" alt="UPI QR" style={{ width: '150px', height: '150px', objectFit: 'contain', borderRadius: '8px', background: '#fff', padding: '6px' }} />
              <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                UPI: hemantkalra2006-1@okhdfcbank
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Payee: Hemant Kalra · S.P. Badminton</span>
            </div>

            <div>
              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">UPI Reference / UTR Number</label>
                <input type="text" className="input-field font-mono" placeholder="12-digit UTR (e.g. 423456789012)" value={formData.paymentUtr} onChange={e => setFormData({ ...formData, paymentUtr: e.target.value })} />
              </div>

              <div>
                <label className="input-label">Upload Payment Screenshot / Receipt</label>
                <input type="file" accept="image/*" className="input-field" onChange={handleFileChange} />
                {receiptPreview && (
                  <div style={{ marginTop: '8px' }}>
                    <img src={receiptPreview} alt="Receipt Preview" style={{ height: '60px', borderRadius: '6px', border: '1px solid #22c55e' }} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Terms & Conditions Agreement */}
        <div style={{ margin: '20px 0', padding: '14px 18px', borderRadius: '12px', background: termsAccepted ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', border: termsAccepted ? '1.5px solid #22c55e' : '1.5px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#f8fafc', fontWeight: 600 }}>
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#22c55e', cursor: 'pointer' }} />
            I agree to the Tournament Rules &amp; Regulations *
          </label>
          <button type="button" onClick={() => setShowTermsModal(true)} style={{ background: 'transparent', border: 'none', color: '#4ade80', fontSize: '13px', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
            Read Official Rules &rarr;
          </button>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '16px' }}>
          {submitting ? 'Submitting Registration to MongoDB...' : `Complete Registration & Pay ₹${formData.paymentAmount} →`}
        </button>
      </form>

      {/* Official Rules Modal */}
      {showTermsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 100005, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-panel" style={{ maxWidth: '640px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#0d1511', border: '1.5px solid rgba(34,197,94,0.3)', borderRadius: '20px', padding: '24px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#4ade80', margin: 0 }}>🏆 TOURNAMENT RULES &amp; REGULATIONS</h3>
              <button type="button" onClick={() => setShowTermsModal(false)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ overflowY: 'auto', fontSize: '13.5px', lineHeight: 1.6, color: '#cbd5e1', paddingRight: '8px', flex: 1 }}>
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ color: '#4ade80', margin: '0 0 4px', fontSize: '14px' }}>1. Age &amp; Category Eligibility</h4>
                <p style={{ margin: 0 }}>Both players of a pair must belong to the same age category. Original Govt Photo ID (Aadhaar / Driving License / Passport) is mandatory for desk verification.</p>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ color: '#4ade80', margin: '0 0 4px', fontSize: '14px' }}>2. Single Team Entry Policy</h4>
                <p style={{ margin: 0 }}>A player is permitted to register in only one pair / team. Duplicate entries with different partners are strictly disallowed.</p>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ color: '#4ade80', margin: '0 0 4px', fontSize: '14px' }}>3. Entry Fee &amp; Slot Confirmation</h4>
                <p style={{ margin: 0 }}>Registration is confirmed after payment verification. Entry fees are non-refundable once verified and fixtures are generated.</p>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ color: '#4ade80', margin: '0 0 4px', fontSize: '14px' }}>4. Match Format &amp; Scoring Rules</h4>
                <p style={{ margin: 0 }}>Matches follow direct single-elimination knockout format, 21-point BWF rally scoring. Official standard tournament shuttlecocks will be used.</p>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ color: '#4ade80', margin: '0 0 4px', fontSize: '14px' }}>5. Reporting Time</h4>
                <p style={{ margin: 0 }}>Both players must report at least 30 minutes before match time. Failure to report within 15 minutes of match call may result in a walkover.</p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '16px' }}>
              <button type="button" onClick={() => setShowTermsModal(false)} className="btn" style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
              <button type="button" onClick={() => { setTermsAccepted(true); setShowTermsModal(false); }} className="btn-primary" style={{ padding: '8px 20px', borderRadius: '8px' }}>✓ I Agree &amp; Accept Rules</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
