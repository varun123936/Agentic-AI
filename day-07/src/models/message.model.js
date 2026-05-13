import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },

  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },

  content: {
    type: String,
    required: true,
    maxlength: 10000
  },

  // Only populated for role === 'assistant'
  // null for user messages
  aiMeta: {
    model: {
      type: String,
      default: null      // e.g. 'gemini-2.5-flash'
    },
    provider: {
      type: String,
      default: null      // 'gemini' | 'ollama'
    },
    inputTokens: {
      type: Number,
      default: 0
    },
    outputTokens: {
      type: Number,
      default: 0
    },
    totalTokens: {
      type: Number,
      default: 0
    },
    latencyMs: {
      type: Number,
      default: null      // How long AI took to respond
    },
    estimatedCostUsd: {
      type: Number,
      default: 0
    }
  }

}, {
  timestamps: true
});

// Compound index — load conversation messages in time order efficiently
messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);