const app = require('../server');
const { connectDB } = require('../config/db');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (e) {
    console.warn('Vercel Serverless DB connection notice:', e.message);
  }
  return app(req, res);
};
