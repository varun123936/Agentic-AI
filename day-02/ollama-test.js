// Ollama runs locally on http://localhost:11434
// It has an OpenAI-compatible API format
// No API key needed â€” completely free and offline

import fetch from 'node-fetch';

async function callOllama(systemPrompt, userMessage, model = 'llama3.2') {
  const requestBody = {
    model: model,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userMessage
      }
    ],
    stream: false,        // we'll do streaming on Day 4
    options: {
      temperature: 0.2,
      num_predict: 500    // max tokens to generate
    }
  };

  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // Ollama response structure
    const text = data.message.content;
    return text;

  } catch (error) {
    // Common mistake: Ollama server not running
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Ollama is not running. Start it with: ollama serve');
    }
    throw error;
  }
}

// --- TEST 1: Simple question ---
const systemPrompt = `You are a helpful assistant. Be concise and clear.`;
const userMessage = `What is MongoDB and when should I use it?`;

console.log('Calling Ollama (local)...\n');
const result = await callOllama(systemPrompt, userMessage);
console.log('Ollama Response:\n', result);

// --- TEST 2: Same ticket test as Gemini ---
const jsonSystemPrompt = `You are a ticket analyzer.
Respond ONLY with valid JSON. No explanation. No markdown code blocks.
Format: {"summary": "...", "priority": "high|medium|low", "category": "billing|shipping|technical|other"}`;

const ticket = `Hi, I ordered 3 days ago and my package hasn't moved. 
Tracking shows it's stuck at the warehouse. Order #45123. Please help!`;

console.log('\nCalling Ollama for structured output...\n');
const jsonResult = await callOllama(jsonSystemPrompt, ticket);
console.log('Raw response:', jsonResult);

try {
  // Sometimes local models add extra whitespace â€” trim it
  const cleaned = jsonResult.trim().replace(/^```json|```$/g, '').trim();
  const parsed = JSON.parse(cleaned);
  console.log('\nParsed Object:', parsed);
} catch (e) {
  console.error('Parse failed. Local models sometimes need stricter prompts.');
  console.log('Raw was:', jsonResult);
}
