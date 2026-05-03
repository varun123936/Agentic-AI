import express from 'express';
import { callAI, parseAIJson } from '../services/ai.service.js';
import { TICKET_PROMPTS } from '../prompts/ticket.prompts.js';
import { validateBulkTicketInput, validateTicketInput } from '../middleware/validate.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// POST /api/tickets/analyze
router.post(
  '/analyze',
  aiRateLimiter,          // 1. Rate limit first
  validateTicketInput,    // 2. Validate input
  async (req, res, next) => {
    try {
      const { text, customerEmail } = req.body;
      const prompt = TICKET_PROMPTS.analyze;

      console.log(`[AI CALL] Analyzing ticket for: ${customerEmail || 'anonymous'}`);
      const startTime = Date.now();

      // 3. Call AI
      const rawResponse = await callAI(
        prompt.system,
        prompt.build(text)
      );

      const latencyMs = Date.now() - startTime;
      console.log(`[AI CALL] Completed in ${latencyMs}ms`);

      // 4. Parse and validate AI output
      const analysis = parseAIJson(rawResponse);

      // 5. Return structured response
      return res.status(200).json({
        success: true,
        data: {
          original_text: text,
          analysis,
          meta: {
            provider: process.env.AI_PROVIDER || 'gemini',
            prompt_version: prompt.version,
            latency_ms: latencyMs
          }
        }
      });

    } catch (error) {
      // Pass to global error handler
      next(error);
    }
  }
);

// POST /api/tickets/bulk-analyze
router.post(
  '/bulk-analyze',
  aiRateLimiter,
  validateBulkTicketInput,
  async (req, res, next) => {
    try {
      const { tickets } = req.body;
      const prompt = TICKET_PROMPTS.analyze;

      console.log(`[AI CALL] Bulk analyzing ${tickets.length} tickets`);
      const batchStartTime = Date.now();

      const settledResults = await Promise.allSettled(
        tickets.map(async (ticketText, index) => {
          const ticketStartTime = Date.now();
          const rawResponse = await callAI(
            prompt.system,
            prompt.build(ticketText)
          );
          const analysis = parseAIJson(rawResponse);
          const latencyMs = Date.now() - ticketStartTime;

          return {
            index,
            status: 'fulfilled',
            original_text: ticketText,
            analysis,
            latency_ms: latencyMs
          };
        })
      );

      const results = settledResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        }

        return {
          index,
          status: 'rejected',
          original_text: tickets[index],
          error: result.reason?.message || 'Unknown AI error',
          code: result.reason?.type || 'AI_BULK_ITEM_ERROR',
          latency_ms: null
        };
      });

      const totalLatencyMs = Date.now() - batchStartTime;
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      const failureCount = results.length - successCount;

      return res.status(200).json({
        success: failureCount === 0,
        data: {
          results,
          summary: {
            total_tickets: tickets.length,
            succeeded: successCount,
            failed: failureCount
          },
          meta: {
            provider: process.env.AI_PROVIDER || 'gemini',
            prompt_version: prompt.version,
            total_latency_ms: totalLatencyMs
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/tickets/health — check if AI is reachable
router.get('/health', async (req, res, next) => {
  try {
    const testResponse = await callAI(
      'You are a health check bot.',
      'Reply with exactly: {"status": "ok"}'
    );
    const parsed = parseAIJson(testResponse);
    res.json({ success: true, ai: parsed });
  } catch (error) {
    next(error);
  }
});

export default router;
