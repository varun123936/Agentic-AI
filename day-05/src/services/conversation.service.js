// Core service — handles all conversation + message logic
// This is where business logic lives, not in routes

import { Conversation } from '../models/conversation.model.js';
import { Message } from '../models/message.model.js';
import { AiUsage } from '../models/aiUsage.model.js';
import { streamAI } from './ai.stream.js';

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
    .select('title messageCount totalTokensUsed lastMessageAt createdAt summary');
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

// ─── Summarize a conversation ─────────────────────────────────
export async function summarizeConversation(conversationId, userId) {
  // 1. Get conversation (validates ownership)
  const conversation = await getConversation(conversationId, userId);

  // 2. Get all messages from conversation
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .select('role content createdAt');

  if (messages.length === 0) {
    throw new Error('No messages to summarize');
  }

  // 3. Format conversation for AI
  const conversationText = messages
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n\n');

  // 4. Create summarization prompt
  const summaryPrompt = `Please summarize the following conversation in exactly 3 bullet points. Focus on the main topics discussed and key insights shared. Keep each bullet point concise but informative.

Conversation:
${conversationText}

Summary (3 bullet points):`;

  // 5. Call AI to generate summary
  let summary = '';
  let aiMetadata = null;

  try {
    await new Promise((resolve, reject) => {
      streamAI(
        'You are a helpful assistant that creates clear, concise summaries.',
        [], // No history for summarization
        summaryPrompt, // Use the summary prompt as the new message
        // onChunk
        (chunk) => {
          summary += chunk;
        },
        // onDone
        (metadata) => {
          aiMetadata = metadata;
          resolve();
        },
        // onError
        (error) => {
          reject(error);
        },
        undefined // no abort signal needed
      );
    });
  } catch (error) {
    throw new Error(`Failed to generate summary: ${error.message}`);
  }

  // 6. Save summary to conversation
  conversation.summary = summary.trim();
  await conversation.save();

  // 7. Track this as AI usage (optional - for analytics)
  if (aiMetadata) {
    await AiUsage.create({
      conversationId,
      userId,
      provider: 'gemini', // Assuming Gemini for summarization
      model: 'gemini-2.5-flash',
      inputTokens: aiMetadata.inputTokens || 0,
      outputTokens: aiMetadata.outputTokens || 0,
      totalTokens: (aiMetadata.inputTokens || 0) + (aiMetadata.outputTokens || 0),
      estimatedCostUsd: 0, // Summaries are typically free/low cost
      isFree: false,
      operation: 'summarize' // Custom field to track summarization usage
    });
  }

  return {
    summary: summary.trim(),
    messageCount: messages.length,
    tokensUsed: aiMetadata ? (aiMetadata.inputTokens + aiMetadata.outputTokens) : 0
  };
}