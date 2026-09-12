const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);

let cachedDb = null;
let memoryServer = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const customUri = (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) || '';

  if (customUri) {
    try {
      console.log(`📡 Connecting to MongoDB Atlas: ${customUri.replace(/\/\/.*@/, '//<credentials>@')} ...`);
      cachedDb = await mongoose.connect(customUri, {
        serverSelectionTimeoutMS: 5000,
        bufferCommands: false
      });
      console.log('✅ MongoDB Connected successfully!');
      return cachedDb;
    } catch (err) {
      console.warn(`⚠️ Failed to connect to MONGODB_URI: ${err.message}.`);
      if (process.env.VERCEL) {
        return null;
      }
      console.log('🔄 Attempting fallback...');
    }
  }

  // Try standard local MongoDB default URI
  try {
    const localUri = 'mongodb://127.0.0.1:27017/sp_badminton_tourney';
    console.log(`📡 Trying local MongoDB at ${localUri}...`);
    cachedDb = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
    console.log('✅ Connected to local MongoDB instance!');
    return cachedDb;
  } catch (err) {
    console.log('ℹ️ No local MongoDB daemon active. Starting embedded in-memory MongoDB engine...');
  }

  // Fallback: Use mongodb-memory-server if available
  try {
    let MongoMemoryServer;
    try {
      MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
    } catch {
      // mongodb-memory-server not installed
    }
    if (MongoMemoryServer) {
      memoryServer = await MongoMemoryServer.create();
      const uri = memoryServer.getUri();
      cachedDb = await mongoose.connect(uri);
      console.log(`✅ Embedded In-Memory MongoDB running & connected at: ${uri}`);
      return cachedDb;
    }
    console.log('ℹ️ Operating without MongoDB daemon (PostgreSQL / in-memory store active).');
    return null;
  } catch (memErr) {
    console.error('❌ Could not start MongoDB connection:', memErr.message);
    return null;
  }
}

module.exports = { connectDB };
