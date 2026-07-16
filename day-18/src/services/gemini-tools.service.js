// Gemini Tool Calling Service
// Handles the multi-step conversation with Gemini
// when tools are involved

import fetch from 'node-fetch';
import {
  buildGeminiFunctionDeclarations
} from '../mcp/tool-registry.js';
import { executeTool } from '../mcp/tool-executor.js';

const MODEL = 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `You are a helpful AI assistant for an e-commerce company.
You have access to tools that can check real order data,
search products, and get weather information.

Guidelines:
- Always use tools when you need real data
- Be concise and friendly in responses
- If a tool returns an error, explain it clearly to the user
- Never make up order statuses or product information
- Always confirm actions like cancellations before stating they are done`;

// ── Single non-streaming call with tool support ────────────────
export async function callGeminiWithTools(
  userMessage,
  conversationHistory = [],
  maxToolRounds = 5   // prevent infinite tool call loops
) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;

  // Build contents from history + new message
  const contents = [
    ...conversationHistory,
    {
      role: 'user',
      parts: [{ text: userMessage }]
    }
  ];

  // Get function declarations in Gemini format
  const toolConfig = buildGeminiFunctionDeclarations();

  let toolCallCount = 0;

  // ── Agentic loop — keeps running until AI gives text response ──
  while (toolCallCount < maxToolRounds) {

    const requestBody = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents,
      ...toolConfig,    // includes function declarations
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`);
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }

    const parts = candidate.content?.parts || [];

    // ── Check if Gemini wants to call a tool ───────────────────
    const functionCallPart = parts.find(p => p.functionCall);

    if (functionCallPart) {
      // AI wants to call a tool
      const { name, args } = functionCallPart.functionCall;
      toolCallCount++;

      console.log(`[GEMINI] Tool call requested: ${name} (round ${toolCallCount})`);

      // Execute the tool
      const toolResult = await executeTool(name, args);

      // Add AI's tool call to conversation
      contents.push({
        role: 'model',
        parts: [{ functionCall: { name, args } }]
      });

      // Add tool result to conversation
      // Gemini needs this to continue
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name,
            response: toolResult
          }
        }]
      });

      // Continue loop — Gemini will either call another tool
      // or give a final text response
      continue;
    }

    // ── No tool call — AI gave a final text response ───────────
    const textPart = parts.find(p => p.text);
    if (textPart) {
      // Add final AI response to conversation
      contents.push({
        role: 'model',
        parts: [{ text: textPart.text }]
      });

      return {
        answer: textPart.text,
        toolCallCount,
        conversationHistory: contents,
        usage: data.usageMetadata
      };
    }

    // Unexpected response
    throw new Error('Gemini returned neither tool call nor text');
  }

  // Max rounds hit — return what we have
  return {
    answer: 'I was unable to complete the request after multiple attempts. Please try again.',
    toolCallCount,
    conversationHistory: contents,
    usage: null
  };
}

// ── Streaming version with tool support ────────────────────────
// Tools run first (non-streaming), then final answer streams
export async function streamGeminiWithTools(
  userMessage,
  conversationHistory = [],
  onStatus,      // called when tool is executing
  onChunk,       // called for each text chunk
  onDone,        // called when complete
  onError,       // called on error
  signal         // AbortController signal
) {
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    // Phase 1: Run tool calls (non-streaming)
    // We must get tool results before we can stream the final answer
    const toolConfig = buildGeminiFunctionDeclarations();

    const contents = [
      ...conversationHistory,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    let toolCallCount = 0;
    const MAX_TOOL_ROUNDS = 5;

    // Run tool rounds until AI is ready to give final answer
    while (toolCallCount < MAX_TOOL_ROUNDS) {
      if (signal?.aborted) return;

      const url = `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          ...toolConfig,
          generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
        }),
        signal
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const parts = data.candidates?.[0]?.content?.parts || [];
      const functionCallPart = parts.find(p => p.functionCall);

      if (functionCallPart) {
        const { name, args } = functionCallPart.functionCall;
        toolCallCount++;

        // Tell the frontend which tool is running
        onStatus?.(`Using tool: ${name.replace(/_/g, ' ')}...`);

        const toolResult = await executeTool(name, args);

        contents.push({
          role: 'model',
          parts: [{ functionCall: { name, args } }]
        });
        contents.push({
          role: 'user',
          parts: [{ functionResponse: { name, response: toolResult } }]
        });

        continue;
      }

      // No more tool calls — ready to stream final answer
      break;
    }

    // Phase 2: Stream the final answer
    if (signal?.aborted) return;
    onStatus?.('Generating answer...');

    const streamUrl = `${BASE_URL}/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const streamResponse = await fetch(streamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000 }
      }),
      signal
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of streamResponse.body) {
      if (signal?.aborted) break;

      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.replace('data: ', '').trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) onChunk(text);

          if (parsed.usageMetadata) {
            inputTokens = parsed.usageMetadata.promptTokenCount || 0;
            outputTokens = parsed.usageMetadata.candidatesTokenCount || 0;
          }
        } catch { /* skip partial */ }
      }
    }

    onDone({
      toolCallCount,
      tokens: { input: inputTokens, output: outputTokens }
    });

  } catch (error) {
    if (error.name === 'AbortError') return;
    onError(error.message);
  }
}