// Unified streaming interface
// Routes to correct provider

import { streamGemini } from './gemini.stream.js';
import { streamOllama } from './ollama.stream.js';
import { AI_CONFIG } from '../config/ai.config.js';

export async function streamAI(systemPrompt, userMessage, onChunk, onDone, onError) {
  const provider = AI_CONFIG.provider;

  if (provider === 'gemini') {
    return streamGemini(systemPrompt, userMessage, onChunk, onDone, onError);
  } else if (provider === 'ollama') {
    return streamOllama(systemPrompt, userMessage, onChunk, onDone, onError);
  } else {
    onError(new Error(`Unknown AI provider: ${provider}`));
  }
}