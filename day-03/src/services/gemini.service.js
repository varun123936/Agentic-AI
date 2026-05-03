import fetch from 'node-fetch';
import { AI_CONFIG } from '../config/ai.config.js';

const { apiKey, model, baseUrl, temperature, maxOutputTokens } = AI_CONFIG.gemini;

export async function callGemini(systemPrompt, userMessage) {
  const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      { role: 'user', parts: [{ text: userMessage }] }
    ],
    generationConfig: { temperature, maxOutputTokens }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  // Gemini-specific error handling
  if (data.error) {
    const err = new Error(data.error.message);
    err.statusCode = data.error.code;
    err.type = 'AI_PROVIDER_ERROR';
    throw err;
  }

  // Check if response was blocked (safety filters)
  if (!data.candidates || data.candidates.length === 0) {
    const err = new Error('AI response was blocked or empty');
    err.type = 'AI_BLOCKED_RESPONSE';
    throw err;
  }

  return data.candidates[0].content.parts[0].text;
}