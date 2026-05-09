import mongoose from 'mongoose';
import 'dotenv/config';

export async function connectDB() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // These prevent deprecation warnings
      serverSelectionTimeoutMS: 5000,  // Fail fast if MongoDB not running
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting reconnect...');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Make sure MongoDB is running: mongod');
    process.exit(1);  // Exit — app is useless without DB
  }
}