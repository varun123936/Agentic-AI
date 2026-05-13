import mongoose from 'mongoose';
import { Conversation } from '../models/conversation.model.js';
import { Message } from '../models/message.model.js';
import { AiUsage } from '../models/aiUsage.model.js';

// ── Create a new conversation ─────────────────────────────────
export async function createConversation(userId) {
  const conversation = await Conversation.create({ userId });
  return conversation;
}

// ── Get and validate a conversation ──────────────────────────
// Ensures conversation exists AND belongs to the requesting user
export async function getConversation(conversationId, userId) {
  // Validate ObjectId format before querying
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    const err = new Error('Invalid conversation ID');
    err.statusCode = 400;
    throw err;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    userId           // Security: user can only access their own
  });

  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  return conversation;
}

// ── Get all active conversations for a user ───────────────────
export async function getUserConversations(userId) {
  return Conversation.find({ userId, status: 'active' })
    .sort({ lastMessageAt: -1 })    // Most recent first
    .limit(50)
    .select('title messageCount totalTokensUsed lastMessageAt createdAt');
}

// ── Archive (soft delete) a conversation ─────────────────────
export async function archiveConversation(conversationId, userId) {
  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId },
    { status: 'archived' },
    { new: true }
  );

  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  return conversation;
}

// ── Load message history for AI context ──────────────────────
// Returns in chronological order (oldest first) — AI needs this
// limit controls context window usage
export async function getMessageHistory(conversationId, limit = 20) {
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })     // Oldest first
    .limit(limit)
    .select('role content createdAt');

  // Format for AI APIs — only role and content needed
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

// ── Get full messages with metadata (for frontend display) ────
export async function getFullMessages(conversationId, limit = 50) {
  return Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .select('role content aiMeta createdAt');
}

// ── Save a user message ───────────────────────────────────────
export async function saveUserMessage(conversationId, content) {
  const message = await Message.create({
    conversationId,
    role: 'user',
    content
  });

  // Update conversation: increment count, update timestamp
  const conversation = await Conversation.findByIdAndUpdate(
    conversationId,
    {
      $inc: { messageCount: 1 },
      lastMessageAt: new Date()
    },
    { new: true }
  );

  // Auto-set title from first user message
  if (conversation.messageCount === 1) {
    const title = content.length > 60
      ? content.substring(0, 60) + '...'
      : content;

    await Conversation.findByIdAndUpdate(conversationId, { title });
  }

  return message;
}

// ── Save AI assistant message + usage record ──────────────────
export async function saveAssistantMessage(
  conversationId,
  userId,
  content,
  aiMetadata
  // aiMetadata shape:
  // { model, provider, inputTokens, outputTokens, latencyMs }
) {
  // Calculate cost for Gemini 2.5 Flash
  // Ollama = always 0
  let estimatedCostUsd = 0;

  if (aiMetadata.provider === 'gemini') {
    const inputCost = (aiMetadata.inputTokens / 1_000_000) * 0.075;
    const outputCost = (aiMetadata.outputTokens / 1_000_000) * 0.30;
    estimatedCostUsd = inputCost + outputCost;
  }

  const totalTokens = (aiMetadata.inputTokens || 0) + (aiMetadata.outputTokens || 0);

  // Save assistant message with full AI metadata
  const message = await Message.create({
    conversationId,
    role: 'assistant',
    content,
    aiMeta: {
      model: aiMetadata.model,
      provider: aiMetadata.provider,
      inputTokens: aiMetadata.inputTokens || 0,
      outputTokens: aiMetadata.outputTokens || 0,
      totalTokens,
      latencyMs: aiMetadata.latencyMs,
      estimatedCostUsd
    }
  });

  // Save separate usage record for analytics
  await AiUsage.create({
    conversationId,
    messageId: message._id,
    userId,
    provider: aiMetadata.provider,
    model: aiMetadata.model,
    inputTokens: aiMetadata.inputTokens || 0,
    outputTokens: aiMetadata.outputTokens || 0,
    totalTokens,
    estimatedCostUsd,
    isFree: aiMetadata.provider === 'ollama'
  });

  // Update conversation token total
  await Conversation.findByIdAndUpdate(conversationId, {
    $inc: {
      messageCount: 1,
      totalTokensUsed: totalTokens
    },
    lastMessageAt: new Date()
  });

  return message;
}

// ── Get usage stats for a user ────────────────────────────────
export async function getUserUsageStats(userId) {
  const byProvider = await AiUsage.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: '$provider',
        totalTokens: { $sum: '$totalTokens' },
        totalCostUsd: { $sum: '$estimatedCostUsd' },
        requestCount: { $sum: 1 }
      }
    }
  ]);

  // Today's usage
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayUsage = await AiUsage.aggregate([
    { $match: { userId, createdAt: { $gte: startOfDay } } },
    {
      $group: {
        _id: null,
        tokensToday: { $sum: '$totalTokens' },
        requestsToday: { $sum: 1 }
      }
    }
  ]);

  return {
    byProvider,
    today: todayUsage[0] || { tokensToday: 0, requestsToday: 0 }
  };
}
