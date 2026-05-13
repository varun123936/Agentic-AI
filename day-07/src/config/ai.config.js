// NOTE: dotenv is loaded in app.js BEFORE this module is imported.
// Do NOT add 'import dotenv/config' here — it creates an ESM race condition
// where this module may execute before .env is parsed.

function cleanEnvValue(value) {
  if (typeof value !== 'string') return value;
  return value.split('#')[0].trim();
}

const provider = cleanEnvValue(process.env.AI_PROVIDER) || 'gemini';
const geminiApiKey = cleanEnvValue(process.env.GEMINI_API_KEY);
const port = Number.parseInt(cleanEnvValue(process.env.PORT), 10) || 3000;
const corsOrigin = cleanEnvValue(process.env.CORS_ORIGIN) || `http://localhost:${port}`;

if (!['gemini', 'ollama'].includes(provider)) {
  throw new Error(`Unsupported AI_PROVIDER: "${provider}". Must be "gemini" or "ollama".`);
}

if (provider === 'gemini' && !geminiApiKey) {
  throw new Error('GEMINI_API_KEY is required in .env when AI_PROVIDER=gemini');
}

export const AI_CONFIG = {
  provider,
  port,
  corsOrigin,

  gemini: {
    apiKey: geminiApiKey,
    model: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    temperature: 0.7,
    maxOutputTokens: 800
  },

  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'llama3.2',
    temperature: 0.7,
    maxTokens: 800
  }
};
