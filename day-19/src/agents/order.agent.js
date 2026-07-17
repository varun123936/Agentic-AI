// Order Management Agent
// Handles complex order-related requests that need multiple steps

import { BaseAgent } from './base.agent.js';
import { orderToolDefinitions } from '../mcp/tools/order.tool.js';
import { productToolDefinitions } from '../mcp/tools/product.tool.js';

const ORDER_SYSTEM_PROMPT = `You are an expert customer service agent for an e-commerce company.

You have access to order management and product catalog tools.

Guidelines:
- Always look up actual order data before making claims
- For cancellation requests, verify the order is in a cancellable state
- Be empathetic and professional
- If a customer asks about an order AND a product, handle both
- Confirm destructive actions (cancellations) before executing

Cancellation Rules:
- Only cancel pending, confirmed, or processing orders
- Shipped and delivered orders cannot be cancelled
- Always inform about refund timeline after successful cancellation`;

export function createOrderAgent(callbacks = {}) {
  return new BaseAgent({
    name: 'OrderAgent',
    systemPrompt: ORDER_SYSTEM_PROMPT,
    maxToolRounds: 8,
    temperature: 0.3,
    tools: [...orderToolDefinitions, ...productToolDefinitions],

    // Cancellation requires explicit approval
    requiresApproval: ['cancel_order'],

    ...callbacks
  });
}