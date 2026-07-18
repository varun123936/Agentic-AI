import { orderToolDefinitions,   orderToolExecutors }   from './tools/order.tool.js';
import { productToolDefinitions, productToolExecutors } from './tools/product.tool.js';
import { weatherToolDefinitions, weatherToolExecutors } from './tools/weather.tool.js';
import { devopsToolDefinitions,  devopsToolExecutors }  from './tools/devops.tool.js';

export const ALL_TOOL_DEFINITIONS = [
  ...orderToolDefinitions,
  ...productToolDefinitions,
  ...weatherToolDefinitions,
  ...devopsToolDefinitions
];

export const ALL_TOOL_EXECUTORS = {
  ...orderToolExecutors,
  ...productToolExecutors,
  ...weatherToolExecutors,
  ...devopsToolExecutors
};

// ── Gemini native function calling format ─────────────────────
export function buildGeminiFunctionDeclarations(tools = ALL_TOOL_DEFINITIONS) {
  return {
    tools: [{
      functionDeclarations: tools.map(t => ({
        name: t.name, description: t.description, parameters: t.parameters
      }))
    }]
  };
}

// ── Ollama prompt-based tool calling (works with ALL models) ──
export function buildPromptToolInstructions(tools = ALL_TOOL_DEFINITIONS) {
  const toolList = tools.map(t => {
    const props    = t.parameters?.properties || {};
    const required = t.parameters?.required   || [];
    const params   = Object.entries(props).map(([k, v]) =>
      `      "${k}": "${v.description}"${required.includes(k) ? ' // REQUIRED' : ' // optional'}`
    ).join(',\n');

    return `• ${t.name}: ${t.description}
  Call format: {"tool":"${t.name}","args":{${params ? '\n' + params + '\n  ' : ''}}}`;
  }).join('\n\n');

  return `
=== TOOLS YOU CAN USE ===
${toolList}

=== HOW TO USE A TOOL ===
When you need information from a tool, output ONLY this JSON (nothing else):
{"tool":"TOOL_NAME","args":{"param":"value"}}

RULES:
- Output ONLY the raw JSON when calling a tool — no text, no markdown
- After getting tool results, either call another tool OR give your final text answer
- Your final answer must be plain text (not JSON)
- Never guess or make up data — always use tools
========================`;
}

// ── Parse tool call from model output text ────────────────────
export function parseToolCall(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();

  // Try 1: clean JSON
  try {
    const p = JSON.parse(t);
    if (p?.tool) return { name: p.tool, args: p.args || {} };
  } catch {}

  // Try 2: inside code block
  const cb = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) {
    try {
      const p = JSON.parse(cb[1].trim());
      if (p?.tool) return { name: p.tool, args: p.args || {} };
    } catch {}
  }

  // Try 3: JSON anywhere in text
  const jm = t.match(/\{[^{}]*"tool"[^{}]*\}/s);
  if (jm) {
    try {
      const p = JSON.parse(jm[0]);
      if (p?.tool) return { name: p.tool, args: p.args || {} };
    } catch {}
  }

  // Try 4: old tool_call format (compatibility)
  try {
    const p = JSON.parse(t);
    if (p?.tool_call?.name) return { name: p.tool_call.name, args: p.tool_call.arguments || {} };
  } catch {}

  return null;
}

export function getToolNames() {
  return ALL_TOOL_DEFINITIONS.map(t => t.name);
}