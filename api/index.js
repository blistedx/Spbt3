const app = require('../server');
const { initPostgres } = require('../config/postgres');

module.exports = async (req, res) => {
  try {
    await initPostgres();
  } catch (e) {
    console.warn('Vercel Serverless PostgreSQL connection notice:', e.message);
  }
  return app(req, res);
};
