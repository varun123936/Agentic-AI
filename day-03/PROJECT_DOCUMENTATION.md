# Day-03: AI-Powered Ticket Analysis System

## Table of Contents

1. [Project Overview](#project-overview)
2. [What Changed From Day-02](#what-changed-from-day-02)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Environment Variables](#environment-variables)
6. [API Endpoints](#api-endpoints)
7. [Core Workflows](#core-workflows)
8. [Prompt Engineering](#prompt-engineering)
9. [Middleware & Validation](#middleware--validation)
10. [Postman Testing Guide](#postman-testing-guide)
11. [Running the Application](#running-the-application)
12. [Learning Outcomes](#learning-outcomes)

---

## Project Overview

Day-03 focuses on transforming a raw AI chat into a **structured business tool**. The goal is to build a system that can take unstructured customer support tickets and analyze them into a machine-readable JSON format (sentiment, category, urgency).

### Core Features

- **Structured AI Output**: Using system prompts to force the AI to return valid JSON instead of conversational text.
- **Ticket Analysis**: Automatically identifying the tone, intent, and priority of customer emails.
- **Bulk Processing**: Ability to analyze multiple tickets in a single request using `Promise.allSettled`.
- **Input Validation**: Middleware to ensure ticket text meets length and format requirements.
- **Rate Limiting**: Protecting the AI API from abuse using `express-rate-limit`.
- **AI Health Check**: An endpoint to verify the AI provider is reachable and responding correctly.

### Tech Stack

- **Backend**: Express.js
- **AI Providers**: Gemini or Ollama
- **Validation**: Custom middleware
- **Rate Limiting**: `express-rate-limit`

---

## What Changed From Day-02

Day-02 was about "Hello World" with AI. Day-03 adds the "Enterprise" layer:

- **Raw Text $\rightarrow$ Structured JSON**: We no longer just print AI output; we parse it into objects.
- **Script $\rightarrow$ API**: Interaction moved from `.js` scripts to a real HTTP server.
- **Single $\rightarrow$ Bulk**: Added the capability to process arrays of tickets.
- **No Protection $\rightarrow$ Guarded**: Added rate limiting and input validation middleware.
- **Hardcoded $\rightarrow$ Prompt-Driven**: Introduced a dedicated prompts directory to separate "what the AI is told" from "how the code works".

---

## Architecture

```text
Client (Postman)
  |
  v
Express app: src/app.js
  |
  |-- /api/tickets    -> ticket.routes.js
  |
  v
Middleware
  |
  |-- aiRateLimiter (Prevent spam)
  |-- validateTicketInput (Check length/format)
  |
  v
Services
  |
  |-- ai.service.js (Unified AI Wrapper)
  |-- gemini.service.js / ollama.service.js (Provider Logic)
  |
  v
AI Provider (Gemini / Ollama)
  |
  v
Structured JSON Response
```

---

## Project Structure

```text
day-03/
  src/
    app.js                   # Server entry point
    config/
      ai.config.js           # Provider configuration
    middleware/
      errorHandler.js        # Global error handler
      rateLimiter.js         # API rate limiting
      validate.js            # Input validation logic
    prompts/
      ticket.prompts.js       # System and user prompt templates
    routes/
      ticket.routes.js       # Ticket analysis endpoints
    services/
      ai.service.js          # Main AI service (wraps providers)
      gemini.service.js      # Gemini API implementation
      ollama.service.js      # Ollama API implementation
  .env                        # API Keys and Settings
  package.json                # Dependencies
  PROJECT_DOCUMENTATION.md    # This file
```

---

## Environment Variables

```env
PORT=3000
AI_PROVIDER=gemini            # "gemini" or "ollama"
GEMINI_API_KEY=your_api_key    # Required for Gemini
OLLAMA_BASE_URL=http://localhost:11434 # Required for Ollama
```

---

## API Endpoints

### Tickets: `/api/tickets`

| Method | Endpoint | Rate Limit | Description |
| --- | --- | --- | --- |
| POST | `/analyze` | Yes | Analyze a single customer ticket |
| POST | `/bulk-analyze` | Yes | Analyze multiple tickets in parallel |
| GET | `/health` | No | Verify AI provider connectivity |

---

## Core Workflows

### 1. Single Ticket Analysis
**Endpoint:** `POST /api/tickets/analyze`  
**Input:** `{ "text": "I am very angry that my package is late!", "customerEmail": "user@example.com" }`  
**Flow:**
1. **Rate Limiter**: Checks if user has exceeded the request limit.
2. **Validation**: Ensures `text` is present and within length limits.
3. **Prompt Building**: Combines the system prompt from `ticket.prompts.js` with the user's text.
4. **AI Call**: Calls the provider (Gemini/Ollama).
5. **JSON Parsing**: `parseAIJson` extracts the JSON object from the AI's string response.
6. **Response**: Returns a structured object containing the analysis and latency metadata.

### 2. Bulk Ticket Analysis
**Endpoint:** `POST /api/tickets/bulk-analyze`  
**Input:** `{ "tickets": ["Ticket 1 text...", "Ticket 2 text...", ...] }`  
**Flow:**
1. **Parallel Execution**: Maps the ticket array to a set of `callAI` promises.
2. **`Promise.allSettled`**: Ensures that if one AI call fails, others still complete.
3. **Result Mapping**: Categorizes results as `fulfilled` (success) or `rejected` (error).
4. **Summary**: Returns a count of succeeded vs failed analysis.

---

## Prompt Engineering

The key to Day-03 is the **System Prompt**. Instead of asking "What do you think of this?", the prompt explicitly instructs the AI:

- **Role**: "You are an expert customer support analyst."
- **Format**: "You MUST return only a valid JSON object."
- **Schema**: "Include fields: `sentiment` (positive/negative/neutral), `category` (billing/tech/general), and `urgency` (low/medium/high)."
- **Constraint**: "Do not include any conversational text or markdown blocks."

This turns the AI into a **deterministic function** that can be integrated into a software pipeline.

---

## Middleware & Validation

### Input Validation (`validate.js`)
Prevents the AI from being called with empty or excessively long strings, which saves API costs and prevents timeouts.

### Rate Limiting (`rateLimiter.js`)
Uses `express-rate-limit` to prevent brute-force usage of the AI endpoints.

### Global Error Handling (`errorHandler.js`)
Catches all `next(error)` calls and returns a consistent JSON error format:
`{ "success": false, "error": "Detailed error message" }`

---

## Postman Testing Guide

### 1. Health Check
- **Method:** `GET`
- **URL:** `{{base_url}}/api/tickets/health`
- **Expected:** `{ "success": true, "ai": { "status": "ok" } }`

### 2. Analyze Single Ticket
- **Method:** `POST`
- **URL:** `{{base_url}}/api/tickets/analyze`
- **Body (JSON):**
  ```json
  {
    "text": "The app crashes every time I open the settings menu. Extremely frustrating!",
    "customerEmail": "test@example.com"
  }
  ```
- **Expected:** A JSON response with `sentiment: "negative"`, `category: "tech"`, and `urgency: "high"`.

### 3. Bulk Analysis
- **Method:** `POST`
- **URL:** `{{base_url}}/api/tickets/bulk-analyze`
- **Body (JSON):**
  ```json
  {
    "tickets": [
      "I love the new update!",
      "Where is my refund?",
      "The login page is slow."
    ]
  }
  ```
- **Expected:** An array of 3 analysis results with a summary of success/failure.

---

## Running the Application

```bash
cd day-03
npm install
# Set .env with AI_PROVIDER and API keys
npm start
```
Server runs at `http://localhost:3000`.

---

## Learning Outcomes

After Day-03, you should understand:
1. **Structured AI Outputs**: How to use system prompts to force AI to return JSON.
2. **API Integration**: Moving from scripts to an Express.js API.
3. **Input Sanitization**: Implementing validation middleware to protect AI endpoints.
4. **Concurrency in Node.js**: Using `Promise.allSettled` for bulk AI processing.
5. **Resilience**: Implementing rate limiting and global error handling for production-grade APIs.
6. **Prompt Versioning**: Separating prompt logic from business logic.
