// Core service — handles all conversation + message logic
// This is where business logic lives, not in routes

import { Conversation } from '../models/conversation.model.js';
import { Message } from '../models/message.model.js';
import { AiUsage } from '../models/aiUsage.model.js';

// ─── Create a new conversation ───────────────────────────────
export async function createConversation(userId) {
  const conversation = await Conversation.create({ userId });
  return conversation;
}

// ─── Get or validate existing conversation ───────────────────
export async function getConversation(conversationId, userId) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    userId        // Security: user can only access their own
  });

  if (!conversation) {
    const err = new Error('Conversation not found');
    err.statusCode = 404;
    throw err;
  }

  return conversation;
}

// ─── Get all conversations for a user ────────────────────────
export async function getUserConversations(userId) {
  return Conversation.find({ userId, status: 'active' })
    .sort({ lastMessageAt: -1 })   // Most recent first
    .limit(50)
    .select('title messageCount totalTokensUsed lastMessageAt createdAt');
}

// ─── Load message history for AI context ─────────────────────
export async function getMessageHistory(conversationId, limit = 20) {
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })    // Oldest first — AI needs chronological order
    .limit(limit)
    .select('role content');   // Only role + content for AI context

  // Format for AI API — Gemini/Ollama expect this structure
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

// ─── Save a user message ─────────────────────────────────────
export async function saveUserMessage(conversationId, content) {
  const message = await Message.create({
    conversationId,
    role: 'user',
    content
  });

  // Update conversation metadata
  await Conversation.findByIdAndUpdate(conversationId, {
    $inc: { messageCount: 1 },
    lastMessageAt: new Date(),
    // Auto-generate title from first message (first 60 chars)
    $setOnInsert: { title: content.substring(0, 60) }
  });

  // Set title on first message
  const conv = await Conversation.findById(conversationId);
  if (conv.messageCount === 1) {
    conv.title = content.substring(0, 60) + (content.length > 60 ? '...' : '');
    await conv.save();
  }

  return message;
}

// ─── Save AI assistant message + usage ───────────────────────
export async function saveAssistantMessage(
  conversationId,
  userId,
  content,
  aiMetadata  // { model, provider, inputTokens, outputTokens, latencyMs }
) {
  // Calculate estimated cost
  // Gemini 2.5 Flash pricing (as of 2025)
  let estimatedCostUsd = 0;
  if (aiMetadata.provider === 'gemini') {
    const inputCost = (aiMetadata.inputTokens / 1_000_000) * 0.075;
    const outputCost = (aiMetadata.outputTokens / 1_000_000) * 0.30;
    estimatedCostUsd = inputCost + outputCost;
  }
  // Ollama = always free = 0

  const totalTokens = aiMetadata.inputTokens + aiMetadata.outputTokens;

  // Save the message
  const message = await Message.create({
    conversationId,
    role: 'assistant',
    content,
    aiMeta: {
      model: aiMetadata.model,
      provider: aiMetadata.provider,
      inputTokens: aiMetadata.inputTokens,
      outputTokens: aiMetadata.outputTokens,
      totalTokens,
      latencyMs: aiMetadata.latencyMs,
      estimatedCostUsd
    }
  });

  // Save usage record separately for analytics
  await AiUsage.create({
    conversationId,
    messageId: message._id,
    userId,
    provider: aiMetadata.provider,
    model: aiMetadata.model,
    inputTokens: aiMetadata.inputTokens,
    outputTokens: aiMetadata.outputTokens,
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

// ─── Get usage stats for a user ──────────────────────────────
export async function getUserUsageStats(userId) {
  const stats = await AiUsage.aggregate([
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

  return stats;
}