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
  registration_status: "OPEN",
  admin_pin: "9903",
  upi_id: "blistedx@okhdfcbank",
  upi_name: "S.P. Badminton Club",
  upi_qr_url: "qr_code.png",
  entry_fee: "1000",
  stat_categories: "02",
  stat_players: "50+",
  stat_days: "03",
  categories: [
    { name: "Below 35", status: "ACTIVE", fee: "1000", maxPairs: "32" },
    { name: "Above 35", status: "ACTIVE", fee: "1000", maxPairs: "32" }
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

async function syncFromDb() {
  try {
    // 1. Settings
    const setRes = await query("SELECT * FROM settings WHERE id = 'current' LIMIT 1");
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
        entry_fee: r.entry_fee,
        stat_categories: r.stat_categories,
        stat_players: r.stat_players,
        stat_days: r.stat_days,
        categories: typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || DEFAULT_SETTINGS.categories)
      };
    }

    // 2. Registrations
    const regRes = await query("SELECT * FROM registrations ORDER BY created_at DESC");
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
    const matchRes = await query("SELECT * FROM matches ORDER BY created_at ASC");
    matchesCache = matchRes.rows.map(m => ({
      matchId: m.match_id,
      id: m.match_id,
      category: m.category,
      round: m.round,
      court: m.court,
      team1P1: m.team1_p1,
      team1P2: m.team1_p2,
      team2P1: m.team2_p1,
      team2P2: m.team2_p2,
      team1Name: m.team1_name,
      team2Name: m.team2_name,
      scheduledTime: m.scheduled_time,
      status: m.status,
      winner: m.winner,
      scores: typeof m.scores === 'string' ? JSON.parse(m.scores) : (m.scores || []),
      sets: typeof m.sets === 'string' ? JSON.parse(m.sets) : (m.sets || []),
      ...(m.raw_payload || {})
    }));

    // 4. Live Match
    const liveRes = await query("SELECT * FROM live_match WHERE court_id = 'Court 1' LIMIT 1");
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
        updatedAt: l.updated_at ? new Date(l.updated_at).getTime() : Date.now()
      };
    }

    // 5. Financials (Expenses & Sponsors)
    const expRes = await query("SELECT * FROM expenses ORDER BY created_at DESC");
    const sponRes = await query("SELECT * FROM sponsors ORDER BY created_at DESC");
    financialsCache = {
      expenses: expRes.rows.map(e => ({
        id: e.id,
        date: e.date,
        category: e.category,
        item: e.item,
        amount: Number(e.amount),
        paidTo: e.paid_to,
        paymentMode: e.payment_mode,
        status: e.status
      })),
      sponsors: sponRes.rows.map(s => ({
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

    console.log(`[PostgreSQL DataStore] Synced from Neon DB: ${registrationsCache.length} regs, ${matchesCache.length} matches, ${financialsCache.expenses.length} expenses.`);
  } catch (err) {
    console.warn('[PostgreSQL DataStore] Sync warning:', err.message);
  }
}

// Auto-sync on startup
syncFromDb().catch(() => {});

const dataStore = {
  syncFromDb,

  // SETTINGS
  getSettings() {
    return { ...settingsCache };
  },
  saveSettings(newSettings) {
    settingsCache = { ...settingsCache, ...newSettings };

    query(`
      INSERT INTO settings (id, tournament_name, tournament_subtitle, venue, dates, flash_message, flash_active, registration_status, admin_pin, upi_id, upi_name, upi_qr_url, entry_fee, stat_categories, stat_players, stat_days, categories, updated_at)
      VALUES ('current', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
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
    matchesCache = Array.isArray(matches) ? matches : [];
    return [...matchesCache];
  },
  addOrUpdateMatch(match) {
    const matchId = match.matchId || match.id || `M-${100 + matchesCache.length + 1}`;
    const idx = matchesCache.findIndex(m => (m.matchId === matchId || m.id === matchId));
    if (idx >= 0) {
      matchesCache[idx] = { ...matchesCache[idx], ...match, matchId, id: matchId, updatedAt: new Date().toISOString() };
    } else {
      matchesCache.push({ ...match, matchId, id: matchId, updatedAt: new Date().toISOString() });
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
        round = EXCLUDED.round,
        court = EXCLUDED.court,
        team1_p1 = EXCLUDED.team1_p1,
        team1_p2 = EXCLUDED.team1_p2,
        team2_p1 = EXCLUDED.team2_p1,
        team2_p2 = EXCLUDED.team2_p2,
        team1_name = EXCLUDED.team1_name,
        team2_name = EXCLUDED.team2_name,
        scheduled_time = EXCLUDED.scheduled_time,
        status = EXCLUDED.status,
        winner = EXCLUDED.winner,
        scores = EXCLUDED.scores,
        sets = EXCLUDED.sets,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW()
    `, [
      matchId,
      match.category || 'Below 35',
      match.round || 'Round 1',
      match.court || 'Court 1',
      match.team1P1 || match.team1_p1 || match.p1Name || match.player1 || '',
      match.team1P2 || match.team1_p2 || '',
      match.team2P1 || match.team2_p1 || match.p2Name || match.player2 || '',
      match.team2P2 || match.team2_p2 || '',
      match.team1Name || match.team1_name || match.p1Name || match.team1 || '',
      match.team2Name || match.team2_name || match.p2Name || match.team2 || '',
      match.scheduledTime || match.scheduled_time || '',
      match.status || 'SCHEDULED',
      match.winner || '',
      JSON.stringify(match.scores || []),
      JSON.stringify(match.sets || []),
      JSON.stringify(match)
    ]).catch(e => console.error('[PostgreSQL] addOrUpdateMatch error:', e.message));

    return match;
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
  saveLiveMatch(payload) {
    liveMatchCache = {
      ...liveMatchCache,
      ...payload,
      updatedAt: Date.now()
    };

    query(`
      INSERT INTO live_match (
        court_id, match_id, category, p1_name, p2_name, target_points, score, status,
        is_live, is_complete, server, current_game, games, sets_won, interval, rally_log, updated_at
      ) VALUES (
        'Court 1', $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, NOW()
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
      JSON.stringify(liveMatchCache.rallyLog || [])
    ]).catch(e => console.error('[PostgreSQL] saveLiveMatch error:', e.message));

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
  }
};

module.exports = dataStore;
