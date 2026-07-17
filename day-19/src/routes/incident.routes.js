import express from 'express';
import { createIncidentAgent } from '../agents/incident.agent.js';
import { createOrderAgent } from '../agents/order.agent.js';

const router = express.Router();

// In-memory session store for approval flows
// In production: use Redis with TTL
const pendingApprovals = new Map();

// ── POST /api/incident/investigate ────────────────────────────
// Start an incident investigation
router.post('/investigate', async (req, res) => {
  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'message is required'
    });
  }

  // SSE headers for streaming status
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sessionId = `INC-${Date.now()}`;
  const startTime = Date.now();

  const agent = createIncidentAgent({
    onStatus: (msg) => {
      res.write(`data: ${JSON.stringify({
        type: 'status',
        message: msg,
        sessionId
      })}\n\n`);
    },
    onToolCall: ({ name, args }) => {
      res.write(`data: ${JSON.stringify({
        type: 'tool_call',
        toolName: name,
        args,
        sessionId
      })}\n\n`);
    },
    onApprovalNeeded: () => {} // handled in return value check below
  });

  try {
    const result = await agent.run(message);

    if (result.status === 'awaiting_approval') {
      // Save state for resume
      pendingApprovals.set(sessionId, {
        approvalState: result,
        agent,
        createdAt: Date.now()
      });

      res.write(`data: ${JSON.stringify({
        type: 'approval_required',
        sessionId,
        toolName: result.pendingApproval.toolName,
        toolArgs: result.pendingApproval.toolArgs,
        message: result.message,
        executionLog: result.executionLog
      })}\n\n`);

    } else {
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        answer: result.answer,
        toolCallCount: result.toolCallCount,
        latencyMs: Date.now() - startTime,
        executionLog: result.executionLog,
        sessionId
      })}\n\n`);
    }

  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message,
      sessionId
    })}\n\n`);
  }

  res.end();
});

// ── POST /api/incident/approve ─────────────────────────────────
// Human approves or denies a pending action
router.post('/approve', async (req, res) => {
  const { sessionId, approved, feedback } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: 'sessionId is required'
    });
  }

  const pending = pendingApprovals.get(sessionId);
  if (!pending) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired. Please start a new investigation.'
    });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const startTime = Date.now();
  const { approvalState, agent } = pending;
  pendingApprovals.delete(sessionId); // consume the approval

  try {
    // Notify status
    res.write(`data: ${JSON.stringify({
      type: 'status',
      message: approved
        ? 'Approval received. Executing action...'
        : 'Action denied. Finding alternatives...'
    })}\n\n`);

    // Resume agent
    const result = await agent.resumeAfterApproval(
      approvalState,
      approved,
      feedback
    );

    // Check if another approval is needed
    if (result.status === 'awaiting_approval') {
      const newSessionId = `INC-${Date.now()}`;
      pendingApprovals.set(newSessionId, {
        approvalState: result,
        agent,
        createdAt: Date.now()
      });

      res.write(`data: ${JSON.stringify({
        type: 'approval_required',
        sessionId: newSessionId,
        toolName: result.pendingApproval.toolName,
        toolArgs: result.pendingApproval.toolArgs,
        message: result.message
      })}\n\n`);

    } else {
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        answer: result.answer,
        toolCallCount: result.toolCallCount,
        latencyMs: Date.now() - startTime,
        executionLog: result.executionLog
      })}\n\n`);
    }

  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message
    })}\n\n`);
  }

  res.end();
});

// ── POST /api/incident/order ───────────────────────────────────
// Order management with approval flow
router.post('/order', async (req, res) => {
  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'message is required'
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sessionId = `ORD-${Date.now()}`;
  const startTime = Date.now();

  const agent = createOrderAgent({
    onStatus: (msg) => {
      res.write(`data: ${JSON.stringify({
        type: 'status', message: msg, sessionId
      })}\n\n`);
    },
    onToolCall: ({ name }) => {
      res.write(`data: ${JSON.stringify({
        type: 'tool_call', toolName: name, sessionId
      })}\n\n`);
    }
  });

  try {
    const result = await agent.run(message);

    if (result.status === 'awaiting_approval') {
      pendingApprovals.set(sessionId, {
        approvalState: result,
        agent,
        createdAt: Date.now()
      });

      res.write(`data: ${JSON.stringify({
        type: 'approval_required',
        sessionId,
        toolName: result.pendingApproval.toolName,
        toolArgs: result.pendingApproval.toolArgs,
        message: result.message
      })}\n\n`);

    } else {
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        answer: result.answer,
        toolCallCount: result.toolCallCount,
        latencyMs: Date.now() - startTime,
        executionLog: result.executionLog
      })}\n\n`);
    }

  } catch (error) {
    res.write(`data: ${JSON.stringify({
      type: 'error', message: error.message, sessionId
    })}\n\n`);
  }

  res.end();
});

// ── GET /api/incident/pending ──────────────────────────────────
// List pending approvals
router.get('/pending', (req, res) => {
  const pending = [];
  for (const [id, val] of pendingApprovals.entries()) {
    pending.push({
      sessionId: id,
      toolName: val.approvalState.pendingApproval.toolName,
      createdAt: new Date(val.createdAt).toISOString(),
      ageMs: Date.now() - val.createdAt
    });
  }

  res.json({ success: true, data: { count: pending.length, pending } });
});

export default router;