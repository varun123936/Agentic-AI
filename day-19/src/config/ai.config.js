import dotenv from 'dotenv';
dotenv.config();

export const AI_CONFIG = {
  // Switch provider via .env: AI_PROVIDER=gemini or AI_PROVIDER=ollama
  provider: process.env.AI_PROVIDER || 'gemini',

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    temperature: 0.2,
    maxOutputTokens: 2000
  },

  ollama: {
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'gemma4:cloud',
    temperature: 0.2
  }
};