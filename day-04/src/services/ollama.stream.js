import fetch from 'node-fetch';
import { AI_CONFIG } from '../config/ai.config.js';

const { baseUrl, model, temperature } = AI_CONFIG.ollama;

export async function streamOllama(systemPrompt, userMessage, onChunk, onDone, onError) {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    stream: true,   // Enable streaming
    options: { temperature }
  };

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    // Ollama streams newline-delimited JSON (NDJSON)
    // Each line is a complete JSON object
    let buffer = '';

    for await (const chunk of response.body) {
      buffer += chunk.toString();

      // Process complete lines
      const lines = buffer.split('\n');

      // Keep last incomplete line in buffer
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          // Ollama sends { message: { content: "..." }, done: false }
          if (parsed.message?.content) {
            onChunk(parsed.message.content);
          }

          // done: true means stream is finished
          if (parsed.done) {
            onDone();
            return;
          }
        } catch (e) {
          // Skip malformed lines
        }
      }
    }

    onDone();

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      onError(new Error('Ollama is not running. Run: ollama serve'));
    } else {
      onError(error);
    }
  }
}