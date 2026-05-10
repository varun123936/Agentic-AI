import mongoose from 'mongoose';

// Separate collection for cost and usage analytics
// Intentionally separated from messages
// So you can run aggregations without touching message data

const aiUsageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },

  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },

  userId: {
    type: String,
    required: true,
    index: true           // Query by user for billing / limits
  },

  provider: {
    type: String,
    enum: ['gemini', 'ollama'],
    required: true
  },

  model: {
    type: String,
    required: true        // e.g. 'gemini-2.5-flash', 'llama3.2'
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

  estimatedCostUsd: {
    type: Number,
    default: 0
  },

  // Ollama = free, Gemini free tier = effectively free
  // Gemini paid tier = has real cost
  isFree: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true    // createdAt used for daily/monthly reports
});

// Indexes for analytics queries
aiUsageSchema.index({ userId: 1, createdAt: -1 });      // Per-user timeline
aiUsageSchema.index({ provider: 1, createdAt: -1 });    // Per-provider usage
aiUsageSchema.index({ createdAt: -1 });                 // Global daily reports

export const AiUsage = mongoose.model('AiUsage', aiUsageSchema);