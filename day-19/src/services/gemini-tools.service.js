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

// ── Helper: read SSE stream reliably ─────────────────────────
// Uses event-based reading instead of for-await
// This fixes ECONNRESET with node-fetch v3 in Node.js
function readSSEStream(responseBody, onChunk, signal) {
  return new Promise((resolve, reject) => {

    // If already aborted
    if (signal?.aborted) {
      responseBody.destroy();
      return resolve();
    }

    // Handle abort signal
    const onAbort = () => {
      responseBody.destroy();
      resolve();
    };
    signal?.addEventListener('abort', onAbort);

    let buffer = '';

    responseBody.on('data', (rawChunk) => {
      buffer += rawChunk.toString();
      const lines = buffer.split('\n');

      // Keep last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.replace('data: ', '').trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          onChunk(parsed);
        } catch {
          // Skip malformed JSON chunks — normal during streaming
        }
      }
    });

    responseBody.on('end', () => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    });

    responseBody.on('error', (err) => {
      signal?.removeEventListener('abort', onAbort);
      if (err.name === 'AbortError' || signal?.aborted) {
        resolve(); // clean abort — not an error
      } else {
        reject(err);
      }
    });
  });
}

// ── Non-streaming call to Gemini ──────────────────────────────
async function callGeminiRaw(contents, toolConfig, temperature = 0.2) {
  const apiKey = process.env.GEMINI_API_KEY;
  const url = `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      ...toolConfig,
      generationConfig: { temperature, maxOutputTokens: 1000 }
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  return data;
}

// ── Full non-streaming call with tool support ─────────────────
export async function callGeminiWithTools(
  userMessage,
  conversationHistory = [],
  maxToolRounds = 5
) {
  const toolConfig = buildGeminiFunctionDeclarations();

  const contents = [
    ...conversationHistory,
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  let toolCallCount = 0;

  while (toolCallCount < maxToolRounds) {
    const data = await callGeminiRaw(contents, toolConfig);
    const candidate = data.candidates?.[0];

    if (!candidate) throw new Error('No response from Gemini');

    const parts = candidate.content?.parts || [];
    const functionCallPart = parts.find(p => p.functionCall);
    const textPart = parts.find(p => p.text);

    if (functionCallPart) {
      const { name, args } = functionCallPart.functionCall;
      toolCallCount++;

      console.log(`[GEMINI] Tool call: ${name} (round ${toolCallCount})`);

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

    if (textPart) {
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

    throw new Error('Gemini returned neither tool call nor text');
  }

  return {
    answer: 'Unable to complete after maximum tool rounds.',
    toolCallCount,
    conversationHistory: contents,
    usage: null
  };
}

// ── Streaming call with tool support ─────────────────────────
// Phase 1: Run tool calls (non-streaming — must complete first)
// Phase 2: Stream the final text answer
export async function streamGeminiWithTools(
  userMessage,
  conversationHistory = [],
  onStatus,
  onChunk,
  onDone,
  onError,
  signal
) {
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    // ── PHASE 1: Tool calls (non-streaming) ───────────────────
    const toolConfig = buildGeminiFunctionDeclarations();

    const contents = [
      ...conversationHistory,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    let toolCallCount = 0;
    const MAX_TOOL_ROUNDS = 5;

    while (toolCallCount < MAX_TOOL_ROUNDS) {
      if (signal?.aborted) return;

      const data = await callGeminiRaw(contents, toolConfig, 0.2);
      const parts = data.candidates?.[0]?.content?.parts || [];
      const functionCallPart = parts.find(p => p.functionCall);

      if (functionCallPart) {
        const { name, args } = functionCallPart.functionCall;
        toolCallCount++;

        onStatus?.(`Using ${name.replace(/_/g, ' ')}...`);
        console.log(`[STREAM] Tool call: ${name}`);

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

      // No more tool calls — ready to stream
      break;
    }

    if (signal?.aborted) return;

    // ── PHASE 2: Stream the final answer ─────────────────────
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

    if (!streamResponse.ok) {
      const errData = await streamResponse.json();
      throw new Error(errData.error?.message || `HTTP ${streamResponse.status}`);
    }

    let inputTokens = 0;
    let outputTokens = 0;

    // ── Use event-based reading (fixes ECONNRESET) ────────────
    await readSSEStream(
      streamResponse.body,
      (parsed) => {
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);

        if (parsed.usageMetadata) {
          inputTokens = parsed.usageMetadata.promptTokenCount || 0;
          outputTokens = parsed.usageMetadata.candidatesTokenCount || 0;
        }
      },
      signal
    );

    if (!signal?.aborted) {
      onDone({
        toolCallCount,
        tokens: { input: inputTokens, output: outputTokens }
      });
    }

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('[STREAM] Aborted cleanly');
      return;
    }
    console.error('[STREAM ERROR]', error.message);
    onError(error.message);
  }
}