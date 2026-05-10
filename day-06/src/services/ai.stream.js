import fetch from 'node-fetch';
import { AI_CONFIG } from '../config/ai.config.js';

const MODEL = 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ── Unified streaming interface ───────────────────────────────
// Routes to correct provider based on AI_CONFIG
// history = [{ role: 'user'|'assistant', content: '...' }]

export async function streamAI(
  systemPrompt,
  history,
  newMessage,
  onChunk,
  onDone,
  onError,
  signal     // AbortController signal for client disconnect
) {
  const provider = AI_CONFIG.provider;

  if (provider === 'gemini') {
    await streamGemini(systemPrompt, history, newMessage, onChunk, onDone, onError, signal);
  } else if (provider === 'ollama') {
    await streamOllama(systemPrompt, history, newMessage, onChunk, onDone, onError, signal);
  } else {
    onError(new Error(`Unknown AI provider: ${provider}`));
  }
}

// ── Gemini 2.5 Flash streaming ────────────────────────────────
async function streamGemini(
  systemPrompt,
  history,
  newMessage,
  onChunk,
  onDone,
  onError,
  signal
) {
  const { apiKey, temperature, maxOutputTokens } = AI_CONFIG.gemini;
  const url = `${BASE_URL}/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  // Gemini uses 'model' role instead of 'assistant'
  // Build full contents array from history + new message
  const contents = [
    ...history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    })),
    {
      role: 'user',
      parts: [{ text: newMessage }]
    }
  ];

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal   // Passed from AbortController in route
    });

    if (!response.ok) {
      const errData = await response.json();
      const err = new Error(errData.error?.message || 'Gemini stream failed');
      err.type = 'AI_PROVIDER_ERROR';
      err.statusCode = response.status;
      throw err;
    }

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const rawChunk of response.body) {
      // Stop processing if client disconnected
      if (signal?.aborted) break;

      const lines = rawChunk.toString().split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.replace('data: ', '').trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);

          // Extract text content
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            onChunk(text);
          }

          // Safety block check
          const finishReason = parsed.candidates?.[0]?.finishReason;
          if (finishReason === 'SAFETY') {
            const err = new Error('Response blocked by Gemini safety filters');
            err.type = 'AI_BLOCKED_RESPONSE';
            onError(err);
            return;
          }

          // Token usage — comes in the final chunk from Gemini 2.5
          if (parsed.usageMetadata) {
            inputTokens = parsed.usageMetadata.promptTokenCount || 0;
            outputTokens = parsed.usageMetadata.candidatesTokenCount || 0;
          }

        } catch (e) {
          // Partial JSON mid-chunk — completely normal, skip it
        }
      }
    }

    if (!signal?.aborted) {
      onDone({ inputTokens, outputTokens });
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      // Clean disconnect — not an error
      console.log('[Gemini] Stream aborted by client');
      return;
    }
    onError(error);
  }
}

// ── Ollama local streaming ────────────────────────────────────
async function streamOllama(
  systemPrompt,
  history,
  newMessage,
  onChunk,
  onDone,
  onError,
  signal
) {
  const { baseUrl, model, temperature } = AI_CONFIG.ollama;

  // Ollama uses standard role names including 'system'
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(msg => ({
      role: msg.role,   // 'user' or 'assistant' — both valid in Ollama
      content: msg.content
    })),
    { role: 'user', content: newMessage }
  ];

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          temperature,
          num_predict: 1000
        }
      }),
      signal
    });

    // Ollama sends newline-delimited JSON (NDJSON)
    // Each line = one complete JSON object
    // Buffer handles cases where chunk splits across lines
    let buffer = '';

    for await (const rawChunk of response.body) {
      if (signal?.aborted) break;

      buffer += rawChunk.toString();

      // Process all complete lines
      const lines = buffer.split('\n');

      // Last element may be incomplete — keep in buffer
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          if (parsed.message?.content) {
            onChunk(parsed.message.content);
          }

          // done: true = stream complete
          if (parsed.done === true) {
            // Ollama doesn't give token counts in same format
            // Return 0 — usage tracking only works for Gemini
            onDone({ inputTokens: 0, outputTokens: 0 });
            return;
          }

          // Ollama error in stream
          if (parsed.error) {
            throw new Error(parsed.error);
          }

        } catch (e) {
          // Skip malformed lines
        }
      }
    }

    if (!signal?.aborted) {
      onDone({ inputTokens: 0, outputTokens: 0 });
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('[Ollama] Stream aborted by client');
      return;
    }
    if (error.code === 'ECONNREFUSED') {
      const err = new Error('Ollama is not running. Start it with: ollama serve');
      err.type = 'AI_SERVICE_UNAVAILABLE';
      onError(err);
    } else {
      onError(error);
    }
  }
}

// ── Non-streaming AI call (for JSON output tasks) ─────────────
// Use this when you need to parse AI response as JSON
// Do NOT use streamAI for JSON — you can't parse half-arrived JSON

export async function callAI(systemPrompt, userMessage) {
  const provider = AI_CONFIG.provider;

  if (provider === 'gemini') {
    return callGemini(systemPrompt, userMessage);
  } else {
    return callOllama(systemPrompt, userMessage);
  }
}

async function callGemini(systemPrompt, userMessage) {
  const { apiKey, temperature, maxOutputTokens } = AI_CONFIG.gemini;
  const url = `${BASE_URL}/${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { temperature, maxOutputTokens }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (data.error) {
    const err = new Error(data.error.message);
    err.type = 'AI_PROVIDER_ERROR';
    throw err;
  }

  if (!data.candidates?.length) {
    const err = new Error('Empty response from Gemini');
    err.type = 'AI_BLOCKED_RESPONSE';
    throw err;
  }

  return data.candidates[0].content.parts[0].text;
}

async function callOllama(systemPrompt, userMessage) {
  const { baseUrl, model, temperature } = AI_CONFIG.ollama;

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        stream: false,
        options: { temperature }
      })
    });

    const data = await response.json();
    return data.message.content;

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      const err = new Error('Ollama is not running. Start it with: ollama serve');
      err.type = 'AI_SERVICE_UNAVAILABLE';
      throw err;
    }
    throw error;
  }
}

// ── Parse AI JSON response safely ────────────────────────────
export function parseAIJson(rawText) {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const err = new Error(`AI returned invalid JSON. Raw: ${cleaned.substring(0, 200)}`);
    throw err;
  }
}