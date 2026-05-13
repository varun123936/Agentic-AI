import express from 'express';
import { streamAI } from '../services/ai.stream.js';
import * as ConversationService from '../services/conversation.service.js';
import { authenticate, checkTokenBudget } from '../middleware/auth.middleware.js';
import { AI_CONFIG } from '../config/ai.config.js';
import { User } from '../models/user.model.js';

const router = express.Router();

// All chat routes require authentication
router.use(authenticate);

const SYSTEM_PROMPT = `You are a helpful AI assistant built into an enterprise application.
Be concise, professional, and accurate.
If you don't know something, say so clearly.`;

// ── POST /api/chat/conversations ──────────────────────────────
router.post('/conversations', async (req, res) => {
  try {
    // Now uses req.user.id from JWT — not a header
    const conversation = await ConversationService.createConversation(req.user.id);
    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/chat/conversations ───────────────────────────────
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await ConversationService.getUserConversations(req.user.id);
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/chat/conversations/:id/messages ──────────────────
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    await ConversationService.getConversation(req.params.id, req.user.id);
    const messages = await ConversationService.getMessageHistory(req.params.id, 50);
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

// ── POST /api/chat/conversations/:id/stream ───────────────────
// authenticate → checkTokenBudget → stream
router.post(
  '/conversations/:id/stream',
  checkTokenBudget,              // Check daily token budget before AI call
  async (req, res) => {
    const { message } = req.body;
    const userId = req.user.id;
    const conversationId = req.params.id;

    if (!message?.trim() || message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'message is required and must be under 2000 characters'
      });
    }

    try {
      await ConversationService.getConversation(conversationId, userId);
    } catch (error) {
      return res.status(error.statusCode || 404).json({ success: false, error: error.message });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const controller = new AbortController();
    req.on('close', () => { controller.abort(); res.end(); });

    try {
      await ConversationService.saveUserMessage(conversationId, message.trim());
      const history = await ConversationService.getMessageHistory(conversationId, 20);
      const contextHistory = history.slice(0, -1);

      const startTime = Date.now();
      let fullResponse = '';

      await streamAI(
        SYSTEM_PROMPT,
        contextHistory,
        message.trim(),

        (chunk) => {
          fullResponse += chunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
        },

        async ({ inputTokens, outputTokens }) => {
          const latencyMs = Date.now() - startTime;
          const totalTokens = inputTokens + outputTokens;

          try {
            // Save assistant message
            await ConversationService.saveAssistantMessage(
              conversationId, userId, fullResponse,
              {
                model: 'gemini-2.5-flash',
                provider: AI_CONFIG.provider,
                inputTokens, outputTokens, latencyMs
              }
            );

            // Update user's daily token usage
            await User.findByIdAndUpdate(userId, {
              $inc: { tokensUsedToday: totalTokens }
            });

          } catch (dbError) {
            console.error('[DB] Save error:', dbError.message);
          }

          res.write(`data: ${JSON.stringify({
            type: 'done',
            tokens: { input: inputTokens, output: outputTokens, total: totalTokens },
            latencyMs,
            budget: {
              used: req.tokenBudget.used + totalTokens,
              limit: req.tokenBudget.limit
            }
          })}\n\n`);
          res.end();
        },

        (error) => {
          console.error('[STREAM ERROR]', error.message);
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
          }
        },

        controller.signal
      );

    } catch (error) {
      console.error('[ROUTE ERROR]', error.message);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong' })}\n\n`);
        res.end();
      }
    }
  }
);

// ── GET /api/chat/usage ───────────────────────────────────────
// Returns the authenticated user's own usage statistics
router.get('/usage', async (req, res) => {
  try {
    const stats = await ConversationService.getUserUsageStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
