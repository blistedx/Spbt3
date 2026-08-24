import React, { useState } from 'react';
import { Search, CheckCircle2, Clock, XCircle, FileText } from 'lucide-react';

export default function StatusChecker() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/registrations/status?query=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setLoading(false);

      if (data.success && data.registration) {
        setResult(data.registration);
      } else {
        setError(data.message || 'No registration found matching this query.');
      }
    } catch (err) {
      setLoading(false);
      setError('Connection failed: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    switch ((status || '').toUpperCase()) {
      case 'APPROVED':
        return <span className="badge badge-approved"><CheckCircle2 size={14} /> Approved & Confirmed</span>;
      case 'REJECTED':
        return <span className="badge badge-rejected"><XCircle size={14} /> Rejected</span>;
      default:
        return <span className="badge badge-pending"><Clock size={14} /> Pending Verification</span>;
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '16px' }}>
      <div className="glass-panel" style={{ padding: '28px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px', color: '#f8fafc' }}>
          🔍 Player Registration Status Lookup
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
          Enter your Registration ID (e.g. <code style={{ color: '#4ade80' }}>SP3-2292</code>), Mobile number, or Email.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="SP3-XXXX or 10-digit Phone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ fontSize: '15px' }}
          />
          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}>
            {loading ? 'Checking...' : <><Search size={16} /> Search</>}
          </button>
        </form>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '14px', color: '#fca5a5', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <div>
                <span className="font-mono" style={{ fontSize: '18px', fontWeight: 800, color: '#4ade80' }}>
                  {result.regId}
                </span>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  {result.categoryName || result.category}
                </div>
              </div>
              {getStatusBadge(result.status)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>Player 1</span>
                <strong>{result.p1Name}</strong> ({result.p1Phone})
              </div>

              {result.p2Name && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>Player 2</span>
                  <strong>{result.p2Name}</strong>
                </div>
              )}

              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>Payment Fee</span>
                <span style={{ color: '#facc15', fontWeight: 700 }}>₹{result.paymentAmount}</span>
              </div>

              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>Registered On</span>
                <span style={{ fontSize: '13px' }}>
                  {result.createdAt || result.timestamp
                    ? new Date(result.createdAt || result.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                    : 'Recent'}
                </span>
              </div>
            </div>

            {result.rejectionReason && (
              <div style={{ marginTop: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px', color: '#fca5a5', fontSize: '13px' }}>
                <strong>Rejection Note:</strong> {result.rejectionReason}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
