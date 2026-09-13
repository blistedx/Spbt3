const app = require('../server');
const { initPostgres } = require('../config/postgres');
const dataStore = require('../config/dataStore');

// Warm up Neon connection asynchronously on container boot in background
initPostgres().then(() => dataStore.syncFromDb()).catch(() => {});

module.exports = async (req, res) => {
  // Guard against Vercel internal rewrites routing to destination path
  if (req.url && (req.url.startsWith('/api/index.js') || req.url.startsWith('/api/index'))) {
    const originalPath = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'];
    if (originalPath && !originalPath.startsWith('/api/index')) {
      req.url = originalPath;
    }
  }

  // ⚡ INSTANT RESPONSE: For main pages (/), assets, and HTML views, NEVER wait for DB!
  const isPageOrAsset = req.method === 'GET' && (
    req.url === '/' || 
    req.url.startsWith('/?') ||
    req.url === '/admin' || 
    req.url === '/tv' || 
    req.url === '/scorer' || 
    req.url === '/privacy' || 
    req.url === '/terms' ||
    /\.(html|css|js|png|jpg|jpeg|svg|ico|webp|json|txt|woff2?)$/i.test(req.url.split('?')[0])
  );

  if (isPageOrAsset) {
    // Return HTML / static files instantly (< 10ms)
    return app(req, res);
  }

  // For data API requests, sync if not yet synced with a maximum 800ms cap
  if (!dataStore.isSynced) {
    try {
      await Promise.race([
        initPostgres().then(() => dataStore.syncFromDb()),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
    } catch (e) {
      console.warn('Vercel Serverless PostgreSQL connection notice:', e.message);
    }
  }

  return app(req, res);
};
