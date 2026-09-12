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

  // Guard against Vercel internal rewrites routing to destination path
  if (req.url && (req.url.startsWith('/api/index.js') || req.url.startsWith('/api/index'))) {
    const originalPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
    if (originalPath && !originalPath.startsWith('/api/index')) {
      req.url = originalPath;
    }
  }

  return app(req, res);
};
