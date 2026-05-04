import express from 'express';
import { streamAI } from '../services/ai.stream.js';

const router = express.Router();

// POST /api/chat/stream
// Streams AI response using Server-Sent Events
router.post('/stream', async (req, res) => {
  const { message, context } = req.body;

  // Basic validation
  if (!message || typeof message !== 'string' || message.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'message is required and must be at least 2 characters'
    });
  }

  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'message must not exceed 1000 characters'
    });
  }

  // Set SSE headers — this is the key that makes it streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');  // For local testing
  res.flushHeaders();  // Send headers immediately — opens the SSE connection

  const systemPrompt = `You are a helpful AI assistant built into an enterprise application.
Be concise, professional, and accurate.
If you don't know something, say so clearly.`;

  let fullResponse = '';  // Accumulate full response for logging

  await streamAI(
    systemPrompt,
    message.trim(),

    // onChunk — fires for every text piece
    (chunk) => {
      fullResponse += chunk;

      // SSE format: "data: " + JSON + "\n\n"
      // We send JSON so frontend can parse metadata if needed
      const sseData = JSON.stringify({ chunk, type: 'chunk' });
      res.write(`data: ${sseData}\n\n`);
    },

    // onDone — stream finished
    () => {
      console.log(`[STREAM DONE] chars: ${fullResponse.length}`);

      // Send a final event so frontend knows it's over
      const doneData = JSON.stringify({ type: 'done', totalChars: fullResponse.length });
      res.write(`data: ${doneData}\n\n`);
      res.end();
    },

    // onError — something went wrong mid-stream
    (error) => {
      console.error('[STREAM ERROR]', error.message);

      // Send error event to frontend
      const errorData = JSON.stringify({ type: 'error', message: error.message });
      res.write(`data: ${errorData}\n\n`);
      res.end();
    }
  );

  // Handle client disconnect — user closed the browser tab
  req.on('close', () => {
    console.log('[STREAM] Client disconnected early');
    res.end();
  });
});

export default router;