import express from 'express';
import { createIncidentAgent } from '../agents/incident.agent.js';
import { createOrderAgent }    from '../agents/order.agent.js';
import { AI_CONFIG }           from '../config/ai.config.js';

const router  = express.Router();
const PENDING = new Map();
setInterval(() => { const now=Date.now(); for(const [id,v] of PENDING) if(now-v.ts>30*60*1000) PENDING.delete(id); }, 5*60*1000);

function sse(res) {
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders();
  let ended=false;
  const ping = setInterval(() => { if(!ended&&!res.writableEnded) res.write(':ping\n\n'); else clearInterval(ping); }, 20000);
  const w = d => { if(!ended&&!res.writableEnded) { try { res.write(`data: ${JSON.stringify(d)}\n\n`); } catch {} } };
  const e = () => { if(!ended) { ended=true; clearInterval(ping); try{res.end();}catch{} } };
  // A completed POST body also emits `req.close`; only the response close
  // represents the SSE client connection going away.
  res.on('close', () => { ended=true; clearInterval(ping); });
  return { w, e };
}

async function runAgent(agent, message, sessionPrefix, res, req) {
  const { w, e } = sse(res);
  const sid = `${sessionPrefix}-${Date.now()}`;
  const t   = Date.now();
  w({ type:'connected', sessionId:sid, provider:AI_CONFIG.provider, model:AI_CONFIG.provider==='gemini'?'gemini-2.0-flash':AI_CONFIG.ollama.model });
  try {
    const r = await agent.run(message);
    if (r.status==='awaiting_approval') {
      PENDING.set(sid, { state:r, agent, ts:Date.now() });
      w({ type:'approval_required', sessionId:sid, toolName:r.pendingApproval.toolName, toolArgs:r.pendingApproval.toolArgs, message:r.message, executionLog:r.executionLog });
    } else {
      w({ type:'complete', answer:r.answer, toolCallCount:r.toolCallCount, latencyMs:Date.now()-t, executionLog:r.executionLog, sessionId:sid });
    }
  } catch(err) { w({ type:'error', message:err.message, sessionId:sid }); }
  finally { e(); }
}

router.post('/investigate', async (req,res) => {
  if (!req.body.message?.trim()) return res.status(400).json({ error:'message required' });
  const agent = createIncidentAgent({
    onStatus:   m => {/* SSE status handled inline */},
    onToolCall: ({ name }) => {}
  });
  // Attach SSE and status callbacks properly
  const { w, e } = sse(res);
  const sid=`INC-${Date.now()}`; const t=Date.now();
  w({ type:'connected', sessionId:sid, provider:AI_CONFIG.provider, model:AI_CONFIG.provider==='gemini'?'gemini-2.0-flash':AI_CONFIG.ollama.model });
  const a = createIncidentAgent({
    onStatus:   m => w({ type:'status', message:m, sessionId:sid }),
    onToolCall: ({ name }) => w({ type:'tool_call', toolName:name, sessionId:sid })
  });
  try {
    const r = await a.run(req.body.message);
    if (r.status==='awaiting_approval') {
      PENDING.set(sid, { state:r, agent:a, ts:Date.now() });
      w({ type:'approval_required', sessionId:sid, toolName:r.pendingApproval.toolName, toolArgs:r.pendingApproval.toolArgs, message:r.message, executionLog:r.executionLog });
    } else {
      w({ type:'complete', answer:r.answer, toolCallCount:r.toolCallCount, latencyMs:Date.now()-t, executionLog:r.executionLog, sessionId:sid });
    }
  } catch(err) { w({ type:'error', message:err.message, sessionId:sid }); }
  finally { e(); }
});

router.post('/order', async (req,res) => {
  if (!req.body.message?.trim()) return res.status(400).json({ error:'message required' });
  const { w, e } = sse(res);
  const sid=`ORD-${Date.now()}`; const t=Date.now();
  w({ type:'connected', sessionId:sid, provider:AI_CONFIG.provider });
  const a = createOrderAgent({
    onStatus:   m => w({ type:'status', message:m, sessionId:sid }),
    onToolCall: ({ name }) => w({ type:'tool_call', toolName:name, sessionId:sid })
  });
  try {
    const r = await a.run(req.body.message);
    if (r.status==='awaiting_approval') {
      PENDING.set(sid, { state:r, agent:a, ts:Date.now() });
      w({ type:'approval_required', sessionId:sid, toolName:r.pendingApproval.toolName, toolArgs:r.pendingApproval.toolArgs, message:r.message, executionLog:r.executionLog });
    } else {
      w({ type:'complete', answer:r.answer, toolCallCount:r.toolCallCount, latencyMs:Date.now()-t, executionLog:r.executionLog, sessionId:sid });
    }
  } catch(err) { w({ type:'error', message:err.message, sessionId:sid }); }
  finally { e(); }
});

router.post('/approve', async (req,res) => {
  const { sessionId, approved, feedback } = req.body;
  if (!sessionId) return res.status(400).json({ error:'sessionId required' });
  if (typeof approved !== 'boolean') return res.status(400).json({ error:'approved must be boolean' });
  const p = PENDING.get(sessionId);
  if (!p) return res.status(404).json({ error:'Session not found or expired' });
  PENDING.delete(sessionId);
  const { w, e } = sse(res);
  const t=Date.now();
  w({ type:'status', message: approved?'✅ Approved. Executing...':'❌ Denied. Finding alternatives...' });
  try {
    const r = await p.agent.resumeAfterApproval(p.state, approved, feedback||'');
    if (r.status==='awaiting_approval') {
      const nid=`${sessionId.split('-')[0]}-${Date.now()}`;
      PENDING.set(nid, { state:r, agent:p.agent, ts:Date.now() });
      w({ type:'approval_required', sessionId:nid, toolName:r.pendingApproval.toolName, toolArgs:r.pendingApproval.toolArgs, message:r.message });
    } else {
      w({ type:'complete', answer:r.answer, toolCallCount:r.toolCallCount, latencyMs:Date.now()-t, executionLog:r.executionLog });
    }
  } catch(err) { w({ type:'error', message:err.message }); }
  finally { e(); }
});

router.get('/pending', (req,res) => {
  const list=[]; for(const [id,v] of PENDING) list.push({ sessionId:id, toolName:v.state.pendingApproval.toolName, ageSeconds:Math.floor((Date.now()-v.ts)/1000) });
  res.json({ success:true, data:{ count:list.length, pending:list } });
});

export default router;
