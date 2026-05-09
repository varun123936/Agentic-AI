import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  // In real app this comes from auth middleware
  // For now we accept it from request
  userId: {
    type: String,
    required: true,
    index: true        // We query by userId often — index it
  },

  title: {
    type: String,
    default: 'New Conversation'
  },

  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },

  messageCount: {
    type: Number,
    default: 0
  },

  totalTokensUsed: {
    type: Number,
    default: 0
  },

  lastMessageAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true  // Adds createdAt and updatedAt automatically
});

// Index for getting user's recent conversations
conversationSchema.index({ userId: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);