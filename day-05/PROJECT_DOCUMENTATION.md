# Day-05: AI Chat Platform with Conversation History & Usage Tracking

## Table of Contents

1. [Project Overview](#project-overview)
2. [What Changed From Day-04](#what-changed-from-day-04)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Environment Variables](#environment-variables)
6. [API Endpoints](#api-endpoints)
7. [Core Workflows](#core-workflows)
8. [Database Schema](#database-schema)
9. [Postman Testing Guide](#postman-testing-guide)
10. [Running the Application](#running-the-application)
11. [Learning Outcomes](#learning-outcomes)

---

## Project Overview

Day-05 evolves the streaming AI interaction from a stateless "one-off" chat into a full-fledged chat platform. It introduces the concept of **Conversations**, allowing users to maintain persistent chat sessions, retrieve history, and track their AI usage.

### Core Features

- **Conversation Management**: Create, list, and retrieve messages for specific chat sessions.
- **Persistent Memory**: AI responses are now context-aware, loading the last 20 messages of a conversation to maintain continuity.
- **Real-time Streaming**: Integration with Gemini and Ollama using Server-Sent Events (SSE).
- **AI Usage Analytics**: Every request is tracked (tokens used, provider, latency, and estimated cost).
- **Automated Summarization**: AI-powered summarization of long conversations into 3 concise bullet points.
- **User Identification**: Basic user tracking via `x-user-id` request headers.

### Tech Stack

- **Backend**: Express.js
- **Database**: MongoDB with Mongoose
- **AI Providers**: Gemini or Ollama
- **Streaming**: Server-Sent Events (SSE)

---

## What Changed From Day-04

Day-04 focused on the mechanical ability to stream a response. Day-05 adds the "Product" layer:

- **Stateless $\rightarrow$ Stateful**: Instead of a single `/stream` endpoint, we now have `/conversations` to group messages.
- **Added Database**: MongoDB now stores `Conversations`, `Messages`, and `AiUsage` records.
- **Context Window**: The system now fetches historical messages from the DB and feeds them back into the AI prompt.
- **Analytics Layer**: Added `AiUsage` model to track token consumption and provider costs.
- **Summarization**: Added a specific workflow to summarize an entire conversation.

---

## Architecture

```text
Client (Postman/Web)
  |
  v
Express app: src/app.js
  |
  |-- /api/chat       -> chat.routes.js
  |
  v
Services
  |
  |-- conversation.service.js (DB Logic, History, Summaries)
  |-- ai.stream.js           (AI Provider Orchestration)
  |
  v
MongoDB Models
  |
  |-- Conversation (Metadata & Summary)
  |-- Message       (User & Assistant content + AI Meta)
  |-- AiUsage       (Token counts, Cost, Provider)
```

### Request Flow: Sending a Message
1. Client sends message to `/api/chat/conversations/:id/stream` with `x-user-id` header.
2. Route verifies conversation ownership.
3. `saveUserMessage` saves the input to MongoDB.
4. `getMessageHistory` fetches the last 20 messages for AI context.
5. `streamAI` sends the context + new message to the provider (Gemini/Ollama).
6. Chunks are streamed to the client via SSE.
7. On completion, `saveAssistantMessage` saves the AI response and creates an `AiUsage` record.

---

## Project Structure

```text
day-05/
  src/
    app.js
    config/
      ai.config.js
      db.config.js
    models/
      aiUsage.model.js
      conversation.model.js
      message.model.js
    routes/
      chat.routes.js
    services/
      ai.stream.js
      conversation.service.js
  .env
  package.json
  PROJECT_DOCUMENTATION.md
```

---

## Environment Variables

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ai-course-day05
AI_PROVIDER=gemini
GEMINI_API_KEY=your_api_key_here
```

---

## API Endpoints

### Chat: `/api/chat`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/conversations` | Header | Create a new conversation |
| GET | `/conversations` | Header | List all conversations for the user |
| GET | `/conversations/:id/messages` | Header | Get message history for a conversation |
| POST | `/conversations/:id/stream` | Header | Send message and stream AI response |
| GET | `/usage` | Header | Get total AI usage stats for the user |
| POST | `/conversations/:id/summarize` | Header | Generate a 3-point summary of the chat |

*Note: "Header" auth refers to providing `x-user-id` in the request headers.*

---

## Core Workflows

### 1. Creating a Conversation
**Endpoint:** `POST /api/chat/conversations`  
**Header:** `x-user-id: user_123`  
**Result:** A new MongoDB document in the `conversations` collection. The title is initially "New Conversation".

### 2. Streaming a Chat
**Endpoint:** `POST /api/chat/conversations/:id/stream`  
**Body:** `{ "message": "Hello AI!" }`  
**Flow:** 
- User message saved $\rightarrow$ Context loaded $\rightarrow$ AI Streamed $\rightarrow$ Assistant message saved $\rightarrow$ Usage tracked.
- The title of the conversation is automatically updated based on the first message sent.

### 3. Summarizing a Chat
**Endpoint:** `POST /api/chat/conversations/:id/summarize`  
**Flow:**
- Fetches all messages in the conversation.
- Builds a specialized summarization prompt.
- AI generates a 3-bullet point summary.
- Summary is saved to the `Conversation` document for quick retrieval.

---

## Database Schema

### Conversation Model
```javascript
{
  userId: String,
  title: String,
  status: 'active' | 'archived',
  messageCount: Number,
  totalTokensUsed: Number,
  lastMessageAt: Date,
  summary: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Message Model
```javascript
{
  conversationId: ObjectId,
  role: 'user' | 'assistant' | 'system',
  content: String,
  aiMeta: {
    model: String,
    provider: String,
    inputTokens: Number,
    outputTokens: Number,
    totalTokens: Number,
    latencyMs: Number,
    estimatedCostUsd: Number
  }
}
```

### AiUsage Model
```javascript
{
  conversationId: ObjectId,
  messageId: ObjectId,
  userId: String,
  provider: String,
  model: String,
  inputTokens: Number,
  outputTokens: Number,
  totalTokens: Number,
  estimatedCostUsd: Number,
  isFree: Boolean,
  operation: String // e.g., 'chat' or 'summarize'
}
```

---

## Postman Testing Guide

### 1. Create Conversation
- **Method:** `POST`
- **URL:** `{{base_url}}/api/chat/conversations`
- **Headers:** `x-user-id: test_user_1`
- **Response:** Save `data._id` as `conversation_id`.

### 2. Send Message (Stream)
- **Method:** `POST`
- **URL:** `{{base_url}}/api/chat/conversations/{{conversation_id}}/stream`
- **Headers:** `x-user-id: test_user_1`
- **Body:** `{ "message": "Explain Quantum Physics simply." }`
- **Observation:** Watch for `data: {"type":"chunk", ...}` events.

### 3. Get History
- **Method:** `GET`
- **URL:** `{{base_url}}/api/chat/conversations/{{conversation_id}}/messages`
- **Headers:** `x-user-id: test_user_1`

### 4. Summarize
- **Method:** `POST`
- **URL:** `{{base_url}}/api/chat/conversations/{{conversation_id}}/summarize`
- **Headers:** `x-user-id: test_user_1`

---

## Running the Application

```bash
cd day-05
npm install
# Setup .env with MONGODB_URI and AI_PROVIDER
npm start
```
Server runs at `http://localhost:3000`.

---

## Learning Outcomes

After Day-05, you should understand:
1. **Stateful AI Interactions**: How to move from a single request to a multi-turn conversation.
2. **Context Management**: How to retrieve and format historical messages to provide AI "memory".
3. **Database Integration**: Using MongoDB to store semi-structured AI data (messages, tokens, costs).
4. **Complex AI Workflows**: Implementing a summarization pipeline that reads from the DB and writes back to it.
5. **AI Cost Tracking**: Calculating and storing the token-based cost of AI requests for analytics.
