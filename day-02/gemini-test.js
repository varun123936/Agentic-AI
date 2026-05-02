// We use raw fetch so you understand what's actually happening
// No magic libraries yet Ã¢â‚¬â€ you need to see the real request structure

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function callGemini(systemPrompt, userMessage) {
  const requestBody = {
    // Gemini uses "contents" array
    // system instruction is separate from user message
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }]
      }
    ],
    generationConfig: {
      temperature: 0.2,       // 0 = focused/deterministic, 1 = creative
      maxOutputTokens: 500,   // limit response size = control cost
    }
  };

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // Always check for errors from the API
    if (data.error) {
      throw new Error(`Gemini API Error: ${data.error.message}`);
    }

    // Extract the actual text from nested response
    const text = data.candidates[0].content.parts[0].text;
    return text;

  } catch (error) {
    console.error('Error calling Gemini:', error.message);
    throw error;
  }
}

// --- TEST 1: Simple question ---
const systemPrompt = `You are a helpful assistant. 
Always respond in plain English. Be concise.`;

const userMessage = `Explain what a REST API is in 2 sentences.`;

console.log('Calling Gemini...\n');
const result = await callGemini(systemPrompt, userMessage);
console.log('Gemini Response:\n', result);

// --- TEST 2: Structured JSON output ---
const jsonSystemPrompt = `You are a ticket analyzer.
Respond ONLY with a valid JSON object. No extra text. No markdown.
Format: {"summary": "...", "priority": "high|medium|low", "category": "billing|shipping|technical|other"}`;

const ticket = `Hi, I ordered 3 days ago and my package hasn't moved. 
Tracking shows it's stuck at the warehouse. Order #45123. Please help!`;

console.log('\nCalling Gemini for structured output...\n');
const jsonResult = await callGemini(jsonSystemPrompt, ticket);
console.log('Raw response:', jsonResult);

// Parse it like a real backend would
try {
  const parsed = JSON.parse(jsonResult.trim());
  console.log('\nParsed Object:', parsed);
  console.log('Priority:', parsed.priority);
  console.log('Category:', parsed.category);
} catch (e) {
  console.error('JSON parse failed Ã¢â‚¬â€ prompt needs adjustment');
}
