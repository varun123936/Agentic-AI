import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
  },

  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false   // Never return password in queries by default
  },

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // AI-specific user fields
  dailyTokenLimit: {
    type: Number,
    default: 100000    // 100k tokens/day per user
  },

  tokensUsedToday: {
    type: Number,
    default: 0
  },

  tokenResetDate: {
    type: Date,
    default: Date.now
  },

  lastLoginAt: Date

}, {
  timestamps: true
});

// Hash password before saving
// This runs on .save() — not on .findByIdAndUpdate()
userSchema.pre('save', async function() {
  // Only hash if password was modified
  if (!this.isModified('password')) return;

  this.password = await bcrypt.hash(this.password, 12);
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if daily token limit exceeded
userSchema.methods.checkTokenBudget = function(tokensNeeded = 0) {
  // Reset daily count if it's a new day
  const now = new Date();
  const resetDate = new Date(this.tokenResetDate);
  const isNewDay = now.toDateString() !== resetDate.toDateString();

  if (isNewDay) {
    this.tokensUsedToday = 0;
    this.tokenResetDate = now;
  }

  return {
    allowed: this.tokensUsedToday + tokensNeeded <= this.dailyTokenLimit,
    used: this.tokensUsedToday,
    limit: this.dailyTokenLimit,
    remaining: this.dailyTokenLimit - this.tokensUsedToday
  };
};

export const User = mongoose.model('User', userSchema);
