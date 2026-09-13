/**
 * S.P. Badminton Tourney 3 · Neon PostgreSQL Data Storage Engine
 * 100% Online Relational Database Storage — Zero Local File or Excel Dependencies.
 */
const { query } = require('./postgres');

// Default initial fallbacks while initial sync completes
const DEFAULT_SETTINGS = {
  tournament_name: "S.P. BADMINTON TOURNEY 3",
  tournament_subtitle: "Men's Doubles · Knockout · Suryodaya Park",
  venue: "Suryodaya Park Court",
  dates: "28–30 Aug 2026",
  flash_message: "Registrations are OPEN! Limited team slots available.",
  flash_active: "NO",
  registration_status: "CLOSED",
  admin_pin: "9903",
  upi_id: "blistedx@okhdfcbank",
  upi_name: "S.P. Badminton Club",
  upi_qr_url: "qr_code.png",
  logo_url: "/logo.png",
  entry_fee: "1000",
  stat_categories: "02",
  stat_players: "50+",
  stat_days: "03",
  categories: [
    { name: "Below 35", status: "INACTIVE", fee: "1000", maxPairs: "32" },
    { name: "Above 35", status: "INACTIVE", fee: "1000", maxPairs: "32" }
  ]
};

const DEFAULT_LIVE_MATCH = {
  court_id: 'Court 1',
  matchId: '',
  p1Name: '',
  p2Name: '',
  category: 'Below 35',
  targetPoints: 21,
  score: '0-0',
  status: 'NO_LIVE_MATCH',
  isLive: false,
  isComplete: true,
  server: 1,
  currentGame: 0,
  games: [[0, 0], [0, 0], [0, 0]],
  setsWon: [0, 0],
  interval: { active: false, secondsLeft: 0, intervalTakenForGame: [false, false, false] },
  rallyLog: [],
  updatedAt: Date.now()
};

// In-Memory Synchronized Hot Cache (populated and updated with Neon PostgreSQL)
let settingsCache = { ...DEFAULT_SETTINGS };
let registrationsCache = [];
let matchesCache = [];
let financialsCache = { expenses: [], sponsors: [] };
let liveMatchCache = { ...DEFAULT_LIVE_MATCH };
let pushSubscriptionsCache = [];

