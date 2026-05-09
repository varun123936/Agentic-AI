import mongoose from 'mongoose';

// Separate collection just for usage tracking
// Makes cost analytics easy without touching message data

const aiUsageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },

  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  userId: {
    type: String,
    index: true
  },

  provider: String,    // gemini | ollama
  model: String,       // gemini-2.5-flash | llama3.2

  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  estimatedCostUsd: { type: Number, default: 0 },

  // For Ollama — always 0 cost but track usage
  isFree: { type: Boolean, default: false }

}, {
  timestamps: true
});

// Index for daily/monthly cost reports
aiUsageSchema.index({ userId: 1, createdAt: -1 });
aiUsageSchema.index({ provider: 1, createdAt: -1 });

export const AiUsage = mongoose.model('AiUsage', aiUsageSchema);