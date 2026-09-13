/**
 * S.P. Badminton Tourney 3 · Neon PostgreSQL Database Engine
 * Direct online relational database storage for settings, registrations, matches, financials & telemetry.
 */
const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const { Pool } = require('pg');

let rawConn = (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) || '';
if (rawConn && !rawConn.includes('uselibpqcompat=true') && rawConn.includes('sslmode=require')) {
  rawConn = rawConn.replace('sslmode=require', 'sslmode=require&uselibpqcompat=true');
}

const CONNECTION_STRING = rawConn;

const pool = CONNECTION_STRING ? new Pool({
  connectionString: CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 25000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
}) : null;

if (pool) {
  pool.on('error', (err) => {
    // Only log if not an idle socket closure by PgBouncer
    if (!err.message.includes('Connection terminated') && !err.message.includes('closed')) {
      console.error('[PostgreSQL] Unexpected client error:', err.message);
    }
  });
} else {
  console.warn('[PostgreSQL] DATABASE_URL environment variable is not configured.');
}

async function query(text, params, retries = 2) {
  if (!pool) {
    return { rows: [] };
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      const isTransient = /connection terminated|timeout|econnreset|57p01|closed|08006|08001/i.test(err.message || '');
      if (isTransient && attempt < retries) {
        const delay = (attempt + 1) * 600;
        console.warn(`[PostgreSQL Notice] Transient connection issue on attempt ${attempt + 1}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      console.error('[PostgreSQL Error] Query:', text, 'Params:', params, 'Message:', err.message);
      throw err;
    }
  }
}

let isInitialized = false;
let initPromise = null;

async function initPostgres() {
  if (isInitialized) return pool;
  if (initPromise) return initPromise;
  if (!pool) {
    console.warn('⚠️ PostgreSQL connection skipped: DATABASE_URL is not set.');
    return null;
  }

  initPromise = (async () => {
    try {
      console.log('📡 Connecting to Neon PostgreSQL online database...');

      // Fast-check: if settings table already exists, skip full DDL recreation
      try {
        const check = await query("SELECT to_regclass('public.matches') AS tbl_exists");
        if (check.rows[0] && check.rows[0].tbl_exists) {
          isInitialized = true;
          console.log('✅ PostgreSQL Schema verified (Tables active in Neon)!');
          return pool;
        }
      } catch (e) {}

  const schemaSql = `
    -- 1. Tournament Settings Table
    CREATE TABLE IF NOT EXISTS settings (
      id VARCHAR(50) PRIMARY KEY DEFAULT 'current',
      tournament_name VARCHAR(255) NOT NULL DEFAULT 'S.P. BADMINTON TOURNEY 3',
      tournament_subtitle VARCHAR(255) DEFAULT 'Men''s Doubles · Knockout · Suryodaya Park',
      venue VARCHAR(255) DEFAULT 'Suryodaya Park Court',
      dates VARCHAR(100) DEFAULT '28–30 Aug 2026',
      flash_message TEXT DEFAULT 'Registrations are OPEN! Limited team slots available.',
      flash_active VARCHAR(10) DEFAULT 'NO',
      registration_status VARCHAR(20) DEFAULT 'OPEN',
      admin_pin VARCHAR(50) DEFAULT '9903',
      upi_id VARCHAR(100) DEFAULT 'blistedx@okhdfcbank',
      upi_name VARCHAR(100) DEFAULT 'S.P. Badminton Club',
      upi_qr_url VARCHAR(255) DEFAULT 'qr_code.png',
      logo_url TEXT DEFAULT '/logo.png',
      entry_fee VARCHAR(50) DEFAULT '1000',
      stat_categories VARCHAR(50) DEFAULT '02',
      stat_players VARCHAR(50) DEFAULT '50+',
      stat_days VARCHAR(50) DEFAULT '03',
      categories JSONB DEFAULT '[{"name":"Below 35","status":"ACTIVE","fee":"1000","maxPairs":"32"},{"name":"Above 35","status":"ACTIVE","fee":"1000","maxPairs":"32"}]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 2. Team Registrations Table
    CREATE TABLE IF NOT EXISTS registrations (
      reg_id VARCHAR(100) PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      p1_name VARCHAR(150) NOT NULL,
      p1_phone VARCHAR(50) NOT NULL,
      p1_email VARCHAR(150),
      p1_dob VARCHAR(50),
      p1_tshirt VARCHAR(20),
      p1_id_type VARCHAR(50),
      p1_id_number VARCHAR(100),
      p2_name VARCHAR(150) NOT NULL,
      p2_phone VARCHAR(50) NOT NULL,
      p2_email VARCHAR(150),
      p2_dob VARCHAR(50),
      p2_tshirt VARCHAR(20),
      p2_id_type VARCHAR(50),
      p2_id_number VARCHAR(100),
      upi_utr VARCHAR(100),
      payment_screenshot_url TEXT,
      payment_status VARCHAR(50) DEFAULT 'PENDING',
      status VARCHAR(50) DEFAULT 'PENDING',
      admin_notes TEXT DEFAULT '',
      raw_payload JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 3. Knockout Matches & Fixtures Table
    CREATE TABLE IF NOT EXISTS matches (
      match_id VARCHAR(100) PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      round VARCHAR(100),
      court VARCHAR(50) DEFAULT 'Court 1',
      team1_p1 VARCHAR(150),
      team1_p2 VARCHAR(150),
      team2_p1 VARCHAR(150),
      team2_p2 VARCHAR(150),
      team1_name VARCHAR(255),
      team2_name VARCHAR(255),
      scheduled_time VARCHAR(100),
      status VARCHAR(50) DEFAULT 'SCHEDULED',
      winner VARCHAR(100),
      scores JSONB DEFAULT '[]',
      sets JSONB DEFAULT '[]',
      raw_payload JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 4. Courtside Live Match State Table
    CREATE TABLE IF NOT EXISTS live_match (
      court_id VARCHAR(50) PRIMARY KEY DEFAULT 'Court 1',
      match_id VARCHAR(100) DEFAULT '',
      category VARCHAR(100) DEFAULT 'Below 35',
      p1_name VARCHAR(255) DEFAULT '',
      p2_name VARCHAR(255) DEFAULT '',
      target_points INT DEFAULT 21,
      score VARCHAR(50) DEFAULT '0-0',
      status VARCHAR(50) DEFAULT 'NO_LIVE_MATCH',
      is_live BOOLEAN DEFAULT false,
      is_complete BOOLEAN DEFAULT true,
      server INT DEFAULT 1,
      current_game INT DEFAULT 0,
      games JSONB DEFAULT '[[0,0],[0,0],[0,0]]',
      sets_won JSONB DEFAULT '[0,0]',
      interval JSONB DEFAULT '{"active":false,"secondsLeft":0,"intervalTakenForGame":[false,false,false]}',
      rally_log JSONB DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 5. Financial Expenses Table
    CREATE TABLE IF NOT EXISTS expenses (
      id VARCHAR(100) PRIMARY KEY,
      date VARCHAR(50) NOT NULL,
      category VARCHAR(100) NOT NULL,
      item VARCHAR(255) NOT NULL,
      amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      paid_to VARCHAR(150),
      payment_mode VARCHAR(50) DEFAULT 'UPI',
      status VARCHAR(50) DEFAULT 'PAID',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 6. Sponsors & Funds Table
    CREATE TABLE IF NOT EXISTS sponsors (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      tier VARCHAR(100) DEFAULT 'Sponsor',
      contact VARCHAR(100),
      promised_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      received_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      payment_mode VARCHAR(50) DEFAULT 'UPI',
      status VARCHAR(50) DEFAULT 'RECEIVED',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 7. TV Presence Table
    CREATE TABLE IF NOT EXISTS tv_presence (
      device_id VARCHAR(150) PRIMARY KEY,
      name VARCHAR(150) DEFAULT 'Courtside TV Screen',
      screen VARCHAR(100) DEFAULT '1920x1080',
      last_seen TIMESTAMPTZ DEFAULT NOW()
    );

    -- 8. Analytics Events Table
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      event VARCHAR(100) NOT NULL,
      path VARCHAR(255),
      hash VARCHAR(100),
      referrer VARCHAR(255),
      session_id VARCHAR(100),
      screen VARCHAR(50),
      theme VARCHAR(20),
      data JSONB DEFAULT '{}',
      ip VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 9. Web Push Subscriptions Table
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      audience_type VARCHAR(50) DEFAULT 'ALL',
      user_identifier VARCHAR(150) DEFAULT '',
      user_agent TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  await query(schemaSql);
  await query("ALTER TABLE live_match ADD COLUMN IF NOT EXISTS custom_message TEXT DEFAULT ''").catch(() => {});
  await query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '/logo.png'").catch(() => {});
  await query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS vapid_public_key TEXT DEFAULT ''").catch(() => {});
  await query("ALTER TABLE settings ADD COLUMN IF NOT EXISTS vapid_private_key TEXT DEFAULT ''").catch(() => {});
  console.log('✅ PostgreSQL Schema initialized (All 9 tables verified)!');

  // Seed default settings row if missing
  const checkSettings = await query("SELECT id FROM settings WHERE id = 'current'");
  if (checkSettings.rows.length === 0) {
    await query(`
      INSERT INTO settings (id, tournament_name, tournament_subtitle, venue, dates, flash_message, registration_status, admin_pin, upi_id, upi_name, entry_fee)
      VALUES ('current', 'S.P. BADMINTON TOURNEY 3', 'Men''s Doubles · Knockout · Suryodaya Park', 'Suryodaya Park Court', '28–30 Aug 2026', 'Registrations are OPEN! Limited team slots available.', 'OPEN', '9903', 'blistedx@okhdfcbank', 'S.P. Badminton Club', '1000')
    `);
    console.log('🌱 Seeded default tournament settings into PostgreSQL');
  }

  // Seed default live match row if missing
  const checkLive = await query("SELECT court_id FROM live_match WHERE court_id = 'Court 1'");
  if (checkLive.rows.length === 0) {
    await query("INSERT INTO live_match (court_id, status, is_live, is_complete) VALUES ('Court 1', 'NO_LIVE_MATCH', false, false)");
  }

  isInitialized = true;
  return pool;
} catch (err) {
  initPromise = null;
  console.error('❌ PostgreSQL Initialization Error:', err.message);
  throw err;
}
})();

return initPromise;
}

module.exports = {
  pool,
  query,
  initPostgres
};
