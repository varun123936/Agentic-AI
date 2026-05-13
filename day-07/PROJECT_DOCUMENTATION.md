# Day-06: AI Chat Platform with Authentication & Admin Dashboard

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Request Flow](#architecture--request-flow)
3. [Project Structure](#project-structure)
4. [File-to-File Request Flow](#file-to-file-request-flow)
5. [Features Breakdown](#features-breakdown)
6. [API Endpoints](#api-endpoints)
7. [Complete Postman Testing Guide](#complete-postman-testing-guide)
8. [Database Schema](#database-schema)
9. [Error Handling](#error-handling)
10. [Security Features](#security-features)

---

## 📚 Project Overview

**Day-06** is an enterprise-grade AI Chat Platform with the following key features:

### Core Features:
- ✅ User authentication (Register/Login with JWT)
- ✅ Role-based access control (User/Admin roles)
- ✅ Daily token budget per user (configurable)
- ✅ AI-powered chat with Gemini or Ollama
- ✅ Conversation management (create, archive, list)
- ✅ Real-time streaming responses (Server-Sent Events)
- ✅ Usage tracking and analytics
- ✅ Admin dashboard for monitoring
- ✅ Rate limiting to prevent abuse
- ✅ Error handling with proper HTTP status codes

### Tech Stack:
- **Backend**: Express.js v5.2.1 (Node.js)
- **Database**: MongoDB with Mongoose v9.6.2
- **Authentication**: JWT (jsonwebtoken v9.0.3)
- **Password Security**: bcryptjs v3.0.3
- **Rate Limiting**: express-rate-limit v8.5.1
- **AI APIs**: Gemini 2.5 Flash or Ollama

---

## 🏗️ Architecture & Request Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Web/Mobile)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP Request
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS APP                              │
│                   [src/app.js]                              │
│  - JSON Parser Middleware                                   │
│  - Error Handler Middleware                                 │
│  - Rate Limiter Middleware                                  │
└────────────────────────┬────────────────────────────────────┘
                         │ Routes requests
                         ↓
        ┌────────────────┬────────────────┬──────────────────┐
        │                │                │                  │
        ↓                ↓                ↓                  ↓
    Auth Routes      Chat Routes      Admin Routes      Health Check
   [auth.routes]   [chat.routes]    [admin.routes]
        │                │                │
        ↓                ↓                ↓
   ┌────────────┐   ┌─────────────┐  ┌──────────────┐
   │  Auth      │   │  Middleware │  │  Middleware  │
   │  Service   │   │  - Auth     │  │  - Auth      │
   │            │   │  - Budget   │  │  - Admin     │
   │            │   │    Check    │  │    Check     │
   └────────────┘   └─────────────┘  └──────────────┘
        │                │                │
        ↓                ↓                ↓
   ┌─────────────────────────────────────────────────┐
   │        CONVERSATION SERVICE                      │
   │  [conversation.service.js]                      │
   │  - Create/Archive conversations                 │
   │  - Save/Load messages                           │
   │  - Calculate AI costs                           │
   │  - Generate usage stats                         │
   └─────────────────────────────────────────────────┘
        │                │
        ↓                ↓
   ┌─────────────┐  ┌──────────────────┐
   │  AI STREAM  │  │  MODELS & DB     │
   │ [ai.stream] │  │  (Mongoose)      │
   │             │  │                  │
   │ Gemini/     │  │  - User          │
   │ Ollama API  │  │  - Conversation  │
   │             │  │  - Message       │
   └─────────────┘  │  - AiUsage       │
                    │  [MongoDB]       │
                    └──────────────────┘
```

---

## 📁 Project Structure

```
day-06/
├── src/
│   ├── app.js                           # ← ENTRY POINT: Main application setup
│   ├── config/
│   │   ├── db.config.js                 # MongoDB connection
│   │   └── ai.config.js                 # AI provider configuration
│   ├── middleware/
│   │   ├── auth.middleware.js           # JWT verification & role checking
│   │   ├── errorHandler.js              # Global error handler
│   │   └── rateLimiter.js               # Rate limiting configuration
│   ├── models/
│   │   ├── user.model.js                # User schema with token budgets
│   │   ├── conversation.model.js        # Conversation metadata
│   │   ├── message.model.js             # Individual messages
│   │   └── aiUsage.model.js             # Usage tracking for billing
│   ├── routes/
│   │   ├── auth.routes.js               # Authentication endpoints
│   │   ├── chat.routes.js               # Chat/conversation endpoints
│   │   └── admin.routes.js              # Admin analytics endpoints
│   └── services/
│       ├── conversation.service.js      # Business logic for conversations
│       └── ai.stream.js                 # AI provider integration (streaming)
├── .env                                 # Environment variables
├── package.json                         # Dependencies
└── PROJECT_DOCUMENTATION.md             # This file!
```

---

## 🔄 File-to-File Request Flow

### 1. **Registration Flow: POST /api/auth/register**

```
REQUEST STARTS
    ↓
[app.js:14] → Route to /api/auth
    ↓
[auth.routes.js:28-73] → POST /register handler
    │
    ├─ Line 31-46: Validate input (name, email, password)
    ├─ Line 49-53: Check if email already exists in DB
    ├─ Line 56-57: Create new User document (password auto-hashed by model)
    ├─ Line 60: Generate JWT token
    └─ Line 62-75: Send response with token & user data
    
[user.model.js:62-68] → Pre-save hook (runs before save to DB)
    └─ Hash password with bcrypt
    
RESPONSE RETURNED
```

**Line References:**
- Entry: [app.js:16](src/app.js#L16) - Route definition
- Handler: [auth.routes.js:28-73](src/routes/auth.routes.js#L28-L73)
- Model: [user.model.js:62-68](src/models/user.model.js#L62-L68)

---

### 2. **Login Flow: POST /api/auth/login**

```
REQUEST STARTS
    ↓
[app.js:16] → Route to /api/auth
    ↓
[auth.routes.js:76-139] → POST /login handler
    │
    ├─ Line 80-86: Validate email & password required
    ├─ Line 89-92: Find user by email (select password field)
    ├─ Line 94-99: Check if user exists and is active
    ├─ Line 102-106: Compare provided password with hashed DB password
    ├─ Line 108-109: Update lastLoginAt timestamp
    ├─ Line 111: Generate JWT token
    └─ Line 113-128: Send response with token & user data
    
[user.model.js:70-72] → comparePassword instance method
    └─ Use bcrypt.compare() to verify password
    
RESPONSE RETURNED
```

**Line References:**
- Handler: [auth.routes.js:76-139](src/routes/auth.routes.js#L76-L139)
- Compare Method: [user.model.js:70-72](src/models/user.model.js#L70-L72)

---

### 3. **Get User Profile: GET /api/auth/me**

```
REQUEST STARTS
    ↓
[app.js:16] → Route to /api/auth
    ↓
[auth.middleware.js:3-63] → authenticate middleware
    │
    ├─ Line 8-15: Extract token from Authorization header
    ├─ Line 18-35: Verify JWT signature & check expiry
    ├─ Line 38-46: Find user in DB to verify still exists & active
    └─ Line 49-59: Attach user to req.user object
    
[auth.routes.js:142-158] → GET /me handler
    │
    ├─ Line 144: Get authenticated user
    └─ Line 145-158: Return user profile
    
RESPONSE RETURNED
```

**Line References:**
- Auth Middleware: [auth.middleware.js:3-63](src/middleware/auth.middleware.js#L3-L63)
- Route Handler: [auth.routes.js:142-158](src/routes/auth.routes.js#L142-L158)

---

### 4. **Create Conversation: POST /api/chat/conversations**

```
REQUEST STARTS
    ↓
[app.js:17] → Route to /api/chat (with rate limiter)
    ↓
[rateLimiter.js:5-27] → Check rate limit
    │
    ├─ Max 20 requests/minute per user
    └─ Skip check if admin user
    
[auth.middleware.js:3-63] → authenticate middleware
    └─ Verify JWT token & attach user to req.user
    
[chat.routes.js:18-26] → POST /conversations handler
    │
    ├─ Line 21: Get userId from req.user.id (from JWT)
    ├─ Line 22: Call conversation service
    └─ Line 23: Return new conversation object
    
[conversation.service.js:4-7] → createConversation function
    │
    └─ Line 5-6: Create new Conversation document in MongoDB
    
RESPONSE RETURNED
```

**Line References:**
- Rate Limiter: [rateLimiter.js:5-27](src/middleware/rateLimiter.js#L5-L27)
- Auth: [auth.middleware.js:3-63](src/middleware/auth.middleware.js#L3-L63)
- Route: [chat.routes.js:18-26](src/routes/chat.routes.js#L18-L26)
- Service: [conversation.service.js:4-7](src/services/conversation.service.js#L4-L7)

---

### 5. **Send Chat Message: POST /api/chat/conversations/:id/stream** ⭐ MOST COMPLEX

```
REQUEST STARTS
    ↓
[app.js:17] → Route to /api/chat (with rate limiter)
    ↓
[rateLimiter.js:5-27] → Check rate limit (20 req/min)
    
[auth.middleware.js:3-63] → authenticate middleware
    └─ Verify JWT & attach user
    
[auth.middleware.js:83-109] → checkTokenBudget middleware
    │
    ├─ Line 87-90: Get user from DB
    ├─ Line 91: Check daily token budget
    └─ Line 105-109: Attach budget info to req.tokenBudget
    
[chat.routes.js:51-149] → POST /stream handler
    │
    ├─ Line 53-54: Extract message & userId
    ├─ Line 58-64: Validate message length
    ├─ Line 67-70: Check conversation exists & belongs to user
    ├─ Line 72-77: Set SSE headers for streaming
    │
    ├─ Line 83: Save user message to DB
    │   [conversation.service.js:90-114]
    │   └─ Create Message document + update conversation count
    │
    ├─ Line 84: Load message history (last 20 messages)
    │   [conversation.service.js:61-73]
    │   └─ Format for AI API
    │
    ├─ Line 87-148: Call streamAI with callbacks
    │   [ai.stream.js:10-19]
    │   
    │   ├─ Line 87-148: Stream response chunk by chunk
    │   │   ├─ onChunk callback (Line 99-101)
    │   │   │   └─ Send each chunk to client via res.write
    │   │   │
    │   │   ├─ onDone callback (Line 103-133)
    │   │   │   ├─ Save assistant message to DB
    │   │   │   │   [conversation.service.js:117-171]
    │   │   │   │   ├─ Calculate AI cost
    │   │   │   │   ├─ Create Message with AI metadata
    │   │   │   │   ├─ Create AiUsage tracking record
    │   │   │   │   └─ Update conversation token count
    │   │   │   │
    │   │   │   ├─ Update user's daily token usage
    │   │   │   │   [chat.routes.js:118-120]
    │   │   │   │   └─ increment tokensUsedToday
    │   │   │   │
    │   │   │   └─ Send completion with token count
    │   │   │
    │   │   └─ onError callback (Line 135-141)
    │   │       └─ Send error to client
    │
    └─ Error handler (Line 143-149)
        └─ Send error response
    
STREAMING RESPONSE COMPLETED
```

**Line References:**
- Entry: [app.js:17](src/app.js#L17)
- Rate Limiter: [rateLimiter.js:5-27](src/middleware/rateLimiter.js#L5-L27)
- Auth: [auth.middleware.js:3-109](src/middleware/auth.middleware.js#L3-L109)
- Route Handler: [chat.routes.js:51-149](src/routes/chat.routes.js#L51-L149)
- Save User Message: [conversation.service.js:90-114](src/services/conversation.service.js#L90-L114)
- Get History: [conversation.service.js:61-73](src/services/conversation.service.js#L61-L73)
- Stream AI: [ai.stream.js:10-19](src/services/ai.stream.js#L10-L19)
- Save Assistant: [conversation.service.js:117-171](src/services/conversation.service.js#L117-L171)

---

### 6. **Get Usage Stats: GET /api/chat/usage**

```
REQUEST STARTS
    ↓
[app.js:17] → Route to /api/chat
    ↓
[auth.middleware.js:3-63] → authenticate middleware
    
[chat.routes.js:151-162] → GET /usage handler
    │
    └─ Line 155: Call getUserUsageStats
    
[conversation.service.js:173-213] → getUserUsageStats function
    │
    ├─ Line 174-182: Aggregate usage by provider
    ├─ Line 185-197: Get today's usage
    └─ Line 199-201: Return combined stats
    
RESPONSE RETURNED
```

---

### 7. **Admin: Get All Users: GET /api/admin/users**

```
REQUEST STARTS
    ↓
[app.js:18] → Route to /api/admin
    ↓
[auth.middleware.js:3-63] → authenticate middleware
    
[auth.middleware.js:67-73] → requireAdmin middleware
    │
    ├─ Line 68-70: Check if user.role === 'admin'
    └─ Return 403 if not admin
    
[admin.routes.js:12-22] → GET /users handler
    │
    └─ Line 15-20: Query all users, exclude passwords
    
RESPONSE RETURNED
```

---

### 8. **Admin: Get System Usage: GET /api/admin/usage**

```
REQUEST STARTS
    ↓
[app.js:18] → Route to /api/admin
    ↓
[auth.middleware.js] → authenticate + requireAdmin
    
[admin.routes.js:25-63] → GET /usage handler
    │
    ├─ Line 31-43: Group usage by provider/model (all-time)
    ├─ Line 46-57: Get daily trend (last 7 days)
    └─ Line 59-62: Return combined stats
    
RESPONSE RETURNED
```

---

## 🎯 Features Breakdown

### **1. Authentication System**

#### User Registration
- **Endpoint**: `POST /api/auth/register`
- **What Happens**:
  1. User provides name, email, password
  2. Password is hashed with bcrypt (10 salt rounds)
  3. New User document created in MongoDB
  4. JWT token generated immediately (auto-login)
  5. Returns token + user data

#### User Login
- **Endpoint**: `POST /api/auth/login`
- **What Happens**:
  1. User provides email & password
  2. Find user by email (password explicitly selected from DB)
  3. Compare provided password with bcrypt hash
  4. Update lastLoginAt timestamp
  5. Generate JWT token
  6. Return token + user data

#### JWT Token Usage
- **Format**: `Authorization: Bearer <token>`
- **Expiry**: 7 days (configurable in `.env`)
- **Secret**: Stored in `JWT_SECRET` environment variable
- **Payload**: Contains userId, used to identify requests

---

### **2. Role-Based Access Control (RBAC)**

**User Roles**:
- `user` (default): Can chat, view own conversations
- `admin`: Can view all users, system analytics, configure user limits

**Usage**:
- Auth middleware extracts role from JWT
- Admin middleware checks role before allowing access
- Chat routes use authenticate only (all users allowed)
- Admin routes use authenticate + requireAdmin

**File**: [auth.middleware.js:67-73](src/middleware/auth.middleware.js#L67-L73)

---

### **3. Daily Token Budget System**

**How It Works**:
1. Each user has `dailyTokenLimit` (default 100,000 tokens)
2. Each user tracks `tokensUsedToday` counter
3. Each day at midnight, counter resets
4. `checkTokenBudget` middleware prevents requests that would exceed limit

**Token Counting**:
- Input tokens (user message) → cost depends on provider
- Output tokens (AI response) → cost depends on provider
- Tracked in AiUsage collection for billing

**File**: [user.model.js:73-96](src/models/user.model.js#L73-L96)
**Middleware**: [auth.middleware.js:83-109](src/middleware/auth.middleware.js#L83-L109)

---

### **4. Conversation Management**

**Create Conversation**
- Creates empty conversation with userId
- Stores: title, messageCount, tokenCount, status, createdAt

**Archive Conversation** (soft delete)
- Sets status to 'archived'
- Still in DB, not deleted
- Not returned in "active conversations" queries

**List Conversations**
- Only returns active conversations
- Sorted by most recent message
- Includes: title, messageCount, tokenUsed, lastMessageAt

**File**: [conversation.service.js](src/services/conversation.service.js)

---

### **5. Real-Time AI Streaming**

**Server-Sent Events (SSE)**:
- Sends events as they arrive from AI API
- Each chunk is a JSON object: `{type, content}`
- Types: `chunk`, `done`, `error`

**Event Format**:
```
data: {"type":"chunk","content":"Hello"}
data: {"type":"chunk","content":" there"}
data: {"type":"done","tokens":{"input":10,"output":5,"total":15},"latencyMs":234}
```

**AI Providers**:
- **Gemini 2.5 Flash**: Fast, free tier available
- **Ollama**: Self-hosted, completely free

**File**: [ai.stream.js](src/services/ai.stream.js)

---

### **6. Usage Tracking & Analytics**

**What's Tracked**:
- Every message (both user & assistant)
- Input/output tokens used
- Estimated cost (Gemini only)
- Latency (how long AI took)
- Provider & model used

**Storage**:
- Separate `AiUsage` collection (not in Message collection)
- Allows fast aggregations without scanning all messages
- Indexes on userId, provider, createdAt for fast queries

**Admin Analytics**:
- Total users, conversations, tokens used, costs
- Daily usage trend (last 7 days)
- Per-provider breakdown
- Per-model breakdown

**Files**:
- Tracking: [conversation.service.js:153-171](src/services/conversation.service.js#L153-L171)
- Analytics: [admin.routes.js:25-63](src/routes/admin.routes.js#L25-L63)

---

### **7. Rate Limiting**

**Two Levels**:

1. **General Rate Limiter** (20 req/min per user)
   - Applied to all `/api/chat` routes
   - Prevents spam
   - Skipped for admin users

2. **Stream Rate Limiter** (10 req/min per user)
   - For expensive streaming operations
   - Could be applied separately if needed
   - Defined but not currently used in routes

**Implementation**:
- Uses express-rate-limit with in-memory store
- Production: Should use Redis for distributed rate limiting
- Key is either user ID (if authenticated) or IP address

**File**: [rateLimiter.js](src/middleware/rateLimiter.js)

---

### **8. Error Handling**

**Global Error Handler** (must be last middleware):
- Catches all errors thrown in routes/services
- Returns consistent error format
- Logs all errors with context
- Handles specific error types

**Error Format**:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "errors": ["field1 error", "field2 error"]
}
```

**Error Types Handled**:
- Auth errors (NO_TOKEN, TOKEN_EXPIRED, INVALID_TOKEN)
- Validation errors (VALIDATION_ERROR)
- Database errors (DUPLICATE_ERROR, INVALID_ID)
- AI errors (AI_PROVIDER_ERROR, AI_UNAVAILABLE)
- Rate limit errors (RATE_LIMIT_EXCEEDED)

**File**: [errorHandler.js](src/middleware/errorHandler.js)

---

## 📡 API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Register new user |
| POST | `/login` | ❌ | Login existing user |
| GET | `/me` | ✅ | Get current user profile |
| POST | `/logout` | ✅ | Logout (client-side cleanup) |

### Chat Routes (`/api/chat`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/conversations` | ✅ | Create new conversation |
| GET | `/conversations` | ✅ | List user's conversations |
| GET | `/conversations/:id/messages` | ✅ | Get conversation messages |
| POST | `/conversations/:id/stream` | ✅ | Send message + stream AI response |
| GET | `/usage` | ✅ | Get user's usage stats |

### Admin Routes (`/api/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | ✅ Admin | List all users |
| GET | `/usage` | ✅ Admin | System usage stats |
| GET | `/stats` | ✅ Admin | Dashboard stats |
| PATCH | `/users/:id/token-limit` | ✅ Admin | Update user's daily limit |

### Health Check

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | ❌ | Server health status |

---

## 📮 Complete Postman Testing Guide

### **Setup: Import Environment**

Create a Postman environment with these variables:

```json
{
  "base_url": "http://localhost:3000",
  "auth_token": "",
  "user_id": "",
  "conversation_id": "",
  "admin_token": ""
}
```

### **Test 1: Health Check**

```
GET {{base_url}}/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "provider": "gemini"
}
```

---

### **Test 2: User Registration**

```
POST {{base_url}}/api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123456"
}
```

**Expected Response** (201 Created):
```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user"
    }
  }
}
```

**Save to Environment**:
- Copy `data.token` → `auth_token`
- Copy `data.user.id` → `user_id`

---

### **Test 3: User Login**

```
POST {{base_url}}/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123456"
}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "dailyTokenLimit": 100000,
      "tokensUsedToday": 45234
    }
  }
}
```

---

### **Test 4: Get User Profile**

```
GET {{base_url}}/api/auth/me
Authorization: Bearer {{auth_token}}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "dailyTokenLimit": 100000,
    "tokensUsedToday": 45234,
    "lastLoginAt": "2026-05-09T15:52:44.000Z",
    "createdAt": "2026-05-09T10:00:00.000Z"
  }
}
```

---

### **Test 5: Create Conversation**

```
POST {{base_url}}/api/chat/conversations
Authorization: Bearer {{auth_token}}
Content-Type: application/json
```

**Body**: Empty or `{}`

**Expected Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439012",
    "userId": "507f1f77bcf86cd799439011",
    "title": "New Conversation",
    "status": "active",
    "messageCount": 0,
    "totalTokensUsed": 0,
    "lastMessageAt": "2026-05-09T15:52:44.000Z",
    "createdAt": "2026-05-09T15:52:44.000Z",
    "updatedAt": "2026-05-09T15:52:44.000Z"
  }
}
```

**Save to Environment**:
- Copy `data._id` → `conversation_id`

---

### **Test 6: List Conversations**

```
GET {{base_url}}/api/chat/conversations
Authorization: Bearer {{auth_token}}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "title": "How to use Node.js?",
      "messageCount": 5,
      "totalTokensUsed": 2341,
      "lastMessageAt": "2026-05-09T15:52:44.000Z",
      "createdAt": "2026-05-09T15:52:44.000Z"
    }
  ]
}
```

---

### **Test 7: Send Chat Message (Stream)**

```
POST {{base_url}}/api/chat/conversations/{{conversation_id}}/stream
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
  "message": "Hello! Can you help me learn Node.js?"
}
```

**Expected Response** (200 OK with streaming events):

The response will be Server-Sent Events, one per line:

```
data: {"type":"chunk","content":"Hello!"}

data: {"type":"chunk","content":" I'd"}

data: {"type":"chunk","content":" be"}

data: {"type":"chunk","content":" happy"}

data: {"type":"chunk","content":" to"}

data: {"type":"chunk","content":" help"}

data: {"type":"done","tokens":{"input":12,"output":145,"total":157},"latencyMs":2341,"budget":{"used":2498,"limit":100000}}
```

**How to Handle in Postman**:
1. Click "Send"
2. In response, see each event as it arrives
3. Track the `done` event for final token count

---

### **Test 8: Get Conversation Messages**

```
GET {{base_url}}/api/chat/conversations/{{conversation_id}}/messages
Authorization: Bearer {{auth_token}}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "role": "user",
      "content": "Hello! Can you help me learn Node.js?"
    },
    {
      "role": "assistant",
      "content": "Hello! I'd be happy to help you learn Node.js! Node.js is a JavaScript runtime built on Chrome's V8 engine..."
    }
  ]
}
```

---

### **Test 9: Get User Usage Stats**

```
GET {{base_url}}/api/chat/usage
Authorization: Bearer {{auth_token}}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "byProvider": [
      {
        "_id": "gemini",
        "totalTokens": 2498,
        "totalCostUsd": 0.000248,
        "requestCount": 2
      }
    ],
    "today": {
      "tokensToday": 1234,
      "requestsToday": 1
    }
  }
}
```

---

### **Test 10: Admin - Create Admin User (via DB)**

Since we don't have an admin creation endpoint, create directly in MongoDB:

```javascript
// In MongoDB shell or compass
db.users.updateOne(
  { email: "admin@example.com" },
  {
    $set: {
      name: "Admin User",
      email: "admin@example.com",
      password: "WILL_BE_HASHED",
      role: "admin",
      isActive: true,
      dailyTokenLimit: 1000000
    }
  },
  { upsert: true }
)
```

Then login as admin user to get admin token.

---

### **Test 11: Admin - Get All Users**

```
GET {{base_url}}/api/admin/users
Authorization: Bearer {{admin_token}}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "isActive": true,
      "dailyTokenLimit": 100000,
      "tokensUsedToday": 2498,
      "lastLoginAt": "2026-05-09T15:52:44.000Z",
      "createdAt": "2026-05-09T10:00:00.000Z"
    }
  ]
}
```

---

### **Test 12: Admin - Get System Usage Stats**

```
GET {{base_url}}/api/admin/usage
Authorization: Bearer {{admin_token}}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "byProvider": [
      {
        "_id": {
          "provider": "gemini",
          "model": "gemini-2.5-flash"
        },
        "totalTokens": 12340,
        "totalCostUsd": 0.001234,
        "requestCount": 8
      }
    ],
    "dailyTrend": [
      {
        "_id": "2026-05-09",
        "totalTokens": 5234,
        "totalCostUsd": 0.000523,
        "requests": 4
      },
      {
        "_id": "2026-05-08",
        "totalTokens": 7106,
        "totalCostUsd": 0.000711,
        "requests": 4
      }
    ]
  }
}
```

---

### **Test 13: Admin - Get Dashboard Stats**

```
GET {{base_url}}/api/admin/stats
Authorization: Bearer {{admin_token}}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalUsers": 5,
    "totalConversations": 23,
    "totalTokens": 123456,
    "totalCostUsd": 12.34,
    "totalRequests": 45
  }
}
```

---

### **Test 14: Admin - Update User Token Limit**

```
PATCH {{base_url}}/api/admin/users/507f1f77bcf86cd799439011/token-limit
Authorization: Bearer {{admin_token}}
Content-Type: application/json

