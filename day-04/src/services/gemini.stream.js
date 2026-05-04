import fetch from 'node-fetch';
import { AI_CONFIG } from '../config/ai.config.js';

const { apiKey, model, baseUrl, temperature, maxOutputTokens } = AI_CONFIG.gemini;

// onChunk: callback fired for every text chunk received
// onDone: callback fired when stream completes
// onError: callback fired on error

export async function streamGemini(systemPrompt, userMessage, onChunk, onDone, onError) {
  // Notice: streamGenerateContent instead of generateContent
  const url = `${baseUrl}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      { role: 'user', parts: [{ text: userMessage }] }
    ],
    generationConfig: { temperature, maxOutputTokens }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini stream failed');
    }

    // response.body is a Node.js ReadableStream
    // We read it chunk by chunk
    for await (const chunk of response.body) {
      // Convert buffer to string
      const chunkText = chunk.toString();

      // SSE format: each line starts with "data: "
      // Split by lines to handle multiple chunks in one buffer
      const lines = chunkText.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.replace('data: ', '').trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            onChunk(text);  // Fire callback with each text piece
          }
        } catch (e) {
          // Sometimes chunks are split mid-JSON — skip partial chunks
          // This is normal in streaming
        }
      }
    }

    onDone();  // Stream finished

  } catch (error) {
    onError(error);
  }
}