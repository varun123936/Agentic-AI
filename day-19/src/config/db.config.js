import mongoose from 'mongoose';
export async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ MongoDB connected');
  } catch (e) { console.error('❌ MongoDB:', e.message); process.exit(1); }
}