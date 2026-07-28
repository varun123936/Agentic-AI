import fetch from 'node-fetch';
import { AI_CONFIG } from '../config/ai.config.js';
import { executeTool } from '../mcp/tool-executor.js';
import { buildGeminiFunctionDeclarations, buildPromptToolInstructions, parseToolCall } from '../mcp/tool-registry.js';

const G_MODEL   = 'gemini-2.0-flash';
const G_BASEURL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function tFetch(url, opts, ms=120000) {
  const ac = new AbortController();
  const t  = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { ...opts, signal:ac.signal }); clearTimeout(t); return r; }
  catch(e) { clearTimeout(t); if(e.name==='AbortError') throw new Error(`Timeout ${ms/1000}s`); throw e; }
}

export class BaseAgent {
  constructor(opts={}) {
    this.name=opts.name||'Agent'; this.systemPrompt=opts.systemPrompt||'You are helpful.';
    this.maxToolRounds=opts.maxToolRounds||10; this.temperature=opts.temperature||0.2;
    this.availableTools=opts.tools||[]; this.requiresApproval=opts.requiresApproval||[];
    if (this.requiresApproval.length) {
      this.systemPrompt += `\n\nAPPROVAL WORKFLOW: If you recommend an action that uses ${this.requiresApproval.join(', ')}, call that tool with the required arguments. The runtime will intercept the call and present the user with an approval control. Do not ask for approval only in plain text, and do not give a final answer before issuing the required tool call.`;
    }
    this.onToolCall=opts.onToolCall||null; this.onStatus=opts.onStatus||null;
  }

  async run(msg, history=[]) {
    const p = AI_CONFIG.provider;
    console.log(`\n[${this.name}] ${p} | "${msg.slice(0,60)}"`);
    return p==='gemini' ? this._gemini(msg, history) : this._ollama(msg, history);
  }

  async _gemini(msg, history) {
    const tc = buildGeminiFunctionDeclarations(this.availableTools);
    const contents = [...history, { role:'user', parts:[{ text:msg }] }];
    const log=[]; let calls=0;
    while (calls < this.maxToolRounds) {
      const url = `${G_BASEURL}/${G_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ system_instruction:{ parts:[{ text:this.systemPrompt }] }, contents, ...tc, generationConfig:{ temperature:this.temperature, maxOutputTokens:2000 } }) });
      const d = await r.json();
      if (d.error) throw new Error(`Gemini: ${d.error.message}`);
      const fp = d.candidates?.[0]?.content?.parts?.find(p=>p.functionCall);
      const tp = d.candidates?.[0]?.content?.parts?.find(p=>p.text);
      if (fp) {
        const { name, args } = fp.functionCall; calls++;
        this.onStatus?.(`Checking: ${name.replace(/_/g,' ')}...`); this.onToolCall?.({ name, args });
        if (this.requiresApproval.includes(name)) return { status:'awaiting_approval', pendingApproval:{ toolName:name, toolArgs:args }, toolCallCount:calls, executionLog:log, contents, message:`Need approval for: ${name}` };
        const result = await executeTool(name, args);
        log.push({ step:calls, tool:name, success:result.success, ts:new Date().toISOString() });
        contents.push({ role:'model', parts:[{ functionCall:{ name, args } }] });
        contents.push({ role:'user',  parts:[{ functionResponse:{ name, response:result } }] });
        continue;
      }
      if (tp) { contents.push({ role:'model', parts:[{ text:tp.text }] }); return { status:'complete', answer:tp.text, toolCallCount:calls, executionLog:log, contents }; }
      throw new Error('Gemini: empty response');
    }
    return { status:'max_rounds', answer:'Max steps reached.', toolCallCount:calls, executionLog:log, contents };
  }

  async _ollama(msg, history) {
    const { baseUrl, model } = AI_CONFIG.ollama;
    const instructions = buildPromptToolInstructions(this.availableTools);
    const messages = [{ role:'system', content:`${this.systemPrompt}\n\n${instructions}` }, ...history.filter(m=>m.role!=='system'), { role:'user', content:msg }];
    const log=[]; let calls=0;
    while (calls < this.maxToolRounds) {
      console.log(`[${this.name}][OLLAMA] Step ${calls+1}`);
      const r = await tFetch(`${baseUrl}/api/chat`, { method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ model, messages, stream:false, options:{ temperature:this.temperature, num_predict:1000 } }) }, 120000);
      if (!r.ok) { const t=await r.text(); throw new Error(`Ollama ${r.status}: ${t.slice(0,200)}`); }
      const content = (await r.json()).message?.content || '';
      console.log(`[${this.name}][OLLAMA] "${content.slice(0,100)}"`);
      if (!content.trim()) throw new Error('Ollama empty response');
      const tc = parseToolCall(content);
      if (tc) {
        calls++;
        this.onStatus?.(`Checking: ${tc.name.replace(/_/g,' ')}...`); this.onToolCall?.({ name:tc.name, args:tc.args||{} });
        if (this.requiresApproval.includes(tc.name)) return { status:'awaiting_approval', pendingApproval:{ toolName:tc.name, toolArgs:tc.args||{} }, toolCallCount:calls, executionLog:log, contents:messages, message:`Need approval for: ${tc.name}` };
        const result = await executeTool(tc.name, tc.args||{});
        log.push({ step:calls, tool:tc.name, success:result.success, ts:new Date().toISOString() });
        messages.push({ role:'assistant', content });
        messages.push({ role:'user', content:`Tool "${tc.name}" result:\n${JSON.stringify(result,null,2)}\n\nContinue or give final answer.` });
        continue;
      }
      messages.push({ role:'assistant', content });
      return { status:'complete', answer:content, toolCallCount:calls, executionLog:log, contents:messages };
    }
    return { status:'max_rounds', answer:'Max steps reached.', toolCallCount:calls, executionLog:log, contents:messages };
  }

  async resumeAfterApproval(state, approved, feedback='') {
    const { pendingApproval, contents } = state;
    const { toolName, toolArgs } = pendingApproval;
    const p = AI_CONFIG.provider;
    this.onStatus?.(approved?`Executing ${toolName}...`:'Denied. Finding alternatives...');
    const result = approved ? await executeTool(toolName, toolArgs) : { success:false, error:`Denied. ${feedback}` };
    const continueMsg = approved ? 'Action executed. Continue and summarize.' : `Denied: "${feedback}". Suggest alternatives.`;
    if (p==='gemini') {
      const updated = [...contents, { role:'model', parts:[{ functionCall:{ name:toolName, args:toolArgs } }] }, { role:'user', parts:[{ functionResponse:{ name:toolName, response:result } }] }];
      return this._gemini(continueMsg, updated);
    } else {
      const updated = [...contents, { role:'assistant', content:JSON.stringify({ tool:toolName, args:toolArgs }) }, { role:'user', content:`Tool "${toolName}" result:\n${JSON.stringify(result,null,2)}\n\nContinue.` }];
      return this._ollama(continueMsg, updated);
    }
  }
}
