# Day-07: AI Document Chat Platform

## Table of Contents

1. [Project Overview](#project-overview)
2. [What Changed From Day-06](#what-changed-from-day-06)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Environment Variables](#environment-variables)
6. [API Endpoints](#api-endpoints)
7. [Document Workflows](#document-workflows)
8. [Database Schema](#database-schema)
9. [Postman Testing Guide](#postman-testing-guide)
10. [Security and Limits](#security-and-limits)
11. [Running the Application](#running-the-application)
12. [Learning Outcomes](#learning-outcomes)

---

## Project Overview

Day-07 builds on the authenticated AI chat platform from Day-06 and adds document upload plus document-aware AI Q&A.

Users can now upload PDF or text-like documents, extract searchable text, store document metadata in MongoDB, ask questions about one document, ask questions across multiple documents, and request streaming summaries.

### Core Features

- User registration and login with JWT.
- Role-based access control for admin APIs.
- AI chat with conversation history and Server-Sent Events streaming.
- Daily token budget checks for chat requests.
- AI usage tracking for analytics.
- Document upload using `multer`.
- PDF text extraction using `pdf-parse`.
- Text extraction for plain text and markdown-style files.
- Single-document Q&A using document context.
- Multi-document Q&A for up to 10 documents at once.
- Streaming document summaries.
- Soft delete for documents.
- Per-user document ownership checks.

### Tech Stack

- Backend: Express.js 5
- Runtime: Node.js ESM
- Database: MongoDB with Mongoose
- Auth: JWT with bcrypt password hashing
- AI providers: Gemini or Ollama through `ai.stream.js`
- Uploads: multer
- PDF parsing: pdf-parse
- Rate limiting: express-rate-limit

---

## What Changed From Day-06

Day-06 focused on authenticated AI chat, usage tracking, and admin analytics.

Day-07 keeps that foundation and adds a new document layer:

- New route module: `src/routes/document.routes.js`
- New service: `src/services/document.service.js`
- New model: `src/models/document.model.js`
- New middleware: `src/middleware/upload.middleware.js`
- New app mount: `app.use('/api/documents', documentRoutes)`
- New env fields: `UPLOAD_DIR` and `MAX_FILE_SIZE_MB`

The main Day-07 learning topic is Retrieval-Augmented style behavior without a vector database yet: the app extracts document text, places relevant document content into the AI system prompt, and streams an answer.

---

## Architecture

```text
Client / Postman
  |
  v
Express app: src/app.js
  |
  |-- /api/auth       -> auth.routes.js
  |-- /api/chat       -> chat.routes.js
  |-- /api/admin      -> admin.routes.js
  |-- /api/documents  -> document.routes.js
  |
  v
Middleware
  |
  |-- authenticate
  |-- requireAdmin
  |-- rate limiters
  |-- upload middleware
  |-- error handler
  |
  v
Services
  |
  |-- conversation.service.js
  |-- document.service.js
  |-- ai.stream.js
  |
  v
MongoDB Models
  |
  |-- User
  |-- Conversation
  |-- Message
  |-- AiUsage
  |-- Document
```

For document Q&A, the flow is:

```text
Upload file
  -> multer stores local file
  -> document.service extracts text
  -> Document record stores file metadata and extracted text
  -> user asks a question
  -> service builds a document-aware system prompt
  -> ai.stream.js streams Gemini/Ollama response
  -> document queryCount increments
```

---

## Project Structure

```text
day-07/
  src/
    app.js
    env.js
    config/
      ai.config.js
      db.config.js
    middleware/
      auth.middleware.js
      errorHandler.js
      rateLimiter.js
      upload.middleware.js
    models/
      aiUsage.model.js
      conversation.model.js
      document.model.js
      message.model.js
      user.model.js
    routes/
      admin.routes.js
      auth.routes.js
      chat.routes.js
      document.routes.js
    services/
      ai.stream.js
      conversation.service.js
      document.service.js
  .env
  package.json
  PROJECT_DOCUMENTATION.md
```

---

## Environment Variables

Day-07 reads these fields:

```env
NODE_ENV=development
GEMINI_API_KEY=your_actual_key_here
AI_PROVIDER=gemini
PORT=3000
CORS_ORIGIN=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/ai-course
JWT_SECRET=your_super_secret_key_change_this_min_32_chars
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=10
```

Notes:

- `AI_PROVIDER` can be `gemini` or `ollama`.
- `UPLOAD_DIR` is resolved relative to the project root.
- `MAX_FILE_SIZE_MB` controls the multer upload limit.
- Keep `.env` local only. The root `.gitignore` already ignores `.env`.

---

## API Endpoints

### Health

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | No | Check server status and active AI provider |

### Authentication: `/api/auth`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/register` | No | Register a user |
| POST | `/login` | No | Login and receive JWT |
| GET | `/me` | Yes | Get current user profile |
| POST | `/logout` | Yes | Client-side logout confirmation |

### Chat: `/api/chat`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/conversations` | Yes | Create a conversation |
| GET | `/conversations` | Yes | List user's conversations |
| GET | `/conversations/:id/messages` | Yes | Get messages for a conversation |
| POST | `/conversations/:id/stream` | Yes | Send message and stream AI response |
| GET | `/usage` | Yes | Get user's AI usage stats |

### Admin: `/api/admin`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/users` | Admin | List all users |
| GET | `/usage` | Admin | System usage analytics |
| GET | `/stats` | Admin | Dashboard totals |
| PATCH | `/users/:id/token-limit` | Admin | Update user's daily token limit |

### Documents: `/api/documents`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/upload` | Yes | Upload and process a document |
| GET | `/` | Yes | List current user's documents |
| GET | `/:id` | Yes | Get document metadata |
| POST | `/:id/chat` | Yes | Ask a question about one document |
| POST | `/multi-chat` | Yes | Ask a question across multiple documents |
| POST | `/:id/summarize` | Yes | Stream an AI summary for a document |
| DELETE | `/:id` | Yes | Soft delete a document |

---

## Document Workflows

### Upload Document

Endpoint:

```http
POST /api/documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Form field:

```text
file=<your PDF/text file>
```

Flow:

1. `document.routes.js` verifies the request is multipart.
2. `upload.middleware.js` stores the file locally.
3. `document.service.js` extracts text.
4. PDF files are parsed with `pdf-parse`.
5. Text files are read directly.
6. Extracted text is cleaned and counted.
7. A `Document` record is saved in MongoDB.

Example success response:

```json
{
  "success": true,
  "message": "Document uploaded and processed successfully.",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "originalName": "notes.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 152400,
    "pageCount": 8,
    "wordCount": 3120,
    "estimatedTokenCount": 4100,
    "createdAt": "2026-06-28T10:00:00.000Z"
  }
}
```

### Ask About One Document

Endpoint:

```http
POST /api/documents/:id/chat
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "question": "What are the key decisions in this document?"
}
```

Response type: Server-Sent Events.

Events:

```text
data: {"type":"chunk","content":"The document says..."}

data: {"type":"done","tokens":{"input":1200,"output":180},"latencyMs":2300,"document":{"id":"...","name":"notes.pdf"}}
```

### Ask Across Multiple Documents

Endpoint:

```http
POST /api/documents/multi-chat
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "documentIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012"
  ],
  "question": "Compare the main risks mentioned in these documents."
}
```

Rules:

- `documentIds` must be a non-empty array.
- Maximum 10 documents per request.
- The user must own every document.
- Each document must have completed text extraction.

### Summarize Document

Endpoint:

```http
POST /api/documents/:id/summarize
Authorization: Bearer <token>
```

Response type: Server-Sent Events.

The route asks the AI to return a structured summary with:

- Overview
- Key Points
- Important Details
- Conclusion

### Delete Document

Endpoint:

```http
DELETE /api/documents/:id
Authorization: Bearer <token>
```

This performs a soft delete by setting `isActive=false`. The local uploaded file is kept for now.

---

## Database Schema

### Document Model

```javascript
{
  userId: String,
  originalName: String,
  mimeType: String,
  fileSizeBytes: Number,
  storagePath: String,
  extractedText: String,
  extractionStatus: 'pending' | 'processing' | 'done' | 'failed',
  extractionError: String,
  pageCount: Number,
  wordCount: Number,
  characterCount: Number,
  estimatedTokenCount: Number,
  queryCount: Number,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```javascript
documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ userId: 1, isActive: 1 });
```

### Existing Models From Day-06

Day-07 still uses:

- `User` for auth, roles, token budget, and login state.
- `Conversation` for chat sessions.
- `Message` for user and assistant messages.
- `AiUsage` for token/cost analytics.

---

## Postman Testing Guide

Create these Postman environment variables:

```json
{
  "base_url": "http://localhost:3000",
  "auth_token": "",
  "document_id": "",
  "document_id_2": "",
  "conversation_id": "",
  "admin_token": ""
}
```

### 1. Health Check

```http
GET {{base_url}}/health
```

Expected:

```json
{
  "status": "ok",
  "provider": "gemini"
}
```

### 2. Register User

```http
POST {{base_url}}/api/auth/register
Content-Type: application/json
```

```json
{
  "name": "Document User",
  "email": "docuser@example.com",
  "password": "password123"
}
```

Save `data.token` into `auth_token`.

### 3. Upload Document

```http
POST {{base_url}}/api/documents/upload
Authorization: Bearer {{auth_token}}
Content-Type: multipart/form-data
```

In Postman body:

- Select `form-data`.
- Add key `file`.
- Change key type from Text to File.
- Select a PDF or supported text file.

Save `data.id` into `document_id`.

### 4. List Documents

```http
GET {{base_url}}/api/documents
Authorization: Bearer {{auth_token}}
```

### 5. Get Document Metadata

```http
GET {{base_url}}/api/documents/{{document_id}}
Authorization: Bearer {{auth_token}}
```

### 6. Ask One Document

```http
POST {{base_url}}/api/documents/{{document_id}}/chat
Authorization: Bearer {{auth_token}}
Content-Type: application/json
```

```json
{
  "question": "Summarize the most important points."
}
```

Expected: streaming `chunk` events followed by a `done` event.

### 7. Summarize Document

```http
POST {{base_url}}/api/documents/{{document_id}}/summarize
Authorization: Bearer {{auth_token}}
```

Expected: streaming summary chunks followed by a `done` event.

### 8. Multi-Document Chat

Upload a second document first, save its ID as `document_id_2`, then call:

```http
POST {{base_url}}/api/documents/multi-chat
Authorization: Bearer {{auth_token}}
Content-Type: application/json
```

```json
{
  "documentIds": ["{{document_id}}", "{{document_id_2}}"],
  "question": "What do these documents agree and disagree on?"
}
```

### 9. Delete Document

```http
DELETE {{base_url}}/api/documents/{{document_id}}
Authorization: Bearer {{auth_token}}
```

Expected:

```json
{
  "success": true,
  "message": "Document deleted."
}
```

---

## Security and Limits

- All document routes require JWT authentication.
- Users can only access documents where `document.userId === req.user.id`.
- Document deletes are soft deletes.
- Uploads must use `multipart/form-data`.
- Upload size is controlled by `MAX_FILE_SIZE_MB`.
- Document chat and summary routes use `streamRateLimiter`.
- Multi-document chat allows up to 10 documents per request.
- Questions must be present and under 1000 characters.
- Very large document content is truncated before being placed in the AI prompt.
- Scanned/image-only PDFs may fail because `pdf-parse` extracts text, not OCR.

---

## Running the Application

Prerequisites:

- Node.js 20+
- MongoDB running locally or a MongoDB connection string
- Gemini API key if using `AI_PROVIDER=gemini`
- Ollama running locally if using `AI_PROVIDER=ollama`

Setup:

```bash
cd day-07
npm install
npm run dev
```

Server URL:

```text
http://localhost:3000
```

The app loads env variables through:

```text
node --watch --import ./src/env.js src/app.js
```

This ensures config modules can safely read `process.env` at import time.

---

## Learning Outcomes

After Day-07, you should understand:

1. How to add authenticated file uploads to an Express API.
2. How to validate and limit uploaded files with multer.
3. How to extract text from PDFs and text files.
4. How to store extracted document text and metadata in MongoDB.
5. How to enforce document ownership for every read/write path.
6. How to build document-aware AI prompts.
7. How to stream document Q&A and summaries with Server-Sent Events.
8. How multi-document prompting works before introducing embeddings or vector search.

---

## Summary

Day-07 turns the Day-06 AI chat backend into a document-aware assistant.

It keeps authentication, chat, admin, usage tracking, rate limiting, and streaming, then adds document upload, text extraction, document metadata storage, single-document Q&A, multi-document Q&A, and summaries.

This is the first step toward a full document intelligence backend.

