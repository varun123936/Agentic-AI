import express from 'express';
import {
  callGeminiWithTools,
  streamGeminiWithTools
} from '../services/gemini-tools.service.js';
import { getToolNames } from '../mcp/tool-registry.js';

const router = express.Router();

// ── GET /api/agent/tools — list available tools ────────────────
router.get('/tools', (req, res) => {
  res.json({
    success: true,
    data: {
      tools: getToolNames(),
      count: getToolNames().length
    }
  });
});

// ── POST /api/agent/chat — non-streaming with tools ───────────
router.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'message is required'
    });
  }

  try {
    console.log(`\n[AGENT] User: ${message}`);
    const startTime = Date.now();

    const result = await callGeminiWithTools(message, history);

    console.log(`[AGENT] Completed in ${Date.now() - startTime}ms`);
    console.log(`[AGENT] Tool calls made: ${result.toolCallCount}`);

    res.json({
      success: true,
      data: {
        answer: result.answer,
        toolCallCount: result.toolCallCount,
        latencyMs: Date.now() - startTime,
        tokens: result.usage
      }
    });

  } catch (error) {
    console.error('[AGENT] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ── POST /api/agent/stream — streaming with tools ─────────────
router.post('/stream', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'message is required'
    });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => { controller.abort(); res.end(); });

  const startTime = Date.now();

  await streamGeminiWithTools(
    message,
    history,

    // onStatus — tool is running
    (status) => {
      res.write(`data: ${JSON.stringify({
        type: 'status',
        message: status
      })}\n\n`);
    },

    // onChunk — text streaming
    (chunk) => {
      res.write(`data: ${JSON.stringify({
        type: 'chunk',
        content: chunk
      })}\n\n`);
    },

    // onDone
    (meta) => {
      res.write(`data: ${JSON.stringify({
        type: 'done',
        toolCallCount: meta.toolCallCount,
        latencyMs: Date.now() - startTime,
        tokens: meta.tokens
      })}\n\n`);
      res.end();
    },

    // onError
    (err) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: err
        })}\n\n`);
        res.end();
      }
    },

    controller.signal
  );
});

export default router;