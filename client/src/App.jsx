import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import RegistrationForm from './components/RegistrationForm';
import StatusChecker from './components/StatusChecker';
import BracketsViewer from './components/BracketsViewer';
import AdminPortal from './components/AdminPortal';
import ScorerDesk from './components/ScorerDesk';
import TvScoreboard from './components/TvScoreboard';
import { Trophy, Calendar, MapPin, Sparkles, CheckCircle2, Shield } from 'lucide-react';

export default function App() {
  const getInitialTab = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page') || params.get('tab');
      if (pageParam) return pageParam.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if (path.includes('admin')) return 'admin';
      if (path.includes('scorer')) return 'scorer';
      if (path.includes('tv')) return 'tv';
      if (path.includes('status')) return 'status';
      if (path.includes('bracket') || path.includes('fixture')) return 'public';
    } catch (e) {}
    return 'public';
  };

  const [currentTab, setCurrentTabState] = useState(getInitialTab);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const setCurrentTab = (tab) => {
    setCurrentTabState(tab);
    try {
      const url = new URL(window.location);
      if (tab === 'public') {
        url.searchParams.delete('page');
      } else {
        url.searchParams.set('page', tab);
      }
      window.history.pushState({}, '', url);
    } catch (e) {}
  };

  useEffect(() => {
    fetchConfig();
    const handlePopState = () => {
      setCurrentTabState(getInitialTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config/public');
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
      setLoading(false);
    } catch (err) {
      console.warn('Config fetch error:', err);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation Header */}
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Container */}
      <main style={{ flex: 1, paddingBottom: '60px' }}>
        {/* Tab 1: Public Registration & Tournament Info */}
        {currentTab === 'public' && (
          <div>
            {/* Hero Banner */}
            <section style={{ textAlign: 'center', padding: '36px 16px 20px', maxWidth: '860px', margin: '0 auto' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', padding: '6px 16px', borderRadius: '9999px', fontSize: '13px', color: '#86efac', marginBottom: '16px' }}>
                <Sparkles size={14} color="#4ade80" /> {config?.flashAnnouncement || '🏸 Registrations are LIVE for Championship 2026!'}
              </div>

              <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.03em', background: 'linear-gradient(135deg, #ffffff 40%, #86efac 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '12px' }}>
                {config?.tournamentName || 'S.P. Badminton Tourney 3'}
              </h1>

              <p style={{ color: '#94a3b8', fontSize: '16px', maxWidth: '640px', margin: '0 auto 24px' }}>
                {config?.subtitle || 'Annual Open Badminton Championship'} · Synthetic Indoor Courts · Real-time Digital Scoring
              </p>

              {/* Tournament Meta Badges */}
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px', color: '#cbd5e1', fontSize: '14px', marginBottom: '28px' }}>
                <span className="glass-card" style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} color="#4ade80" /> {config?.dates || '29th March 2026'}
                </span>
                <span className="glass-card" style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} color="#60a5fa" /> {config?.venue || 'S.P. Badminton Academy Complex'}
                </span>
                <span className="glass-card" style={{ padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={16} color="#facc15" /> 21-Point BWF Rally Format
                </span>
              </div>
            </section>

            {/* Registration Form */}
            <RegistrationForm config={config} />

            {/* Live Fixtures & Bracket Tracker */}
            <div style={{ marginTop: '40px' }}>
              <BracketsViewer />
            </div>
          </div>
        )}

        {/* Tab 2: Status Checker */}
        {currentTab === 'status' && <StatusChecker />}

        {/* Tab 3: Admin Management Portal */}
        {currentTab === 'admin' && <AdminPortal />}

        {/* Tab 4: Live Court Scorer Desk */}
        {currentTab === 'scorer' && <ScorerDesk />}

        {/* Tab 5: TV Scoreboard Overlay */}
        {currentTab === 'tv' && <TvScoreboard />}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
        <p>© 2026 S.P. Badminton Tourney 3 · Powered by Node.js, Express & MongoDB Database</p>
      </footer>
    </div>
  );
}
