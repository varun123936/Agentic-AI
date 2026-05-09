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
    maxlength: 10000   // Prevent huge messages
  },

  // AI metadata — only populated for assistant messages
  aiMeta: {
    model: String,               // 'gemini-2.5-flash'
    provider: String,            // 'gemini' | 'ollama'
    inputTokens: Number,
    outputTokens: Number,
    totalTokens: Number,
    latencyMs: Number,
    promptVersion: String,
    estimatedCostUsd: Number
  }

}, {
  timestamps: true
});

// Index for loading conversation history in order
messageSchema.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);