import fetch from 'node-fetch';
import { AI_CONFIG } from '../config/ai.config.js';

const MODEL = 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// history = [{ role: 'user', content: '...' }, { role: 'assistant', content: '...' }]
export async function streamAI(systemPrompt, history, newMessage, onChunk, onDone, onError, signal) {

  const provider = AI_CONFIG.provider;

  if (provider === 'gemini') {
    await streamGemini(systemPrompt, history, newMessage, onChunk, onDone, onError, signal);
  } else {
    await streamOllama(systemPrompt, history, newMessage, onChunk, onDone, onError, signal);
  }
}

async function streamGemini(systemPrompt, history, newMessage, onChunk, onDone, onError, signal) {
  const { apiKey, temperature, maxOutputTokens } = AI_CONFIG.gemini;
  const url = `${BASE_URL}/${MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

  // Build Gemini contents array from history + new message
  // Gemini uses 'model' not 'assistant' for role
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
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature, maxOutputTokens }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Gemini error');
    }

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of response.body) {
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
        } catch (e) { /* partial chunk */ }
      }
    }

    onDone({ inputTokens, outputTokens });

  } catch (error) {
    if (error.name === 'AbortError') return;
    onError(error);
  }
}

async function streamOllama(systemPrompt, history, newMessage, onChunk, onDone, onError, signal) {
  const { baseUrl, model, temperature } = AI_CONFIG.ollama;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(msg => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: newMessage }
  ];

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true, options: { temperature } }),
      signal
    });

    let buffer = '';
    for await (const chunk of response.body) {
      if (signal?.aborted) break;
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) onChunk(parsed.message.content);
          if (parsed.done) { onDone({ inputTokens: 0, outputTokens: 0 }); return; }
        } catch (e) { }
      }
    }
    onDone({ inputTokens: 0, outputTokens: 0 });

  } catch (error) {
    if (error.name === 'AbortError') return;
    if (error.code === 'ECONNREFUSED') {
      onError(new Error('Ollama not running. Run: ollama serve'));
    } else {
      onError(error);
    }
  }
}