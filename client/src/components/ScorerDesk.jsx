import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Gamepad2, RotateCcw, ArrowLeftRight, Trophy, Flame } from 'lucide-react';

export default function ScorerDesk() {
  const [socket, setSocket] = useState(null);
  const [court, setCourt] = useState(1);
  const [currentMatch, setCurrentMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = io(window.location.origin);
    setSocket(s);

    s.emit('join_court', court);

    s.on('match_state', (match) => {
      setCurrentMatch(match);
      setLoading(false);
    });

    s.on('score_updated', ({ match }) => {
      if (match && match.courtNumber === Number(court)) {
        setCurrentMatch(match);
      }
    });

    return () => s.disconnect();
  }, [court]);

  const handleScore = (team) => {
    if (!socket || !currentMatch) return;
    socket.emit('score_point', {
      matchId: currentMatch.matchId,
      team,
      server: team
    });
  };

  const handleUndo = () => {
    if (!socket || !currentMatch) return;
    socket.emit('undo_point', { matchId: currentMatch.matchId });
  };

  const handleSwitchSides = () => {
    if (!socket || !currentMatch) return;
    socket.emit('switch_sides', { matchId: currentMatch.matchId });
  };

  const handleSetWon = (winnerTeam) => {
    if (!socket || !currentMatch) return;
    if (!confirm(`Confirm set victory for ${winnerTeam === 'team1' ? currentMatch.team1?.name : currentMatch.team2?.name}?`)) return;
    socket.emit('set_won', { matchId: currentMatch.matchId, winnerTeam });
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      {/* Court Selector Header */}
      <div className="glass-panel" style={{ padding: '16px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Gamepad2 size={24} color="#22c55e" />
          <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Live Court Scorer Console</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>Court:</span>
          {[1, 2, 3, 4].map(c => (
            <button
              key={c}
              onClick={() => setCourt(c)}
              className={court === c ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              Court {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Connecting to Court {court} live feed...
        </div>
      ) : !currentMatch ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <h3>No active match currently assigned to Court {court}</h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '6px' }}>
            Assign or schedule matches from the Admin Desk.
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '28px' }}>
          {/* Match Meta Banner */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
            <div>
              <span className="badge badge-live" style={{ marginBottom: '4px' }}>
                <Flame size={12} /> COURT {court} · {currentMatch.round}
              </span>
              <div style={{ fontSize: '14px', color: '#cbd5e1' }}>{currentMatch.category}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>Match Progress</span>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#facc15' }}>
                Set {currentMatch.currentSet || 1} of {currentMatch.maxSets || 3}
              </div>
            </div>
          </div>

          {/* Teams Live Scoreboard Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Team 1 Card */}
            <div
              className="glass-card"
              style={{
                padding: '24px',
                textAlign: 'center',
                border: currentMatch.server === 'team1' ? '2px solid #22c55e' : '1px solid var(--border)',
                background: currentMatch.server === 'team1' ? 'rgba(34,197,94,0.08)' : 'var(--bg-card)'
              }}
            >
              {currentMatch.server === 'team1' && (
                <span className="badge badge-approved" style={{ marginBottom: '8px' }}>🏸 SERVING</span>
              )}
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {currentMatch.team1?.name || 'Team 1'}
              </h3>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
                Sets Won: <strong>{currentMatch.team1?.setsWon ?? 0}</strong>
              </div>

              {/* Huge Score Display */}
              <div className="font-mono" style={{ fontSize: '72px', fontWeight: 900, color: '#4ade80', lineHeight: 1, margin: '14px 0' }}>
                {currentMatch.team1?.score ?? 0}
              </div>

              {/* Point Scoring Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="btn-primary" onClick={() => handleScore('team1')} style={{ flex: 1, justifyContent: 'center', padding: '16px', fontSize: '18px', fontWeight: 800 }}>
                  +1 Point
                </button>
                <button className="btn-secondary" onClick={() => handleSetWon('team1')} style={{ fontSize: '12px', padding: '8px 12px' }} title="Award Set">
                  <Trophy size={14} /> Won Set
                </button>
              </div>
            </div>

            {/* Team 2 Card */}
            <div
              className="glass-card"
              style={{
                padding: '24px',
                textAlign: 'center',
                border: currentMatch.server === 'team2' ? '2px solid #22c55e' : '1px solid var(--border)',
                background: currentMatch.server === 'team2' ? 'rgba(34,197,94,0.08)' : 'var(--bg-card)'
              }}
            >
              {currentMatch.server === 'team2' && (
                <span className="badge badge-approved" style={{ marginBottom: '8px' }}>🏸 SERVING</span>
              )}
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {currentMatch.team2?.name || 'Team 2'}
              </h3>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
                Sets Won: <strong>{currentMatch.team2?.setsWon ?? 0}</strong>
              </div>

              {/* Huge Score Display */}
              <div className="font-mono" style={{ fontSize: '72px', fontWeight: 900, color: '#4ade80', lineHeight: 1, margin: '14px 0' }}>
                {currentMatch.team2?.score ?? 0}
              </div>

              {/* Point Scoring Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button className="btn-primary" onClick={() => handleScore('team2')} style={{ flex: 1, justifyContent: 'center', padding: '16px', fontSize: '18px', fontWeight: 800 }}>
                  +1 Point
                </button>
                <button className="btn-secondary" onClick={() => handleSetWon('team2')} style={{ fontSize: '12px', padding: '8px 12px' }} title="Award Set">
                  <Trophy size={14} /> Won Set
                </button>
              </div>
            </div>
          </div>

          {/* Quick Court Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '18px' }}>
            <button className="btn-secondary" onClick={handleUndo}>
              <RotateCcw size={16} /> Undo Point
            </button>
            <button className="btn-secondary" onClick={handleSwitchSides}>
              <ArrowLeftRight size={16} /> Switch Sides
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
