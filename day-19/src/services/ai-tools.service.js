import fetch from 'node-fetch';
import { AI_CONFIG } from '../config/ai.config.js';
import { buildGeminiFunctionDeclarations, buildPromptToolInstructions, parseToolCall, ALL_TOOL_DEFINITIONS } from '../mcp/tool-registry.js';
import { executeTool } from '../mcp/tool-executor.js';

const G_MODEL   = 'gemini-2.0-flash';
const G_BASEURL = 'https://generativelanguage.googleapis.com/v1beta/models';

async function timedFetch(url, opts, ms = 90000) {
  const ac = new AbortController();
  const t  = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { ...opts, signal: opts.signal || ac.signal }); clearTimeout(t); return r; }
  catch(e) { clearTimeout(t); if(e.name==='AbortError') throw new Error(`Timeout after ${ms/1000}s`); throw e; }
}

function readSSE(body, onParsed, signal) {
  return new Promise((res, rej) => {
    if (signal?.aborted) { body.destroy(); return res(); }
    const onAbort = () => { body.destroy(); res(); };
    signal?.addEventListener('abort', onAbort);
    let buf = '';
    body.on('data', raw => {
      buf += raw.toString();
      const lines = buf.split('\n'); buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const s = line.slice(6).trim();
        if (!s || s==='[DONE]') continue;
        try { onParsed(JSON.parse(s)); } catch {}
      }
    });
    body.on('end',   () => { signal?.removeEventListener('abort', onAbort); res(); });
    body.on('error', e  => { signal?.removeEventListener('abort', onAbort); signal?.aborted ? res() : rej(e); });
  });
}

async function geminiCall(contents, sys, toolCfg, temp = 0.2) {
  const url = `${G_BASEURL}/${G_MODEL}:generateContent?key=${AI_CONFIG.gemini.apiKey}`;
  const r = await timedFetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ system_instruction:{ parts:[{ text:sys }] }, contents, ...toolCfg, generationConfig:{ temperature:temp, maxOutputTokens:AI_CONFIG.gemini.maxOutputTokens } }) }, 60000);
  const d = await r.json();
  if (d.error) throw new Error(`Gemini: ${d.error.message}`);
  return d;
}

async function ollamaCall(messages, temp = 0.2, signal) {
  const { baseUrl, model } = AI_CONFIG.ollama;
  const r = await timedFetch(`${baseUrl}/api/chat`, {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ model, messages, stream:false, options:{ temperature:temp, num_predict:1500 } }), signal }, 120000);
  if (!r.ok) { const t = await r.text(); throw new Error(`Ollama ${r.status}: ${t.slice(0,200)}`); }
  return (await r.json()).message?.content || '';
}

async function geminiLoop(msg, sys, history, max) {
  const tc = buildGeminiFunctionDeclarations();
  const contents = [...history, { role:'user', parts:[{ text:msg }] }];
  let calls = 0;
  while (calls < max) {
    const d = await geminiCall(contents, sys, tc);
    const parts = d.candidates?.[0]?.content?.parts || [];
    const fp = parts.find(p => p.functionCall);
    const tp = parts.find(p => p.text);
    if (fp) {
      const { name, args } = fp.functionCall; calls++;
      console.log(`[GEMINI] Tool: ${name}`);
      const result = await executeTool(name, args);
      contents.push({ role:'model', parts:[{ functionCall:{ name, args } }] });
      contents.push({ role:'user',  parts:[{ functionResponse:{ name, response:result } }] });
      continue;
    }
    if (tp) { contents.push({ role:'model', parts:[{ text:tp.text }] }); return { answer:tp.text, toolCallCount:calls, contents }; }
    throw new Error('Gemini: empty response');
  }
  return { answer:'Max rounds reached.', toolCallCount:calls, contents };
}

async function ollamaLoop(msg, sys, tools, history, max) {
  const instructions = buildPromptToolInstructions(tools);
  const messages = [{ role:'system', content:`${sys}\n\n${instructions}` }, ...history.filter(m=>m.role!=='system'), { role:'user', content:msg }];
  let calls = 0;
  while (calls < max) {
    const content = await ollamaCall(messages, 0.2);
    if (!content.trim()) throw new Error('Ollama empty response');
    const tc = parseToolCall(content);
    if (tc) {
      calls++;
      console.log(`[OLLAMA] Tool: ${tc.name}`);
      const result = await executeTool(tc.name, tc.args||{});
      messages.push({ role:'assistant', content });
      messages.push({ role:'user', content:`Tool "${tc.name}" result:\n${JSON.stringify(result,null,2)}\n\nContinue or give final answer.` });
      continue;
    }
    messages.push({ role:'assistant', content });
    return { answer:content, toolCallCount:calls, contents:messages };
  }
  return { answer:'Max rounds reached.', toolCallCount:calls, contents:messages };
}

