const mongoose = require('mongoose');

let cachedDb = null;
let memoryServer = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const DEFAULT_URI = 'mongodb+srv://blistedx_db_user:tashna4317@blis.3g7wqs8.mongodb.net/sp_badminton_tourney?retryWrites=true&w=majority&appName=blis';
  const customUri = (process.env.MONGODB_URI && process.env.MONGODB_URI.trim()) || DEFAULT_URI;

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

  // Fallback: Use mongodb-memory-server
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const uri = memoryServer.getUri();
    cachedDb = await mongoose.connect(uri);
    console.log(`✅ Embedded In-Memory MongoDB running & connected at: ${uri}`);
    return cachedDb;
  } catch (memErr) {
    console.error('❌ Could not start MongoDB connection:', memErr.message);
    return null;
  }
}

module.exports = { connectDB };
