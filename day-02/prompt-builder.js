// In real production systems, prompts are managed centrally
// They're versioned, tested, and reused across services
// This is a simple version of that pattern

export const Prompts = {

  ticketAnalyzer: {
    system: `You are a support ticket analyzer for an e-commerce company.
Respond ONLY with valid JSON. No explanation. No markdown.
Format exactly:
{
  "summary": "one line summary of the issue",
  "category": "billing | shipping | technical | other",
  "priority": "high | medium | low",
  "suggested_reply": "a short friendly draft reply to the customer"
}`,
    build: (ticketText) => ticketText  // user message is just the ticket
  },

  codeReviewer: {
    system: `You are a senior Node.js engineer doing a code review.
Point out bugs, security issues, and improvements.
Be specific. Reference line numbers if possible.
Keep your response under 200 words.`,
    build: (code) => `Please review this code:\n\n${code}`
  },

  summarizer: {
    system: `You are a document summarizer.
Create a summary with: 
- 3 bullet points of key information
- 1 line conclusion
Keep it under 100 words total.`,
    build: (text) => `Summarize this:\n\n${text}`
  }

};

// Usage example
import { callGemini } from './gemini-test.js'; // if exported

const ticketText = "My invoice shows double charge for last month. Please fix it.";
const response = await callGemini(
  Prompts.ticketAnalyzer.system,
  Prompts.ticketAnalyzer.build(ticketText)
);
console.log(response);