export async function callAIWithTools(msg, sys, history = [], max = 6) {
  const p = AI_CONFIG.provider;
  console.log(`\n[AI] ${p} | ${p==='gemini'?G_MODEL:AI_CONFIG.ollama.model}`);
  return p === 'gemini' ? geminiLoop(msg, sys, history, max) : ollamaLoop(msg, sys, ALL_TOOL_DEFINITIONS, history, max);
}

export async function streamAIWithTools(msg, sys, history = [], onStatus, onChunk, onDone, onError, signal) {
  const p = AI_CONFIG.provider;
  try {
    p === 'gemini'
      ? await streamGemini(msg, sys, history, onStatus, onChunk, onDone, signal)
      : await streamOllama(msg, sys, history, onStatus, onChunk, onDone, signal);
  } catch(e) { if (e.name==='AbortError'||signal?.aborted) return; onError(e.message); }
}

async function streamGemini(msg, sys, history, onStatus, onChunk, onDone, signal) {
  const tc = buildGeminiFunctionDeclarations();
  const contents = [...history, { role:'user', parts:[{ text:msg }] }];
  let calls = 0;
  while (calls < 6) {
    if (signal?.aborted) return;
    const d = await geminiCall(contents, sys, tc, 0.2);
    const fp = d.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
    if (!fp) break;
    const { name, args } = fp.functionCall; calls++;
    onStatus?.(`Using: ${name.replace(/_/g,' ')}...`);
    const result = await executeTool(name, args);
    contents.push({ role:'model', parts:[{ functionCall:{ name, args } }] });
    contents.push({ role:'user',  parts:[{ functionResponse:{ name, response:result } }] });
  }
  if (signal?.aborted) return;
  onStatus?.('Generating answer...');
  const url = `${G_BASEURL}/${G_MODEL}:streamGenerateContent?alt=sse&key=${AI_CONFIG.gemini.apiKey}`;
  const sr  = await timedFetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ system_instruction:{ parts:[{ text:sys }] }, contents, generationConfig:{ temperature:0.7, maxOutputTokens:1000 } }), signal }, 60000);
  if (!sr.ok) { const e = await sr.json(); throw new Error(e.error?.message||`HTTP ${sr.status}`); }
  let iT=0, oT=0;
  await readSSE(sr.body, p => {
    const t = p.candidates?.[0]?.content?.parts?.[0]?.text;
    if (t) onChunk(t);
    if (p.usageMetadata) { iT=p.usageMetadata.promptTokenCount||0; oT=p.usageMetadata.candidatesTokenCount||0; }
  }, signal);
  if (!signal?.aborted) onDone({ toolCallCount:calls, tokens:{ input:iT, output:oT } });
}

async function streamOllama(msg, sys, history, onStatus, onChunk, onDone, signal) {
  const instructions = buildPromptToolInstructions(ALL_TOOL_DEFINITIONS);
  const messages = [{ role:'system', content:`${sys}\n\n${instructions}` }, ...history.filter(m=>m.role!=='system'), { role:'user', content:msg }];
  let calls = 0;
  while (calls < 6) {
    if (signal?.aborted) return;
    const content = await ollamaCall(messages, 0.2, signal);
    if (!content.trim()) break;
    const tc = parseToolCall(content);
    if (tc) {
      calls++;
      onStatus?.(`Using: ${tc.name.replace(/_/g,' ')}...`);
      const result = await executeTool(tc.name, tc.args||{});
      messages.push({ role:'assistant', content });
      messages.push({ role:'user', content:`Tool "${tc.name}" result:\n${JSON.stringify(result,null,2)}\n\nContinue or give final answer.` });
      continue;
    }
    onStatus?.('Streaming answer...');
    for (const w of content.split(/(\s+)/)) { if (signal?.aborted) break; if(w) onChunk(w); await new Promise(r=>setTimeout(r,15)); }
    if (!signal?.aborted) onDone({ toolCallCount:calls, tokens:{ input:0, output:0 } });
    return;
  }
  if (signal?.aborted) return;
  onStatus?.('Generating final answer...');
  messages.push({ role:'user', content:'Provide your final answer now in plain text.' });
  const final = await ollamaCall(messages, 0.7, signal);
  for (const w of final.split(/(\s+)/)) { if (signal?.aborted) break; if(w) onChunk(w); await new Promise(r=>setTimeout(r,15)); }
  if (!signal?.aborted) onDone({ toolCallCount:calls, tokens:{ input:0, output:0 } });
}