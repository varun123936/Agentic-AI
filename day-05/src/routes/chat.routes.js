import express from 'express';
import { streamAI } from '../services/ai.stream.js';
import * as ConversationService from '../services/conversation.service.js';
import { AI_CONFIG } from '../config/ai.config.js';

const router = express.Router();

const SYSTEM_PROMPT = `You are a helpful AI assistant built into an enterprise application.
Be concise, professional, and accurate.
If you don't know something, say so clearly.`;

// ── POST /api/chat/conversations — create new conversation
router.post('/conversations', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const conversation = await ConversationService.createConversation(userId);
    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/chat/conversations — list user's conversations
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const conversations = await ConversationService.getUserConversations(userId);
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── GET /api/chat/conversations/:id/messages — get history
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    await ConversationService.getConversation(req.params.id, userId);

    const messages = await ConversationService.getMessageHistory(req.params.id, 50);
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

// ── POST /api/chat/conversations/:id/stream — stream + save
router.post('/conversations/:id/stream', async (req, res) => {
  const { message } = req.body;
  const userId = req.headers['x-user-id'] || 'anonymous';
  const conversationId = req.params.id;

  // Validate
  if (!message?.trim() || message.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'message is required and must be under 2000 characters'
    });
  }

  // Validate conversation belongs to user
  try {
    await ConversationService.getConversation(conversationId, userId);
  } catch (error) {
    return res.status(404).json({ success: false, error: 'Conversation not found' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => {
    controller.abort();
    res.end();
  });

  try {
    // 1. Save user message to DB
    await ConversationService.saveUserMessage(conversationId, message.trim());

    // 2. Load history for AI context (last 20 messages)
    const history = await ConversationService.getMessageHistory(conversationId, 20);
    // Remove last message (the one we just saved) — it'll be passed as newMessage
    const contextHistory = history.slice(0, -1);

    const startTime = Date.now();
    let fullResponse = '';

    // 3. Stream AI response
    await streamAI(
      SYSTEM_PROMPT,
      contextHistory,
      message.trim(),

      // onChunk
      (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },

      // onDone
      async ({ inputTokens, outputTokens }) => {
        const latencyMs = Date.now() - startTime;

        // 4. Save assistant message + usage to DB
        try {
          await ConversationService.saveAssistantMessage(
            conversationId,
            userId,
            fullResponse,
            {
              model: 'gemini-2.5-flash',
              provider: AI_CONFIG.provider,
              inputTokens,
              outputTokens,
              latencyMs
            }
          );
        } catch (dbError) {
          console.error('[DB] Failed to save assistant message:', dbError.message);
          // Don't fail the stream — response already sent to user
        }

        res.write(`data: ${JSON.stringify({
          type: 'done',
          tokens: { input: inputTokens, output: outputTokens },
          latencyMs
        })}\n\n`);
        res.end();
      },

      // onError
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
});

// ── GET /api/chat/usage — user token usage stats
router.get('/usage', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const stats = await ConversationService.getUserUsageStats(userId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;