{
  "dailyTokenLimit": 250000
}
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "isActive": true,
    "dailyTokenLimit": 250000,
    "tokensUsedToday": 2498,
    "lastLoginAt": "2026-05-09T15:52:44.000Z",
    "createdAt": "2026-05-09T10:00:00.000Z"
  }
}
```

---

### **Test 15: Error Cases**

#### 15a: Missing Authentication Token
```
GET {{base_url}}/api/auth/me
```

**Expected Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": "Access denied. No token provided.",
  "code": "NO_TOKEN"
}
```

#### 15b: Invalid Token
```
GET {{base_url}}/api/auth/me
Authorization: Bearer invalid_token_here
```

**Expected Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": "Invalid token.",
  "code": "INVALID_TOKEN"
}
```

#### 15c: Token Expired (after 7 days)
```
GET {{base_url}}/api/auth/me
Authorization: Bearer expired_token_here
```

**Expected Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": "Token expired. Please login again.",
  "code": "TOKEN_EXPIRED"
}
```

#### 15d: Non-Admin Accessing Admin Endpoint
```
GET {{base_url}}/api/admin/users
Authorization: Bearer {{auth_token}}  # Regular user token
```

**Expected Response** (403 Forbidden):
```json
{
  "success": false,
  "error": "Admin access required.",
  "code": "FORBIDDEN"
}
```

