import { orderToolDefinitions,   orderToolExecutors }   from './tools/order.tool.js';
import { productToolDefinitions, productToolExecutors } from './tools/product.tool.js';
import { weatherToolDefinitions, weatherToolExecutors } from './tools/weather.tool.js';
import { devopsToolDefinitions,  devopsToolExecutors }  from './tools/devops.tool.js';

export const ALL_TOOL_DEFINITIONS = [ ...orderToolDefinitions, ...productToolDefinitions, ...weatherToolDefinitions, ...devopsToolDefinitions ];
export const ALL_TOOL_EXECUTORS   = { ...orderToolExecutors, ...productToolExecutors, ...weatherToolExecutors, ...devopsToolExecutors };

export function buildGeminiFunctionDeclarations(tools = ALL_TOOL_DEFINITIONS) {
  return { tools: [{ functionDeclarations: tools.map(t => ({ name:t.name, description:t.description, parameters:t.parameters })) }] };
}

export function buildPromptToolInstructions(tools = ALL_TOOL_DEFINITIONS) {
  const list = tools.map(t => {
    const props = t.parameters?.properties || {};
    const req   = t.parameters?.required   || [];
    const params = Object.entries(props).map(([k,v]) => `      "${k}": "${v.description}"${req.includes(k)?' // REQUIRED':' // optional'}`).join(',\n');
    return `• ${t.name}: ${t.description}\n  Format: {"tool":"${t.name}","args":{${params?'\n'+params+'\n  ':''}}}`;
  }).join('\n\n');

  return `
=== AVAILABLE TOOLS ===
${list}

=== HOW TO USE ===
Output ONLY this raw JSON when calling a tool (no text, no markdown):
{"tool":"TOOL_NAME","args":{"param":"value"}}

RULES:
- Output ONLY the JSON when calling a tool
- After tool results, call another tool OR give your final plain-text answer
- Final answers must be plain text — NOT JSON
- Never make up data — use tools for real information
======================`;
}

export function parseToolCall(text) {
  if (!text) return null;
  const t = text.trim();
  // Try 1: clean JSON
  try { const p=JSON.parse(t); if(p?.tool) return { name:p.tool, args:p.args||{} }; } catch {}
  // Try 2: code block
  const cb = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) { try { const p=JSON.parse(cb[1].trim()); if(p?.tool) return { name:p.tool, args:p.args||{} }; } catch {} }
  // Try 3: JSON in text
  const jm = t.match(/\{[^{}]*"tool"[^{}]*\}/s);
  if (jm) { try { const p=JSON.parse(jm[0]); if(p?.tool) return { name:p.tool, args:p.args||{} }; } catch {} }
  // Try 4: tool_call format
  try { const p=JSON.parse(t); if(p?.tool_call?.name) return { name:p.tool_call.name, args:p.tool_call.arguments||{} }; } catch {}
  return null;
}

export function getToolNames() { return ALL_TOOL_DEFINITIONS.map(t => t.name); }