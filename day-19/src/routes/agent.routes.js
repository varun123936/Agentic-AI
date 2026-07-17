import express from 'express';
import {
  callGeminiWithTools,
  streamGeminiWithTools
} from '../services/gemini-tools.service.js';
import { getToolNames } from '../mcp/tool-registry.js';

const router = express.Router();

// ── GET /api/agent/tools ──────────────────────────────────────
router.get('/tools', (req, res) => {
  res.json({
    success: true,
    data: {
      tools: getToolNames(),
      count: getToolNames().length
    }
  });
});

// ── POST /api/agent/chat — non-streaming ──────────────────────
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
    const latencyMs = Date.now() - startTime;

    console.log(`[AGENT] Done in ${latencyMs}ms, tools: ${result.toolCallCount}`);

    res.json({
      success: true,
      data: {
        answer: result.answer,
        toolCallCount: result.toolCallCount,
        latencyMs,
        tokens: result.usage
      }
    });

  } catch (error) {
    console.error('[AGENT] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── POST /api/agent/stream — SSE streaming ────────────────────
router.post('/stream', async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'message is required'
    });
  }

  // Set SSE headers BEFORE any async work
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Disable Nginx buffering if behind a proxy
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const controller = new AbortController();
  let ended = false;

  // Safe write helper — prevents writing after connection closes
  const safeWrite = (data) => {
    if (!ended && !res.writableEnded) {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (e) {
        console.error('[SSE] Write error:', e.message);
      }
    }
  };

  // Safe end helper
  const safeEnd = () => {
    if (!ended) {
      ended = true;
      if (!res.writableEnded) {
        res.end();
      }
    }
  };

  // Handle client disconnect
  req.on('close', () => {
    console.log('[SSE] Client disconnected');
    ended = true;
    controller.abort();
  });

  // Keep-alive ping every 15s to prevent timeout
  const keepAlive = setInterval(() => {
    if (!ended && !res.writableEnded) {
      res.write(': ping\n\n'); // SSE comment — keeps connection alive
    } else {
      clearInterval(keepAlive);
    }
  }, 15000);

  const startTime = Date.now();

  try {
    await streamGeminiWithTools(
      message,
      history,

      // onStatus
      (status) => safeWrite({ type: 'status', message: status }),

      // onChunk
      (chunk) => safeWrite({ type: 'chunk', content: chunk }),

      // onDone
      (meta) => {
        clearInterval(keepAlive);
        safeWrite({
          type: 'done',
          toolCallCount: meta.toolCallCount,
          latencyMs: Date.now() - startTime,
          tokens: meta.tokens
        });
        safeEnd();
      },

      // onError
      (err) => {
        clearInterval(keepAlive);
        safeWrite({ type: 'error', message: err });
        safeEnd();
      },

      controller.signal
    );

  } catch (error) {
    clearInterval(keepAlive);
    if (!controller.signal.aborted) {
      safeWrite({ type: 'error', message: error.message });
    }
    safeEnd();
  }
});

export default router;