#### 15e: Email Already Registered
```
POST {{base_url}}/api/auth/register

{
  "name": "Another John",
  "email": "john@example.com",  # Already used
  "password": "password123"
}
```

**Expected Response** (409 Conflict):
```json
{
  "success": false,
  "error": "Email already registered."
}
```

#### 15f: Weak Password
```
POST {{base_url}}/api/auth/register

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "123"  # Too short
}
```

**Expected Response** (400 Bad Request):
```json
{
  "success": false,
  "errors": ["password must be at least 8 characters"]
}
```

#### 15g: Conversation Not Found
```
GET {{base_url}}/api/chat/conversations/invalid_id/messages
Authorization: Bearer {{auth_token}}
```

**Expected Response** (404 Not Found):
```json
{
  "success": false,
  "error": "Conversation not found"
}
```

#### 15h: Token Budget Exceeded
After using up daily limit, try:
```
POST {{base_url}}/api/chat/conversations/{{conversation_id}}/stream
Authorization: Bearer {{auth_token}}

{
  "message": "Hello"
}
```

**Expected Response** (429 Too Many Requests):
```json
{
  "success": false,
  "error": "Daily token limit reached. Resets at midnight.",
  "code": "TOKEN_BUDGET_EXCEEDED",
  "data": {
    "used": 100000,
    "limit": 100000,
    "remaining": 0
  }
}
```

