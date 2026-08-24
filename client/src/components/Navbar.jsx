import React from 'react';
import { Trophy, ShieldCheck, Gamepad2, Tv, UserCheck } from 'lucide-react';

export default function Navbar({ currentTab, setCurrentTab }) {
  const tabs = [
    { id: 'public', label: 'Tournament & Signup', icon: Trophy },
    { id: 'status', label: 'Check Status', icon: UserCheck },
    { id: 'admin', label: 'Admin Desk', icon: ShieldCheck },
    { id: 'scorer', label: 'Live Scorer', icon: Gamepad2 },
    { id: 'tv', label: 'TV Scoreboard', icon: Tv },
  ];

  return (
    <header className="glass-panel" style={{ margin: '16px auto', maxWidth: '1280px', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setCurrentTab('public')}>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #22c55e, #14532d)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(34,197,94,0.4)' }}>
          <Trophy size={22} color="#ffffff" />
        </div>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #86efac)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            S.P. Badminton 3
          </h2>
          <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            Championship 2026 · MongoDB Cloud
          </span>
        </div>
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={isActive ? 'btn-primary' : 'btn-secondary'}
              style={{
                fontSize: '13px',
                padding: '8px 14px',
                border: isActive ? 'none' : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
