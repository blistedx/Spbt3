import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Flame, Trophy, Maximize2 } from 'lucide-react';

export default function TvScoreboard() {
  const [match, setMatch] = useState(null);
  const [court, setCourt] = useState(1);

  useEffect(() => {
    const s = io(window.location.origin);
    s.emit('join_court', court);

    s.on('match_state', (data) => {
      setMatch(data);
    });

    s.on('tv_score_update', (data) => {
      if (data && data.courtNumber === Number(court)) {
        setMatch(data);
      }
    });

    s.on('score_updated', ({ match: updatedMatch }) => {
      if (updatedMatch && updatedMatch.courtNumber === Number(court)) {
        setMatch(updatedMatch);
      }
    });

    return () => s.disconnect();
  }, [court]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      {/* Top Floating Controls */}
      <div style={{ position: 'fixed', top: '16px', right: '20px', zIndex: 100, display: 'flex', gap: '8px' }}>
        {[1, 2, 3, 4].map(c => (
          <button
            key={c}
            onClick={() => setCourt(c)}
            className={court === c ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            Court {c}
          </button>
        ))}
        <button className="btn-secondary" onClick={toggleFullscreen} style={{ padding: '6px 12px' }}>
          <Maximize2 size={14} /> Fullscreen
        </button>
      </div>

      {!match ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Court {court} · TV Scoreboard Live</h2>
          <p style={{ color: '#94a3b8', marginTop: '8px' }}>Awaiting live match sync from Scorer Desk...</p>
        </div>
      ) : (
        <div style={{ width: '100%', maxWidth: '1100px' }}>
          {/* Main Broadcast Header Overlay */}
          <div style={{ background: 'linear-gradient(90deg, #123f26, #0b120e)', borderTop: '3px solid #22c55e', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '16px 16px 0 0', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span className="badge badge-live" style={{ fontSize: '13px', padding: '6px 14px' }}>
                <Flame size={14} /> LIVE · COURT {match.courtNumber}
              </span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                {match.category} · {match.round}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: '#facc15', fontWeight: 700 }}>
                SET {match.currentSet || 1} OF {match.maxSets || 3}
              </span>
            </div>
          </div>

          {/* Broadcast Score Display Banner */}
          <div style={{ background: 'rgba(10, 17, 12, 0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0 0 16px 16px', padding: '36px 40px', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '30px', alignItems: 'center' }}>
              {/* Team 1 Box */}
              <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
                    {match.team1?.name || 'Team 1'}
                  </h2>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
                    {[...Array(match.team1?.setsWon || 0)].map((_, i) => (
                      <span key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
                    ))}
                  </div>
                </div>

                <div className="font-mono" style={{ fontSize: '88px', fontWeight: 900, color: '#4ade80', minWidth: '120px', textAlign: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '14px', padding: '4px 16px', border: match.server === 'team1' ? '2px solid #22c55e' : '1px solid var(--border)' }}>
                  {match.team1?.score ?? 0}
                </div>
              </div>

              {/* VS Divider */}
              <div style={{ textAlign: 'center', color: '#64748b', fontWeight: 800, fontSize: '18px' }}>
                VS
              </div>

              {/* Team 2 Box */}
              <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '24px' }}>
                <div className="font-mono" style={{ fontSize: '88px', fontWeight: 900, color: '#4ade80', minWidth: '120px', textAlign: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '14px', padding: '4px 16px', border: match.server === 'team2' ? '2px solid #22c55e' : '1px solid var(--border)' }}>
                  {match.team2?.score ?? 0}
                </div>

                <div>
                  <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
                    {match.team2?.name || 'Team 2'}
                  </h2>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-start', marginTop: '6px' }}>
                    {[...Array(match.team2?.setsWon || 0)].map((_, i) => (
                      <span key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Match Winner Banner if completed */}
            {match.winner && match.winner !== 'none' && (
              <div style={{ marginTop: '28px', background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(34,197,94,0.2))', border: '1px solid #eab308', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '14px', color: '#fde047', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🏆 Match Winner</span>
                <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', marginTop: '4px' }}>
                  {match.winnerName || (match.winner === 'team1' ? match.team1?.name : match.team2?.name)}
                </h3>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
