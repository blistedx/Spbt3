const app = require('../server');
const { initPostgres } = require('../config/postgres');

// Warm up Neon connection asynchronously on container boot
initPostgres().catch(() => {});

module.exports = async (req, res) => {
  try {
    await initPostgres();
  } catch (e) {
    console.warn('Vercel Serverless PostgreSQL connection notice:', e.message);
  }
  return app(req, res);
};