async function syncFromDb() {
  try {
    // Execute all table queries concurrently via Promise.all for 8x faster load
    const [setRes, regRes, matchRes, liveRes, expRes, sponRes, pushRes] = await Promise.all([
      query("SELECT * FROM settings WHERE id = 'current' LIMIT 1"),
      query("SELECT * FROM registrations ORDER BY created_at DESC"),
      query("SELECT * FROM matches ORDER BY created_at ASC"),
      query("SELECT * FROM live_match WHERE court_id = 'Court 1' LIMIT 1"),
      query("SELECT * FROM expenses ORDER BY created_at DESC"),
      query("SELECT * FROM sponsors ORDER BY created_at DESC"),
      query("SELECT * FROM push_subscriptions ORDER BY created_at DESC").catch(() => ({ rows: [] }))
    ]);

    // 1. Settings
    if (setRes.rows.length > 0) {
      const r = setRes.rows[0];
      settingsCache = {
        tournament_name: r.tournament_name,
        tournament_subtitle: r.tournament_subtitle,
        venue: r.venue,
        dates: r.dates,
        flash_message: r.flash_message,
        flash_active: r.flash_active,
        registration_status: r.registration_status,
        admin_pin: r.admin_pin,
        upi_id: r.upi_id,
        upi_name: r.upi_name,
        upi_qr_url: r.upi_qr_url,
        logo_url: r.logo_url || "/logo.png",
        entry_fee: r.entry_fee,
        stat_categories: r.stat_categories,
        stat_players: r.stat_players,
        stat_days: r.stat_days,
        categories: typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || DEFAULT_SETTINGS.categories)
      };
    }

    // 2. Registrations
    registrationsCache = regRes.rows.map(r => ({
      regId: r.reg_id,
      category: r.category,
      p1Name: r.p1_name,
      p1Phone: r.p1_phone,
      p1Email: r.p1_email,
      p1Dob: r.p1_dob,
      p1Tshirt: r.p1_tshirt,
      p1IdType: r.p1_id_type,
      p1IdNumber: r.p1_id_number,
      p2Name: r.p2_name,
      p2Phone: r.p2_phone,
      p2Email: r.p2_email,
      p2Dob: r.p2_dob,
      p2Tshirt: r.p2_tshirt,
      p2IdType: r.p2_id_type,
      p2IdNumber: r.p2_id_number,
      upiUtr: r.upi_utr,
      paymentScreenshotUrl: r.payment_screenshot_url,
      paymentStatus: r.payment_status,
      status: r.status,
      adminNotes: r.admin_notes,
      createdAt: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date().toISOString(),
      ...(r.raw_payload || {})
    }));

    // 3. Matches
    matchesCache = matchRes.rows.map(m => {
      const raw = m.raw_payload || {};
      const p1 = raw.pair1 || raw.p1Name || m.team1_name || m.team1_p1 || 'Team 1';
      const p2 = raw.pair2 || raw.p2Name || m.team2_name || m.team2_p1 || 'Team 2';
      return {
        matchId: m.match_id,
        id: m.match_id,
        category: m.category || 'Below 35',
        round: m.round || 'Round of 32',
        court: m.court || 'Court 1',
        team1P1: m.team1_p1,
        team1P2: m.team1_p2,
        team2P1: m.team2_p1,
        team2P2: m.team2_p2,
        team1Name: m.team1_name || p1,
        team2Name: m.team2_name || p2,
        p1Name: p1,
        p2Name: p2,
        pair1: p1,
        pair2: p2,
        scheduledTime: m.scheduled_time || raw.time || '05:00 PM',
        time: raw.time || m.scheduled_time || '05:00 PM',
        date: raw.date || '',
        status: m.status || 'SCHEDULED',
        winner: m.winner || '',
        scores: typeof m.scores === 'string' ? JSON.parse(m.scores) : (m.scores || []),
        sets: typeof m.sets === 'string' ? JSON.parse(m.sets) : (m.sets || []),
        ...raw
      };
    });

    // 4. Live Match
    if (liveRes.rows.length > 0) {
      const l = liveRes.rows[0];
      liveMatchCache = {
        court_id: l.court_id,
        matchId: l.match_id,
        category: l.category,
        p1Name: l.p1_name,
        p2Name: l.p2_name,
        targetPoints: l.target_points,
        score: l.score,
        status: l.status,
        isLive: l.is_live,
        isComplete: l.is_complete,
        server: l.server,
        currentGame: l.current_game,
        games: typeof l.games === 'string' ? JSON.parse(l.games) : (l.games || [[0, 0], [0, 0], [0, 0]]),
        setsWon: typeof l.sets_won === 'string' ? JSON.parse(l.sets_won) : (l.sets_won || [0, 0]),
        interval: typeof l.interval === 'string' ? JSON.parse(l.interval) : (l.interval || { active: false, secondsLeft: 0, intervalTakenForGame: [false, false, false] }),
        rallyLog: typeof l.rally_log === 'string' ? JSON.parse(l.rally_log) : (l.rally_log || []),
        customMessage: l.custom_message || '',
        updatedAt: l.updated_at ? new Date(l.updated_at).getTime() : Date.now()
      };
    }

    // 5. Financials
    financialsCache = {
      expenses: (expRes.rows || []).map(e => ({
        id: e.id,
        date: e.date,
        category: e.category,
        item: e.item,
        amount: Number(e.amount),
        paidTo: e.paid_to,
        paymentMode: e.payment_mode,
        status: e.status
      })),
      sponsors: (sponRes.rows || []).map(s => ({
        id: s.id,
        name: s.name,
        tier: s.tier,
        contact: s.contact,
        promisedAmount: Number(s.promised_amount),
        receivedAmount: Number(s.received_amount),
        paymentMode: s.payment_mode,
        status: s.status
      }))
    };

    // 6. Push Subscriptions
    pushSubscriptionsCache = (pushRes.rows || []).map(p => ({
      endpoint: p.endpoint,
      keys: { p256dh: p.p256dh, auth: p.auth },
      p256dh: p.p256dh,
      auth: p.auth,
      audience_type: p.audience_type || 'ALL',
      user_identifier: p.user_identifier || '',
      user_agent: p.user_agent || '',
      updated_at: p.updated_at ? p.updated_at.toISOString() : new Date().toISOString()
    }));

    dataStore.isSynced = true;
    dataStore.lastSyncTime = Date.now();
    console.log(`[PostgreSQL DataStore] Synced from Neon DB: ${registrationsCache.length} regs, ${matchesCache.length} matches, ${financialsCache.expenses.length} expenses, ${pushSubscriptionsCache.length} push subs.`);
  } catch (err) {
    console.warn('[PostgreSQL DataStore] Sync warning:', err.message);
  }
}

// Auto-sync on startup
syncFromDb().catch(() => {});