---

## 🗄️ Database Schema

### **User Model**

```javascript
{
  _id: ObjectId,
  name: String (required, max 100),
  email: String (required, unique, lowercase),
  password: String (required, min 8, hashed with bcrypt),
  role: String (enum: ['user', 'admin'], default: 'user'),
  isActive: Boolean (default: true),
  
  // Token budget fields
  dailyTokenLimit: Number (default: 100000),
  tokensUsedToday: Number (default: 0),
  tokenResetDate: Date,
  
  lastLoginAt: Date,
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### **Conversation Model**

```javascript
{
  _id: ObjectId,
  userId: String (required, indexed),
  title: String (default: 'New Conversation', max 200),
  status: String (enum: ['active', 'archived'], default: 'active'),
  messageCount: Number (default: 0),
  totalTokensUsed: Number (default: 0),
  lastMessageAt: Date,
  summary: String (optional, AI-generated summary),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### **Message Model**

```javascript
{
  _id: ObjectId,
  conversationId: ObjectId (required, ref: Conversation, indexed),
  role: String (enum: ['user', 'assistant', 'system']),
  content: String (required, max 10000),
  
  // AI metadata (only for assistant messages)
  aiMeta: {
    model: String,
    provider: String,
    inputTokens: Number,
    outputTokens: Number,
    totalTokens: Number,
    latencyMs: Number,
    estimatedCostUsd: Number
  },
  
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

### **AiUsage Model** (for analytics)

```javascript
{
  _id: ObjectId,
  conversationId: ObjectId (required, ref: Conversation),
  messageId: ObjectId (required, ref: Message),
  userId: String (required, indexed),
  provider: String (enum: ['gemini', 'ollama']),
  model: String,
  inputTokens: Number,
  outputTokens: Number,
  totalTokens: Number,
  estimatedCostUsd: Number,
  isFree: Boolean (default: false),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

---

## 🔐 Security Features

### **1. Password Security**
- Hashed with bcryptjs (12 salt rounds)
- Never returned in API responses
- Explicitly selected only when needed for comparison

### **2. JWT Authentication**
- Stateless token-based auth
- Signature verified on every protected request
- Token expiry enforced (7 days)
- Secret stored in environment variable

### **3. Authorization**
- Role-based access control (RBAC)
- User can only access own conversations
- Admin users verified before accessing admin routes

### **4. Rate Limiting**
- 20 requests per minute per user (general)
- Prevents brute force attacks
- Skipped for admin users (configurable)

### **5. Input Validation**
- Message length limits (max 2000 chars)
- Email format validation
- Password minimum length (8 chars)
- Required field validation

### **6. Error Security**
- Generic error messages (don't leak if email exists)
- Errors logged server-side
- Stack traces hidden in production

### **7. Database Security**
- Compound indexes for efficient queries
- Soft deletes (archive conversations)
- User ownership verification
- MongoDB injection prevention (via Mongoose)

---

## 🚀 Running the Application

### **Prerequisites**
- Node.js v20+
- MongoDB running locally (or adjust MONGODB_URI)
- Gemini API key (if using Gemini provider)

### **Setup**

```bash
# 1. Navigate to day-06 directory
cd day-06

# 2. Install dependencies
npm install

# 3. Create .env file (see .env.example)
# Set: GEMINI_API_KEY, MONGODB_URI, JWT_SECRET

# 4. Start the server
npm run dev

# 5. Server runs on http://localhost:3000
```

### **Environment Variables**

```
GEMINI_API_KEY=your_actual_key_here
AI_PROVIDER=gemini
MONGODB_URI=mongodb://localhost:27017/ai-course
JWT_SECRET=your_super_secret_key_change_this_min_32_chars
JWT_EXPIRES_IN=7d
PORT=3000
```

---

## 📊 Testing Checklist

Use this checklist to verify all features:

- [ ] Server starts without errors
- [ ] Health check returns `{status: ok}`
- [ ] User registration works
- [ ] User login works
- [ ] JWT token is returned
- [ ] Get profile with token works
- [ ] Create conversation works
- [ ] List conversations works
- [ ] Send message + stream works
- [ ] Messages saved to DB
- [ ] Usage stats tracked
- [ ] Admin can view all users
- [ ] Admin can view system stats
- [ ] Admin can update user token limit
- [ ] Rate limiting blocks excessive requests
- [ ] Invalid token returns 401
- [ ] Missing token returns 401
- [ ] Non-admin cannot access admin routes
- [ ] Conversation not found returns 404
- [ ] Weak password rejected
- [ ] Duplicate email rejected
- [ ] Token budget enforced
- [ ] Error handler catches and logs errors

---

## 🎓 Learning Outcomes

After completing Day-06, you should understand:

1. ✅ JWT-based authentication with Express
2. ✅ Role-based access control patterns
3. ✅ Rate limiting implementation
4. ✅ Token budgeting for API usage
5. ✅ Error handling middleware
6. ✅ Server-Sent Events (SSE) for streaming
7. ✅ Database indexing for performance
8. ✅ Admin dashboard design
9. ✅ Usage tracking and analytics
10. ✅ Enterprise API security practices

---

## 📝 Summary

**Day-06** brings all previous concepts together into a production-ready AI chat platform:

- **Authentication** → Users can register, login, get profiles
- **Authorization** → Different roles (user/admin) with different permissions
- **Budget Control** → Each user has daily token limits
- **Analytics** → Track AI usage, costs, trends
- **Admin Dashboard** → Monitor all users and system health
- **Security** → JWT, bcrypt, rate limiting, input validation
- **Streaming** → Real-time AI responses via SSE
- **Error Handling** → Comprehensive error handler with proper codes

This is a **complete, deployable backend** for an AI chat application!

---

**End of Documentation**

*Last Updated: May 9, 2026*
