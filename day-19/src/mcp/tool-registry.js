// Tool Registry — single source of truth for all tools
// Add new tools here — everything else picks them up automatically

import {
  orderToolDefinitions,
  orderToolExecutors
} from './tools/order.tool.js';

import {
  productToolDefinitions,
  productToolExecutors
} from './tools/product.tool.js';

import {
  weatherToolDefinitions,
  weatherToolExecutors
} from './tools/weather.tool.js';

// ── All tool definitions (sent to Gemini) ─────────────────────
export const ALL_TOOL_DEFINITIONS = [
  ...orderToolDefinitions,
  ...productToolDefinitions,
  ...weatherToolDefinitions
];

// ── All tool executors (called by your Node.js code) ──────────
export const ALL_TOOL_EXECUTORS = {
  ...orderToolExecutors,
  ...productToolExecutors,
  ...weatherToolExecutors
};

// ── Gemini function declarations format ───────────────────────
// Gemini uses a specific format for tool definitions
export function buildGeminiFunctionDeclarations(tools = ALL_TOOL_DEFINITIONS) {
  return {
    tools: [{
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }))
    }]
  };
}

// ── Get tool names for logging ─────────────────────────────────
export function getToolNames() {
  return ALL_TOOL_DEFINITIONS.map(t => t.name);
}