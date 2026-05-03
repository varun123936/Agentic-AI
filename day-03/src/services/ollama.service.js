import fetch from 'node-fetch';
import { AI_CONFIG } from '../config/ai.config.js';

const { baseUrl, model, temperature, maxTokens } = AI_CONFIG.ollama;

export async function callOllama(systemPrompt, userMessage) {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    stream: false,
    options: { temperature, num_predict: maxTokens }
  };

  let response;
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    // Network error — Ollama not running
    if (error.code === 'ECONNREFUSED') {
      const err = new Error('Ollama service is not running. Start with: ollama serve');
      err.type = 'AI_SERVICE_UNAVAILABLE';
      throw err;
    }
    throw error;
  }

  const data = await response.json();
  return data.message.content;
}