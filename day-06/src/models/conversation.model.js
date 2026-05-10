import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true          // Queried frequently — index it
  },

  title: {
    type: String,
    default: 'New Conversation',
    maxlength: 200,
    trim: true
  },

  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },

  messageCount: {
    type: Number,
    default: 0,
    min: 0
  },

  totalTokensUsed: {
    type: Number,
    default: 0,
    min: 0
  },

  lastMessageAt: {
    type: Date,
    default: Date.now
  },

  // Optional: store a short AI-generated summary
  // Populated when user requests summarization (Day 5 homework)
  summary: {
    type: String,
    default: null
  }

}, {
  timestamps: true    // Adds createdAt, updatedAt automatically
});

// Compound index — get user's recent active conversations efficiently
conversationSchema.index({ userId: 1, status: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);