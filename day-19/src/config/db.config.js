import mongoose from 'mongoose';

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not set in .env');
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,  // Fail fast if MongoDB not running
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting reconnect...');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Make sure MongoDB is running: mongod');
    process.exit(1);
  }
}