const dataStore = {
  isSynced: false,
  lastSyncTime: 0,
  syncFromDb,

  // SETTINGS
  getSettings() {
    return { ...settingsCache };
  },
  async getSettingsAsync() {
    try {
      await syncFromDb();
    } catch(e) {}
    return { ...settingsCache };
  },
  saveSettings(newSettings) {
    settingsCache = { ...settingsCache, ...newSettings };

    query(`
      INSERT INTO settings (id, tournament_name, tournament_subtitle, venue, dates, flash_message, flash_active, registration_status, admin_pin, upi_id, upi_name, upi_qr_url, logo_url, entry_fee, stat_categories, stat_players, stat_days, categories, updated_at)
      VALUES ('current', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      ON CONFLICT (id) DO UPDATE SET
        tournament_name = EXCLUDED.tournament_name,
        tournament_subtitle = EXCLUDED.tournament_subtitle,
        venue = EXCLUDED.venue,
        dates = EXCLUDED.dates,
        flash_message = EXCLUDED.flash_message,
        flash_active = EXCLUDED.flash_active,
        registration_status = EXCLUDED.registration_status,
        admin_pin = EXCLUDED.admin_pin,
        upi_id = EXCLUDED.upi_id,
        upi_name = EXCLUDED.upi_name,
        upi_qr_url = EXCLUDED.upi_qr_url,
        logo_url = EXCLUDED.logo_url,
        entry_fee = EXCLUDED.entry_fee,
        stat_categories = EXCLUDED.stat_categories,
        stat_players = EXCLUDED.stat_players,
        stat_days = EXCLUDED.stat_days,
        categories = EXCLUDED.categories,
        updated_at = NOW()
    `, [
      settingsCache.tournament_name,
      settingsCache.tournament_subtitle,
      settingsCache.venue,
      settingsCache.dates,
      settingsCache.flash_message,
      settingsCache.flash_active,
      settingsCache.registration_status,
      settingsCache.admin_pin,
      settingsCache.upi_id,
      settingsCache.upi_name,
      settingsCache.upi_qr_url,
      settingsCache.logo_url || "/logo.png",
      settingsCache.entry_fee,
      settingsCache.stat_categories,
      settingsCache.stat_players,
      settingsCache.stat_days,
      JSON.stringify(settingsCache.categories || [])
    ]).catch(e => console.error('[PostgreSQL] saveSettings error:', e.message));

    return { ...settingsCache };
  },

  // REGISTRATIONS
  getRegistrations() {
    return [...registrationsCache];
  },
  saveRegistrations(regs) {
    registrationsCache = Array.isArray(regs) ? regs : [];
    return [...registrationsCache];
  },
  addOrUpdateRegistration(reg) {
    const regId = reg.regId || `REG-${Date.now()}`;
    const idx = registrationsCache.findIndex(r => r.regId === regId);
    if (idx >= 0) {
      registrationsCache[idx] = { ...registrationsCache[idx], ...reg, updatedAt: new Date().toISOString() };
    } else {
      registrationsCache.unshift({ ...reg, regId, createdAt: reg.createdAt || new Date().toISOString() });
    }

    query(`
      INSERT INTO registrations (
        reg_id, category, p1_name, p1_phone, p1_email, p1_dob, p1_tshirt, p1_id_type, p1_id_number,
        p2_name, p2_phone, p2_email, p2_dob, p2_tshirt, p2_id_type, p2_id_number,
        upi_utr, payment_screenshot_url, payment_status, status, admin_notes, raw_payload, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, NOW()
      )
      ON CONFLICT (reg_id) DO UPDATE SET
        category = EXCLUDED.category,
        p1_name = EXCLUDED.p1_name,
        p1_phone = EXCLUDED.p1_phone,
        p1_email = EXCLUDED.p1_email,
        p1_dob = EXCLUDED.p1_dob,
        p1_tshirt = EXCLUDED.p1_tshirt,
        p1_id_type = EXCLUDED.p1_id_type,
        p1_id_number = EXCLUDED.p1_id_number,
        p2_name = EXCLUDED.p2_name,
        p2_phone = EXCLUDED.p2_phone,
        p2_email = EXCLUDED.p2_email,
        p2_dob = EXCLUDED.p2_dob,
        p2_tshirt = EXCLUDED.p2_tshirt,
        p2_id_type = EXCLUDED.p2_id_type,
        p2_id_number = EXCLUDED.p2_id_number,
        upi_utr = EXCLUDED.upi_utr,
        payment_screenshot_url = EXCLUDED.payment_screenshot_url,
        payment_status = EXCLUDED.payment_status,
        status = EXCLUDED.status,
        admin_notes = EXCLUDED.admin_notes,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
    `, [
      regId,
      reg.category || 'Below 35',
      reg.p1Name || reg.p1_name || '',
      reg.p1Phone || reg.p1_phone || '',
      reg.p1Email || reg.p1_email || '',
      reg.p1Dob || reg.p1_dob || '',
      reg.p1Tshirt || reg.p1_tshirt || '',
      reg.p1IdType || reg.p1_id_type || '',
      reg.p1IdNumber || reg.p1_id_number || '',
      reg.p2Name || reg.p2_name || '',
      reg.p2Phone || reg.p2_phone || '',
      reg.p2Email || reg.p2_email || '',
      reg.p2Dob || reg.p2_dob || '',
      reg.p2Tshirt || reg.p2_tshirt || '',
      reg.p2IdType || reg.p2_id_type || '',
      reg.p2IdNumber || reg.p2_id_number || '',
      reg.upiUtr || reg.upi_utr || '',
      reg.paymentScreenshotUrl || reg.payment_screenshot_url || '',
      reg.paymentStatus || reg.payment_status || 'PENDING',
      reg.status || 'PENDING',
      reg.adminNotes || reg.admin_notes || '',
      JSON.stringify(reg)
    ]).catch(e => console.error('[PostgreSQL] addOrUpdateRegistration error:', e.message));

    return reg;
  },
  updateRegistrationStatus(regId, newStatus, adminNotes) {
    const reg = registrationsCache.find(r => r.regId === regId);
    if (reg) {
      reg.status = newStatus;
      if (adminNotes !== undefined) reg.adminNotes = adminNotes;
      reg.updatedAt = new Date().toISOString();

      query(`
        UPDATE registrations
        SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
        WHERE reg_id = $3
      `, [newStatus, adminNotes !== undefined ? adminNotes : null, regId])
      .catch(e => console.error('[PostgreSQL] updateRegistrationStatus error:', e.message));

      return reg;
    }
    return null;
  },
  deleteRegistration(regId) {
    registrationsCache = registrationsCache.filter(r => r.regId !== regId);
    query("DELETE FROM registrations WHERE reg_id = $1", [regId])
      .catch(e => console.error('[PostgreSQL] deleteRegistration error:', e.message));
    return true;
  },

  // MATCHES & FIXTURES
  getMatches() {
    return [...matchesCache];
  },
  saveMatches(matches) {
    const list = Array.isArray(matches) ? matches : [];
    matchesCache = list.map(m => ({
      ...m,
      matchId: m.matchId || m.id,
      id: m.matchId || m.id
    }));
    // Persist every match to PostgreSQL database
    for (const m of list) {
      if (m && (m.matchId || m.id)) {
        this.addOrUpdateMatch(m);
      }
    }
    return [...matchesCache];
  },
  addOrUpdateMatch(match) {
    const matchId = match.matchId || match.id || '';
    if (!matchId || matchId === 'Court 1' || matchId === 'Court 2') {
      return null;
    }
    const idx = matchesCache.findIndex(m => (m.matchId === matchId || m.id === matchId));
    let existing = idx >= 0 ? matchesCache[idx] : null;

    // Resolve accurate tournament round (preventing fallback 'Round 1' from erasing 'Round of 32')
    let resolvedRound = match.round;
    if (!resolvedRound || resolvedRound === 'Round 1') {
      if (existing && existing.round && existing.round !== 'Round 1') {
        resolvedRound = existing.round;
      } else if (matchId.includes('R16')) {
        resolvedRound = 'Round of 16';
      } else if (matchId.includes('QF')) {
        resolvedRound = 'Quarter-Final';
      } else if (matchId.includes('SF')) {
        resolvedRound = 'Semi-Final';
      } else if (matchId.includes('FN') || matchId.includes('FINAL')) {
        resolvedRound = 'Grand Final 🏆';
      } else if (/^[AB]-M\d+$/i.test(matchId) || matchId.includes('R32')) {
        resolvedRound = 'Round of 32';
      } else {
        resolvedRound = 'Round of 32';
      }
    }

    let updatedObj;
    if (idx >= 0) {
      const preserveCompleted = existing.status === 'COMPLETED' && (match.status === 'UPCOMING' || !match.status);
      updatedObj = {
        ...existing,
        ...match,
        round: resolvedRound,
        status: preserveCompleted ? existing.status : (match.status || existing.status),
        winner: preserveCompleted ? existing.winner : (match.winner || existing.winner),
        scores: preserveCompleted ? existing.scores : (match.scores || existing.scores),
        sets: preserveCompleted ? existing.sets : (match.sets || existing.sets),
        matchId,
        id: matchId,
        updatedAt: new Date().toISOString()
      };
      matchesCache[idx] = updatedObj;
    } else {
      updatedObj = { ...match, round: resolvedRound, matchId, id: matchId, updatedAt: new Date().toISOString() };
      matchesCache.push(updatedObj);
    }

    // Auto-advance tournament winner to next knockout match slot when completed!
    if (updatedObj.status === 'COMPLETED' && updatedObj.winner) {
      this.advanceMatchWinner(updatedObj);
    }

    query(`
      INSERT INTO matches (
        match_id, category, round, court, team1_p1, team1_p2, team2_p1, team2_p2,
        team1_name, team2_name, scheduled_time, status, winner, scores, sets, raw_payload, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, NOW()
      )
      ON CONFLICT (match_id) DO UPDATE SET
        category = EXCLUDED.category,
        round = CASE 
          WHEN EXCLUDED.round IS NOT NULL AND EXCLUDED.round != '' AND EXCLUDED.round != 'Round 1' THEN EXCLUDED.round 
          WHEN matches.round IS NOT NULL AND matches.round != '' AND matches.round != 'Round 1' THEN matches.round 
          ELSE EXCLUDED.round 
        END,
        court = EXCLUDED.court,
        team1_p1 = EXCLUDED.team1_p1,
        team1_p2 = EXCLUDED.team1_p2,
        team2_p1 = EXCLUDED.team2_p1,
        team2_p2 = EXCLUDED.team2_p2,
        team1_name = EXCLUDED.team1_name,
        team2_name = EXCLUDED.team2_name,
        scheduled_time = EXCLUDED.scheduled_time,
        status = CASE WHEN matches.status = 'COMPLETED' AND EXCLUDED.status = 'UPCOMING' THEN matches.status ELSE EXCLUDED.status END,
        winner = CASE WHEN matches.status = 'COMPLETED' AND (EXCLUDED.winner IS NULL OR EXCLUDED.winner = '') THEN matches.winner ELSE EXCLUDED.winner END,
        scores = CASE WHEN matches.status = 'COMPLETED' AND (EXCLUDED.scores IS NULL OR EXCLUDED.scores::text = '[]' OR EXCLUDED.scores::text = '[[0,0],[0,0],[0,0]]') THEN matches.scores ELSE EXCLUDED.scores END,
        sets = CASE WHEN matches.status = 'COMPLETED' AND (EXCLUDED.sets IS NULL OR EXCLUDED.sets::text = '[]' OR EXCLUDED.sets::text = '[0,0]') THEN matches.sets ELSE EXCLUDED.sets END,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
    `, [
      matchId,
      updatedObj.category || 'Below 35',
      resolvedRound,
      updatedObj.court || 'Court 1',
      updatedObj.team1P1 || updatedObj.team1_p1 || updatedObj.p1Name || updatedObj.player1 || updatedObj.pair1 || '',
      updatedObj.team1P2 || updatedObj.team1_p2 || '',
      updatedObj.team2P1 || updatedObj.team2_p1 || updatedObj.p2Name || updatedObj.player2 || updatedObj.pair2 || '',
      updatedObj.team2P2 || updatedObj.team2_p2 || '',
      updatedObj.team1Name || updatedObj.team1_name || updatedObj.p1Name || updatedObj.pair1 || updatedObj.team1 || '',
      updatedObj.team2Name || updatedObj.team2_name || updatedObj.p2Name || updatedObj.pair2 || updatedObj.team2 || '',
      updatedObj.scheduledTime || updatedObj.scheduled_time || updatedObj.time || updatedObj.date || '',
      updatedObj.status || 'SCHEDULED',
      updatedObj.winner || '',
      JSON.stringify(updatedObj.scores || updatedObj.games || []),
      JSON.stringify(updatedObj.sets || updatedObj.setsWon || []),
      JSON.stringify(updatedObj)
    ]).catch(e => console.error('[PostgreSQL] addOrUpdateMatch error:', e.message));

    return updatedObj;
  },
  advanceMatchWinner(completedMatch) {
    if (!completedMatch) return null;
    const matchId = completedMatch.matchId || completedMatch.id;
    const category = completedMatch.category || 'Below 35';
    const rawWinner = completedMatch.winner || '';
    if (!matchId || !rawWinner) return null;

    // Resolve full winning team string
    let winnerTeam = String(rawWinner).trim();
    if (winnerTeam === '1' || winnerTeam === 'team1') {
      winnerTeam = completedMatch.pair1 || completedMatch.team1Name || completedMatch.p1Name || '';
    } else if (winnerTeam === '2' || winnerTeam === 'team2') {
      winnerTeam = completedMatch.pair2 || completedMatch.team2Name || completedMatch.p2Name || '';
    }
    if (!winnerTeam) return null;

    // Determine target next match and slot
    let nextMatchId = completedMatch.nextMatchId;
    let nextMatchSlot = completedMatch.nextMatchSlot ? Number(completedMatch.nextMatchSlot) : 0;

    if (!nextMatchId) {
      const isBelow = category.toLowerCase().includes('below') || matchId.startsWith('B-');
      const prefix = isBelow ? 'B-' : 'A-';
      const numMatch = matchId.match(/\d+$/);
      const matchNum = numMatch ? parseInt(numMatch[0], 10) : 0;
      const roundStr = (completedMatch.round || '').toLowerCase();

      if (roundStr.includes('32') || matchId.includes('R32') || matchId.startsWith('B-M') || matchId.startsWith('A-M')) {
        if (matchNum >= 1 && matchNum <= 16) {
          const nextNum = Math.ceil(matchNum / 2);
          nextMatchId = `${prefix}R16-M${String(nextNum).padStart(2, '0')}`;
          nextMatchSlot = (matchNum % 2 === 1) ? 1 : 2;
        }
      } else if (roundStr.includes('16') || matchId.includes('R16')) {
        if (matchNum >= 1 && matchNum <= 8) {
          const nextNum = Math.ceil(matchNum / 2);
          nextMatchId = `${prefix}QF-M${String(nextNum).padStart(2, '0')}`;
          nextMatchSlot = (matchNum % 2 === 1) ? 1 : 2;
        }
      } else if (roundStr.includes('quarter') || matchId.includes('QF')) {
        if (matchNum >= 1 && matchNum <= 4) {
          const nextNum = Math.ceil(matchNum / 2);
          nextMatchId = `${prefix}SF-M${String(nextNum).padStart(2, '0')}`;
          nextMatchSlot = (matchNum % 2 === 1) ? 1 : 2;
        }
      } else if (roundStr.includes('semi') || matchId.includes('SF')) {
        if (matchNum >= 1 && matchNum <= 2) {
          nextMatchId = `${prefix}FN-M01`;
          nextMatchSlot = (matchNum % 2 === 1) ? 1 : 2;
        }
      }
    }

    if (!nextMatchId || !nextMatchSlot) {
      return null;
    }

    const targetIdx = matchesCache.findIndex(m => (m.matchId === nextMatchId || m.id === nextMatchId));
    if (targetIdx >= 0) {
      const target = { ...matchesCache[targetIdx] };
      if (nextMatchSlot === 1) {
        target.pair1 = winnerTeam;
        target.team1Name = winnerTeam;
        target.team1P1 = winnerTeam;
        target.p1Name = winnerTeam;
      } else {
        target.pair2 = winnerTeam;
        target.team2Name = winnerTeam;
        target.team2P1 = winnerTeam;
        target.p2Name = winnerTeam;
      }
      target.updatedAt = new Date().toISOString();
      matchesCache[targetIdx] = target;

      // Update in PostgreSQL
      query(`
        UPDATE matches SET
          team1_p1 = $1, team1_name = $2,
          team2_p1 = $3, team2_name = $4,
          raw_payload = raw_payload || $5::jsonb,
          updated_at = NOW()
        WHERE match_id = $6
      `, [
        target.team1P1 || target.pair1 || '',
        target.team1Name || target.pair1 || '',
        target.team2P1 || target.pair2 || '',
        target.team2Name || target.pair2 || '',
        JSON.stringify({ pair1: target.pair1, pair2: target.pair2, team1Name: target.team1Name, team2Name: target.team2Name }),
        nextMatchId
      ]).catch(e => console.error('[PostgreSQL] advanceMatchWinner DB error:', e.message));

      console.log(`🏆 [Tournament Engine] Advanced winner '${winnerTeam}' to ${nextMatchId} (Slot ${nextMatchSlot})!`);
      return target;
    }
    return null;
  },
  deleteMatch(matchId) {
    matchesCache = matchesCache.filter(m => m.matchId !== matchId && m.id !== matchId);
    query("DELETE FROM matches WHERE match_id = $1", [matchId])
      .catch(e => console.error('[PostgreSQL] deleteMatch error:', e.message));
    return true;
  },

  // LIVE MATCH (REALTIME)
  getLiveMatch() {
    return { ...liveMatchCache };
  },
  setLiveMatchCache(updated) {
    if (updated) {
      liveMatchCache = { ...liveMatchCache, ...updated };
    }
    return { ...liveMatchCache };
  },
  async getLiveMatchAsync() {
    try {
      const res = await query("SELECT * FROM live_match WHERE court_id = 'Court 1' LIMIT 1");
      if (res.rows && res.rows.length > 0) {
        const l = res.rows[0];
        const dbTs = l.updated_at ? new Date(l.updated_at).getTime() : Date.now();
        liveMatchCache = {
          court_id: l.court_id,
          matchId: l.match_id,
          category: l.category,
          p1Name: l.p1_name,
          p2Name: l.p2_name,
          targetPoints: l.target_points,
          score: l.score,
          status: l.status,
          isLive: l.is_live,
          isComplete: l.is_complete,
          server: l.server,
          currentGame: l.current_game,
          games: typeof l.games === 'string' ? JSON.parse(l.games) : (l.games || [[0, 0], [0, 0], [0, 0]]),
          setsWon: typeof l.sets_won === 'string' ? JSON.parse(l.sets_won) : (l.sets_won || [0, 0]),
          interval: typeof l.interval === 'string' ? JSON.parse(l.interval) : (l.interval || { active: false, secondsLeft: 0, intervalTakenForGame: [false, false, false] }),
          rallyLog: typeof l.rally_log === 'string' ? JSON.parse(l.rally_log) : (l.rally_log || []),
          customMessage: l.custom_message || '',
          updatedAt: dbTs || Date.now()
        };
      }
    } catch (e) {}
    return { ...liveMatchCache };
  },
  async saveLiveMatch(payload) {
    const isLive = payload.status === 'LIVE' || payload.status === 'IN PROGRESS' || (payload.isLive === true);
    const isComplete = payload.status === 'COMPLETED' || (payload.status !== 'UPCOMING' && payload.status !== 'NO_LIVE_MATCH' && !isLive && payload.isComplete === true);
    const nowMs = Date.now();
    const clientTs = typeof payload.updatedAt === 'string' ? new Date(payload.updatedAt).getTime() : (Number(payload.updatedAt) || Number(payload.ts) || 0);
    const finalTs = clientTs > 0 ? clientTs : nowMs;

    liveMatchCache = {
      ...liveMatchCache,
      ...payload,
      isLive,
      isComplete,
      updatedAt: finalTs
    };

    try {
      await query(`
        INSERT INTO live_match (
          court_id, match_id, category, p1_name, p2_name, target_points, score, status,
          is_live, is_complete, server, current_game, games, sets_won, interval, rally_log, custom_message, updated_at
        ) VALUES (
          'Court 1', $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
        )
        ON CONFLICT (court_id) DO UPDATE SET
          match_id = EXCLUDED.match_id,
          category = EXCLUDED.category,
          p1_name = EXCLUDED.p1_name,
          p2_name = EXCLUDED.p2_name,
          target_points = EXCLUDED.target_points,
          score = EXCLUDED.score,
          status = EXCLUDED.status,
          is_live = EXCLUDED.is_live,
          is_complete = EXCLUDED.is_complete,
          server = EXCLUDED.server,
          current_game = EXCLUDED.current_game,
          games = EXCLUDED.games,
          sets_won = EXCLUDED.sets_won,
          interval = EXCLUDED.interval,
          rally_log = EXCLUDED.rally_log,
          custom_message = EXCLUDED.custom_message,
          updated_at = NOW()
      `, [
        liveMatchCache.matchId || '',
        liveMatchCache.category || 'Below 35',
        liveMatchCache.p1Name || '',
        liveMatchCache.p2Name || '',
        liveMatchCache.targetPoints || 21,
        liveMatchCache.score || '0-0',
        liveMatchCache.status || 'NO_LIVE_MATCH',
        !!liveMatchCache.isLive,
        !!liveMatchCache.isComplete,
        liveMatchCache.server || 1,
        liveMatchCache.currentGame || 0,
        JSON.stringify(liveMatchCache.games || [[0, 0], [0, 0], [0, 0]]),
        JSON.stringify(liveMatchCache.setsWon || [0, 0]),
        JSON.stringify(liveMatchCache.interval || {}),
        JSON.stringify(liveMatchCache.rallyLog || []),
        liveMatchCache.customMessage || ''
      ]);
    } catch (e) {
      console.error('[PostgreSQL] saveLiveMatch error:', e.message);
    }

    return { ...liveMatchCache };
  },

  // FINANCIALS
  getFinancials() {
    return {
      expenses: [...(financialsCache.expenses || [])],
      sponsors: [...(financialsCache.sponsors || [])]
    };
  },
  saveExpense(expense) {
    if (!financialsCache.expenses) financialsCache.expenses = [];
    const id = expense.id || `EXP-${Date.now().toString().slice(-4)}`;
    const newExp = { ...expense, id, amount: Number(expense.amount || 0) };
    const idx = financialsCache.expenses.findIndex(e => e.id === id);
    if (idx >= 0) {
      financialsCache.expenses[idx] = newExp;
    } else {
      financialsCache.expenses.unshift(newExp);
    }

    query(`
      INSERT INTO expenses (id, date, category, item, amount, paid_to, payment_mode, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date,
        category = EXCLUDED.category,
        item = EXCLUDED.item,
        amount = EXCLUDED.amount,
        paid_to = EXCLUDED.paid_to,
        payment_mode = EXCLUDED.payment_mode,
        status = EXCLUDED.status
    `, [
      id,
      newExp.date || new Date().toISOString().split('T')[0],
      newExp.category || 'General',
      newExp.item || 'Expense item',
      newExp.amount || 0,
      newExp.paidTo || '',
      newExp.paymentMode || 'UPI',
      newExp.status || 'PAID'
    ]).catch(e => console.error('[PostgreSQL] saveExpense error:', e.message));

    return newExp;
  },
  deleteExpense(expId) {
    if (!financialsCache.expenses) return false;
    financialsCache.expenses = financialsCache.expenses.filter(e => e.id !== expId);
    query("DELETE FROM expenses WHERE id = $1", [expId])
      .catch(e => console.error('[PostgreSQL] deleteExpense error:', e.message));
    return true;
  },
  saveSponsor(sponsor) {
    if (!financialsCache.sponsors) financialsCache.sponsors = [];
    const id = sponsor.id || `SPON-${Date.now().toString().slice(-4)}`;
    const newSpon = {
      ...sponsor,
      id,
      promisedAmount: Number(sponsor.promisedAmount || 0),
      receivedAmount: Number(sponsor.receivedAmount || 0)
    };
    const idx = financialsCache.sponsors.findIndex(s => s.id === id);
    if (idx >= 0) {
      financialsCache.sponsors[idx] = newSpon;
    } else {
      financialsCache.sponsors.unshift(newSpon);
    }

    query(`
      INSERT INTO sponsors (id, name, tier, contact, promised_amount, received_amount, payment_mode, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        tier = EXCLUDED.tier,
        contact = EXCLUDED.contact,
        promised_amount = EXCLUDED.promised_amount,
        received_amount = EXCLUDED.received_amount,
        payment_mode = EXCLUDED.payment_mode,
        status = EXCLUDED.status
    `, [
      id,
      newSpon.name || 'Sponsor',
      newSpon.tier || 'Sponsor',
      newSpon.contact || '',
      newSpon.promisedAmount || 0,
      newSpon.receivedAmount || 0,
      newSpon.paymentMode || 'UPI',
      newSpon.status || 'RECEIVED'
    ]).catch(e => console.error('[PostgreSQL] saveSponsor error:', e.message));

    return newSpon;
  },
  deleteSponsor(sponId) {
    if (!financialsCache.sponsors) return false;
    financialsCache.sponsors = financialsCache.sponsors.filter(s => s.id !== sponId);
    query("DELETE FROM sponsors WHERE id = $1", [sponId])
      .catch(e => console.error('[PostgreSQL] deleteSponsor error:', e.message));
    return true;
  },

  // WEB PUSH SUBSCRIPTIONS
  getPushSubscriptions(audienceType) {
    if (!audienceType || audienceType === 'ALL') {
      return [...pushSubscriptionsCache];
    }
    const target = audienceType.toUpperCase();
    return pushSubscriptionsCache.filter(sub => {
      const a = (sub.audience_type || sub.audienceType || 'ALL').toUpperCase();
      if (target === 'PLAYERS') return a === 'PLAYERS' || a === 'ALL';
      if (target === 'ADMINS') return a === 'ADMINS' || a === 'ALL';
      return a === target;
    });
  },

  async savePushSubscription({ endpoint, keys, audienceType, userIdentifier, userAgent }) {
    if (!endpoint) return null;
    const p256dh = (keys && keys.p256dh) || 'missing_p256dh';
    const auth = (keys && keys.auth) || 'missing_auth';
    const aud = (audienceType || 'ALL').toUpperCase();
    const ident = userIdentifier || '';
    const ua = userAgent || '';

    const newSub = {
      endpoint,
      keys: { p256dh, auth },
      p256dh,
      auth,
      audience_type: aud,
      user_identifier: ident,
      user_agent: ua,
      updated_at: new Date().toISOString()
    };

    const existingIdx = pushSubscriptionsCache.findIndex(s => s.endpoint === endpoint);
    if (existingIdx >= 0) {
      pushSubscriptionsCache[existingIdx] = { ...pushSubscriptionsCache[existingIdx], ...newSub };
    } else {
      pushSubscriptionsCache.push(newSub);
    }

    try {
      await query(`
        INSERT INTO push_subscriptions (endpoint, p256dh, auth, audience_type, user_identifier, user_agent, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (endpoint) DO UPDATE SET
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          audience_type = EXCLUDED.audience_type,
          user_identifier = EXCLUDED.user_identifier,
          user_agent = EXCLUDED.user_agent,
          updated_at = NOW()
      `, [endpoint, p256dh, auth, aud, ident, ua]);
      console.log(`[PostgreSQL] Push subscription written to Neon DB (${aud}): ${endpoint.slice(-25)}`);
    } catch (e) {
      console.error('[PostgreSQL] savePushSubscription error:', e.message);
    }

    return newSub;
  },

  async deletePushSubscription(endpoint) {
    if (!endpoint) return false;
    pushSubscriptionsCache = pushSubscriptionsCache.filter(s => s.endpoint !== endpoint);
    try {
      await query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
    } catch (e) {
      console.error('[PostgreSQL] deletePushSubscription error:', e.message);
    }
    return true;
  },

  async getPushStats() {
    try {
      const res = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE UPPER(audience_type) = 'PLAYERS') as players,
          COUNT(*) FILTER (WHERE UPPER(audience_type) = 'ADMINS') as admins,
          COUNT(*) FILTER (WHERE UPPER(audience_type) NOT IN ('PLAYERS', 'ADMINS') OR audience_type IS NULL) as general
        FROM push_subscriptions
      `);
      if (res && res.rows && res.rows[0]) {
        const row = res.rows[0];
        return {
          total: Number(row.total) || 0,
          players: Number(row.players) || 0,
          admins: Number(row.admins) || 0,
          general: Number(row.general) || 0
        };
      }
    } catch (e) {
      console.warn('[PostgreSQL] getPushStats direct query error:', e.message);
    }

    let total = pushSubscriptionsCache.length;
    let players = 0;
    let admins = 0;
    let general = 0;

    pushSubscriptionsCache.forEach(s => {
      const a = (s.audience_type || s.audienceType || 'ALL').toUpperCase();
      if (a === 'PLAYERS') players++;
      else if (a === 'ADMINS') admins++;
      else general++;
    });

    return { total, players, admins, general };
  }
};

module.exports = dataStore;
