import { BaseAgent }            from './base.agent.js';
import { orderToolDefinitions }   from '../mcp/tools/order.tool.js';
import { productToolDefinitions } from '../mcp/tools/product.tool.js';
import { AI_CONFIG }            from '../config/ai.config.js';

const SYSTEM = `You are a customer service agent for an e-commerce company.
Provider: ${AI_CONFIG.provider === 'gemini' ? 'Gemini 2.0 Flash' : 'Ollama gemma4:cloud'}.

Guidelines:
- Always look up real data before responding
- Be professional and empathetic
- Cancellations require human approval — ask first
- After cancellation inform about refund`;

export function createOrderAgent(callbacks = {}) {
  return new BaseAgent({
    name: 'OrderAgent', systemPrompt: SYSTEM,
    maxToolRounds: 8, temperature: 0.3,
    tools: [...orderToolDefinitions, ...productToolDefinitions],
    requiresApproval: ['cancel_order'],
    ...callbacks
  });
}