import express from 'express';
import { callAIWithTools, streamAIWithTools } from '../services/ai-tools.service.js';
import { executeTool }  from '../mcp/tool-executor.js';
import { getToolNames } from '../mcp/tool-registry.js';
import { AI_CONFIG }    from '../config/ai.config.js';

const router = express.Router();
const SYS    = 'You are a helpful AI assistant. Use tools for real data. Never guess.';

function sse(res, req) {
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders();
  let ended=false;
  const ping = setInterval(() => { if(!ended&&!res.writableEnded) res.write(':ping\n\n'); else clearInterval(ping); }, 20000);
  const w = d => { if(!ended&&!res.writableEnded) { try { res.write(`data: ${JSON.stringify(d)}\n\n`); } catch {} } };
  const e = () => { if(!ended) { ended=true; clearInterval(ping); try{res.end();}catch{} } };
  req.on('close', () => { ended=true; clearInterval(ping); });
  return { w, e };
}

router.get('/tools', (req,res) => res.json({ success:true, data:{ tools:getToolNames(), provider:AI_CONFIG.provider, model:AI_CONFIG.provider==='gemini'?'gemini-2.0-flash':AI_CONFIG.ollama.model } }));

router.post('/chat', async (req,res) => {
  const { message, history=[] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error:'message required' });
  try {
    const t=Date.now(); const r=await callAIWithTools(message, SYS, history);
    res.json({ success:true, data:{ answer:r.answer, toolCallCount:r.toolCallCount, latencyMs:Date.now()-t, provider:AI_CONFIG.provider } });
  } catch(e) { res.status(500).json({ success:false, error:e.message }); }
});

router.post('/stream', async (req,res) => {
  const { message, history=[] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error:'message required' });
  const { w, e } = sse(res, req);
  const ac=new AbortController(); const t=Date.now();
  req.on('close', () => ac.abort());
  w({ type:'connected', provider:AI_CONFIG.provider, model:AI_CONFIG.provider==='gemini'?'gemini-2.0-flash':AI_CONFIG.ollama.model });
  try {
    await streamAIWithTools(message, SYS, history,
      s => w({ type:'status', message:s }),
      c => w({ type:'chunk', content:c }),
      m => { w({ type:'done', latencyMs:Date.now()-t, ...m }); e(); },
      er => { w({ type:'error', message:er }); e(); },
      ac.signal
    );
  } catch(err) { if(!ac.signal.aborted) w({ type:'error', message:err.message }); e(); }
});

export default router;