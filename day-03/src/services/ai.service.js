// This is the UNIFIED AI interface
// Routes call to correct provider based on config
// Also handles JSON parsing with fallback

import { callGemini } from './gemini.service.js';
import { callOllama } from './ollama.service.js';
import { AI_CONFIG } from '../config/ai.config.js';

export async function callAI(systemPrompt, userMessage) {
  const provider = AI_CONFIG.provider;

  let rawResponse;

  if (provider === 'gemini') {
    rawResponse = await callGemini(systemPrompt, userMessage);
  } else if (provider === 'ollama') {
    rawResponse = await callOllama(systemPrompt, userMessage);
  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }

  return rawResponse;
}

export function parseAIJson(rawText) {
  // AI sometimes wraps JSON in markdown code blocks
  // This cleaner handles that defensively
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')   // remove opening ```json
    .replace(/^```\s*/i, '')       // remove opening ```
    .replace(/\s*```$/i, '')       // remove closing ```
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Return error info instead of crashing
    throw new Error(`AI returned invalid JSON. Raw: ${cleaned.substring(0, 200)}`);
  }
}