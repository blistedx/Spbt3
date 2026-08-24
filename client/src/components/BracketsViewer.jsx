import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, Flame, CheckCircle, Clock } from 'lucide-react';

export default function BracketsViewer() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const res = await fetch('/api/matches/schedule');
      const data = await res.json();
      if (data.success && data.schedule) {
        setSchedule(data.schedule);
      }
      setLoading(false);
    } catch (err) {
      console.warn('Schedule error:', err);
      setLoading(false);
    }
  };

  const filteredMatches = schedule.filter(m => {
    if (activeCategory === 'ALL') return true;
    return (m.category || '').toLowerCase().includes(activeCategory.toLowerCase());
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px' }}>
      <div className="glass-panel" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={22} color="#eab308" /> Official Match Fixtures & Live Court Tracker
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
              Real-time court updates powered by MongoDB & WebSockets
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['ALL', "Men's Doubles", "Men's Singles"].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={activeCategory === cat ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 14px', fontSize: '13px' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading live fixtures...</div>
        ) : filteredMatches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No matches scheduled yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {filteredMatches.map(m => {
              const isLive = m.status === 'Live' || m.isLive;
              const isDone = m.status === 'Completed';

              return (
                <div
                  key={m._id || m.matchId}
                  className="glass-card"
                  style={{
                    padding: '18px',
                    border: isLive ? '1.5px solid rgba(239,68,68,0.5)' : '1px solid var(--border)',
                    boxShadow: isLive ? '0 0 20px rgba(239,68,68,0.15)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#4ade80' }}>
                      Court {m.courtNumber} · {m.round}
                    </span>
                    {isLive ? (
                      <span className="badge badge-live"><Flame size={12} /> LIVE NOW</span>
                    ) : isDone ? (
                      <span className="badge badge-approved"><CheckCircle size={12} /> Finished</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                        <Clock size={12} /> {m.scheduledTime || 'Scheduled'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: m.winner === 'team1' ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                      <span style={{ fontWeight: m.winner === 'team1' ? 700 : 500, color: m.winner === 'team1' ? '#4ade80' : '#f8fafc' }}>
                        {m.team1?.name || 'Team 1'}
                      </span>
                      <span className="font-mono" style={{ fontSize: '16px', fontWeight: 800, color: isLive ? '#22c55e' : '#fff' }}>
                        {m.team1?.score ?? 0}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: m.winner === 'team2' ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                      <span style={{ fontWeight: m.winner === 'team2' ? 700 : 500, color: m.winner === 'team2' ? '#4ade80' : '#f8fafc' }}>
                        {m.team2?.name || 'Team 2'}
                      </span>
                      <span className="font-mono" style={{ fontSize: '16px', fontWeight: 800, color: isLive ? '#22c55e' : '#fff' }}>
                        {m.team2?.score ?? 0}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{m.category}</span>
                    <span>Set {m.currentSet || 1} of {m.maxSets || 3}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
