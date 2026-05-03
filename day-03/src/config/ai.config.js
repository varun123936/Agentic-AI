import 'dotenv/config';

// Central config for all AI settings
// Change provider here - nothing else needs to change

export const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'gemini',

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    temperature: 0.2,
    maxOutputTokens: 800,
  },

  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.2,
    maxTokens: 800,
  }
};
