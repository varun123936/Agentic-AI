# Day-07 Postman E2E Testing Guide

Tested on `2026-05-16` against local server `http://localhost:3000`.

## What I tested

These flows were verified live:

| Area | Status | Notes |
|---|---|---|
| Health check | Working | Returns provider info |
| Register user | Working | `201 Created` |
| Duplicate register | Working | `409 Conflict` |
| Weak password validation | Working | `400 Bad Request` |
| Login | Working | `200 OK` |
| Get current user | Working | `200 OK` |
| Logout | Working | `200 OK` |
| Create conversation | Working | `201 Created` |
| List conversations | Working | `200 OK` |
| Get conversation messages | Working | `200 OK` |
| Invalid conversation id | Working | `400 Bad Request` |
| Chat usage stats | Working | `200 OK` |
| Non-admin hitting admin route | Working | `403 Forbidden` |
| Upload text document | Working | `201 Created` |
| Upload without file | Working | `400 Bad Request` |
| List documents | Working | `200 OK` |
| Get document details | Working | `200 OK` |
| Chat with conversation (SSE) | Working | Streams chunks + done event |
| Chat with document (SSE) | Working | Streams chunks + done event |
| Summarize document (SSE) | Working | Streams chunks + done event |
| Delete document | Working | `200 OK` |
| Get deleted document | Working | `404 Not Found` |
| Admin users | Working | `200 OK` after role promotion |
| Admin usage | Working | `200 OK` after role promotion |
| Admin stats | Working | `200 OK` after role promotion |
| Admin update token limit | Working | `200 OK` after role promotion |

## Important notes

1. Auth endpoints use a strict limiter: `10 attempts per 15 minutes` per IP.
2. If you run too many register/login tests quickly, you will get:

```json
{
  "success": false,
  "error": "Too many attempts. Try again in 15 minutes.",
  "code": "AUTH_RATE_LIMIT_EXCEEDED"
}
```

3. There is no API to create an admin directly. To test admin APIs, first register a normal user, then update its `role` to `admin` in MongoDB.
4. Streaming endpoints do not return normal JSON. They return SSE events like:

```text
data: {"type":"chunk","content":"..."}

data: {"type":"done","tokens":{"input":47,"output":8,"total":55},"latencyMs":1392,"budget":{"used":55,"limit":100000}}
```

## Postman environment

Create these variables:

```json
{
  "base_url": "http://localhost:3000",
  "token": "",
  "user_id": "",
  "conversation_id": "",
  "document_id": "",
  "document_id_2": "",
  "admin_token": ""
}
```

## Start server

Run:

```bash
cd day-07
npm run start
```

Server expected:

```text
Server running at: http://localhost:3000
AI Provider: gemini
```

## Test scenarios

### 1. Health check

`GET {{base_url}}/health`

Expected status: `200`

Expected body:

```json
{
  "status": "ok",
  "provider": "gemini"
}
```

### 2. Register user

`POST {{base_url}}/api/auth/register`

Headers:

```text
Content-Type: application/json
```

Body:

```json
{
  "name": "Test User",
  "email": "testuser@gmail.com",
  "password": "password123"
}
```

Expected status: `201`

Expected body shape:

```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "token": "JWT_TOKEN",
    "user": {
      "id": "USER_ID",
      "name": "Day07 Test User",
      "email": "day07_test@example.com",
      "role": "user"
    }
  }
}
```

Save:

- `data.token` -> `token`
- `data.user.id` -> `user_id`

### 3. Duplicate register

Send the same request again.

Expected status: `409`

Expected body:

```json
{
  "success": false,
  "error": "Email already registered."
}
```

### 4. Weak password validation

`POST {{base_url}}/api/auth/register`

Body:

```json
{
  "name": "Weak User",
  "email": "weak_user@example.com",
  "password": "123"
}
```

Expected status: `400`

Expected body:

```json
{
  "success": false,
  "errors": [
    "password must be at least 8 characters"
  ]
}
```

### 5. Login

`POST {{base_url}}/api/auth/login`

Body:

```json
{
  "email": "day07_test@example.com",
  "password": "password123"
}
```

Expected status: `200`

Expected body shape:

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "token": "JWT_TOKEN",
    "user": {
      "id": "USER_ID",
      "name": "Day07 Test User",
      "email": "day07_test@example.com",
      "role": "user",
      "dailyTokenLimit": 100000,
      "tokensUsedToday": 0
    }
  }
}
```

### 6. Login with wrong password

Body:

```json
{
  "email": "day07_test@example.com",
  "password": "wrongpass123"
}
```

Expected status: `401`

Expected body:

```json
{
  "success": false,
  "error": "Invalid email or password."
}
```

### 7. Current user

`GET {{base_url}}/api/auth/me`

Headers:

```text
Authorization: Bearer {{token}}
```

Expected status: `200`

Expected body shape:

```json
{
  "success": true,
  "data": {
    "id": "USER_ID",
    "name": "Day07 Test User",
    "email": "day07_test@example.com",
    "role": "user",
    "dailyTokenLimit": 100000,
    "tokensUsedToday": 0,
    "lastLoginAt": "2026-05-16T08:34:04.005Z",
    "createdAt": "2026-05-16T08:34:02.564Z"
  }
}
```

### 8. Current user without token

`GET {{base_url}}/api/auth/me`

Expected status: `401`

Expected body:

```json
{
  "success": false,
  "error": "Access denied. No token provided.",
  "code": "NO_TOKEN"
}
```

### 9. Logout

`POST {{base_url}}/api/auth/logout`

Headers:

```text
Authorization: Bearer {{token}}
```

Expected status: `200`

Expected body:

```json
{
  "success": true,
  "message": "Logged out. Please delete your token on the client side."
}
```

### 10. Create conversation

`POST {{base_url}}/api/chat/conversations`

Headers:

```text
Authorization: Bearer {{token}}
Content-Type: application/json
```

Body:

```json
{}
```

Expected status: `201`

Expected body shape:

```json
{
  "success": true,
  "data": {
    "_id": "CONVERSATION_ID",
    "userId": "USER_ID",
    "title": "New Conversation",
    "status": "active",
    "messageCount": 0,
    "totalTokensUsed": 0
  }
}
```

Save `data._id` -> `conversation_id`

### 11. List conversations

`GET {{base_url}}/api/chat/conversations`

Headers:

```text
Authorization: Bearer {{token}}
```

Expected status: `200`

Expected body shape:

```json
{
  "success": true,
  "data": [
    {
      "_id": "CONVERSATION_ID",
      "title": "New Conversation",
      "messageCount": 0,
      "totalTokensUsed": 0
    }
  ]
}
```

### 12. Get conversation messages before chat

`GET {{base_url}}/api/chat/conversations/{{conversation_id}}/messages`

Expected status: `200`

Expected body:

```json
{
  "success": true,
  "data": []
}
```

### 13. Invalid conversation id

`GET {{base_url}}/api/chat/conversations/not-a-valid-id/messages`

Expected status: `400`

Expected body:

```json
{
  "success": false,
  "error": "Invalid conversation ID"
}
```

### 14. Chat stream

`POST {{base_url}}/api/chat/conversations/{{conversation_id}}/stream`

Headers:

```text
Authorization: Bearer {{token}}
Content-Type: application/json
```

Body:

```json
{
  "message": "Reply with exactly: Day-07 stream test successful."
}
```

Expected status: `200`

Expected live SSE output similar to:

```text
data: {"type":"chunk","content":"Day-07 stream test successful."}

data: {"type":"done","tokens":{"input":47,"output":8,"total":55},"latencyMs":1392,"budget":{"used":55,"limit":100000}}
```

### 15. Get messages after chat

`GET {{base_url}}/api/chat/conversations/{{conversation_id}}/messages`

Expected status: `200`

Expected body shape:

```json
{
  "success": true,
  "data": [
    {
      "role": "user",
      "content": "Reply with exactly: Day-07 stream test successful."
    },
    {
      "role": "assistant",
      "content": "Day-07 stream test successful."
    }
  ]
}
```

### 16. Usage stats

`GET {{base_url}}/api/chat/usage`

Expected status: `200`

Observed live shape:

```json
{
  "success": true,
  "data": {
    "byProvider": [
      {
        "_id": "gemini",
        "totalTokens": 55,
        "totalCostUsd": 0.000005925,
        "requestCount": 1
      }
    ],
    "today": {
      "tokensToday": 55,
      "requestsToday": 1
    }
  }
}
```

### 17. Non-admin admin access

`GET {{base_url}}/api/admin/users`

Using normal user token.

Expected status: `403`

Expected body:

```json
{
  "success": false,
  "error": "Admin access required.",
  "code": "FORBIDDEN"
}
```

### 18. Upload document

`POST {{base_url}}/api/documents/upload`

Headers:

```text
Authorization: Bearer {{token}}
```

Body type: `form-data`

- key: `file`
- type: `File`
- value: choose a `.txt`, `.md`, or `.pdf`

Sample text file content:

```text
Day-07 document testing sample.
Project: Agentic AI.
This text file is used to verify upload, retrieval, summary, and document question answering.
Important date: 2026-05-16.
Owner: QA Tester.
```

Expected status: `201`

Observed response shape:

```json
{
  "success": true,
  "message": "Document uploaded and processed successfully.",
  "data": {
    "id": "DOCUMENT_ID",
    "originalName": "day07-sample.txt",
    "mimeType": "text/plain",
    "fileSizeBytes": 194,
    "pageCount": null,
    "wordCount": 27,
    "estimatedTokenCount": 48
  }
}
```

Save `data.id` -> `document_id`

Upload one more file and save its returned `data.id` into `document_id_2` if you want to test multi-document Q&A.

### 19. Upload without file

`POST {{base_url}}/api/documents/upload`

Headers:

```text
Authorization: Bearer {{token}}
```

Do not send any file.

Expected status: `400`

Expected body:

```json
{
  "success": false,
  "error": "No file uploaded. Send file in \"file\" field."
}
```

### 20. List documents

`GET {{base_url}}/api/documents`

Expected status: `200`

Expected body shape:

```json
{
  "success": true,
  "data": [
    {
      "_id": "DOCUMENT_ID",
      "originalName": "day07-sample.txt",
      "mimeType": "text/plain",
      "fileSizeBytes": 194,
      "wordCount": 27,
      "estimatedTokenCount": 48,
      "queryCount": 0
    }
  ]
}
```

### 21. Get document details

`GET {{base_url}}/api/documents/{{document_id}}`

Expected status: `200`

Expected body shape:

```json
{
  "success": true,
  "data": {
    "id": "DOCUMENT_ID",
    "originalName": "day07-sample.txt",
    "mimeType": "text/plain",
    "pageCount": null,
    "wordCount": 27,
    "estimatedTokenCount": 48,
    "queryCount": 0
  }
}
```

### 22. Chat with document

`POST {{base_url}}/api/documents/{{document_id}}/chat`

Headers:

```text
Authorization: Bearer {{token}}
Content-Type: application/json
```

Body:

```json
{
  "question": "What project name is mentioned in this document? Answer in one short sentence."
}
```

Expected status: `200`

Observed SSE output:

```text
data: {"type":"chunk","content":"The project name mentioned in this document is Agentic AI."}

data: {"type":"done","tokens":{"input":147,"output":12},"latencyMs":1325,"document":{"id":"DOCUMENT_ID","name":"day07-existing-token-sample.txt"}}
```

### 23. Summarize document

`POST {{base_url}}/api/documents/{{document_id}}/summarize`

Headers:

```text
Authorization: Bearer {{token}}
```

Expected status: `200`

Observed SSE output:

```text
data: {"type":"chunk","content":"## Overview ..."}

data: {"type":"chunk","content":"## Key Points ..."}

data: {"type":"done","tokens":{"input":185,"output":137}}
```

### 24. Multi-document chat

Before this test, upload at least two documents and save:

- first document id -> `document_id`
- second document id -> `document_id_2`

`POST {{base_url}}/api/documents/multi-chat`

Headers:

```text
Authorization: Bearer {{token}}
Content-Type: application/json
```

Body:

```json
{
  "documentIds": ["{{document_id}}", "{{document_id_2}}"],
  "question": "What common project name appears across these documents?"
}
```

Expected status: `200`

Expected SSE response shape:

```text
data: {"type":"chunk","content":"...answer based on multiple documents..."}

data: {"type":"done","tokens":{"input":210,"output":45},"latencyMs":1300,"documents":[{"id":"DOCUMENT_ID_1","name":"file1.txt"},{"id":"DOCUMENT_ID_2","name":"file2.txt"}]}
```

Behavior:

- validates that all `documentIds` belong to the logged-in user
- rejects empty `documentIds`
- rejects more than 10 documents
- rejects documents that are not ready for questioning
- labels documents clearly in the AI prompt as `Document 1`, `Document 2`, and so on

Example use case:

- upload `project-overview.txt`
- upload `meeting-notes.txt`
- ask: `What common project name appears across these documents?`

If both documents mention `Agentic AI`, the answer should mention that shared name.

### 25. Delete document

`DELETE {{base_url}}/api/documents/{{document_id}}`

Expected status: `200`

Expected body:

```json
{
  "success": true,
  "message": "Document deleted."
}
```

### 26. Get deleted document

`GET {{base_url}}/api/documents/{{document_id}}`

Expected status: `404`

Expected body:

```json
{
  "success": false,
  "error": "Document not found"
}
```

## Admin testing

### How to make a user admin

There is no API endpoint for this. Update MongoDB directly.

Example in Mongo shell:

```javascript
db.users.updateOne(
  { email: "day07_test@example.com" },
  { $set: { role: "admin" } }
)
```

After that, the same JWT token works for admin routes because the middleware reads the latest role from MongoDB.

### 27. Admin users

`GET {{base_url}}/api/admin/users`

Headers:

```text
Authorization: Bearer {{token}}
```

Expected status after promotion: `200`

Observed response contains all users with fields like:

```json
{
  "success": true,
  "data": [
    {
      "_id": "USER_ID",
      "name": "Day07 Test User",
      "email": "day07_test@example.com",
      "role": "admin",
      "dailyTokenLimit": 100000,
      "tokensUsedToday": 55
    }
  ]
}
```

### 28. Admin usage

`GET {{base_url}}/api/admin/usage`

Expected status: `200`

Observed shape:

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
        "totalTokens": 1197,
        "totalCostUsd": 0.00025289999999999997,
        "requestCount": 3
      }
    ],
    "dailyTrend": [
      {
        "_id": "2026-05-16",
        "totalTokens": 55,
        "totalCostUsd": 0.000005925,
        "requests": 1
      }
    ]
  }
}
```

### 29. Admin stats

`GET {{base_url}}/api/admin/stats`

Expected status: `200`

Observed shape:

```json
{
  "success": true,
  "data": {
    "totalUsers": 7,
    "totalConversations": 6,
    "totalTokens": 1197,
    "totalCostUsd": 0.00025289999999999997,
    "totalRequests": 3
  }
}
```

### 30. Admin update token limit

`PATCH {{base_url}}/api/admin/users/{{user_id}}/token-limit`

Headers:

```text
Authorization: Bearer {{token}}
Content-Type: application/json
```

Body:

```json
{
  "dailyTokenLimit": 250000
}
```

Expected status: `200`

Expected body shape:

```json
{
  "success": true,
  "data": {
    "_id": "USER_ID",
    "dailyTokenLimit": 250000
  }
}
```

## Recommended testing order

1. Health
2. Register
3. Login
4. `/me`
5. Create conversation
6. Chat stream
7. Usage
8. Upload document
9. Upload second document
10. Document list
11. Document chat
12. Document summarize
13. Multi-document chat
14. Delete document
15. Promote user to admin in MongoDB
16. Admin users
17. Admin usage
18. Admin stats
19. Admin token limit update

## File types accepted for upload

- `application/pdf`
- `text/plain`
- `text/markdown`

## Common failures

### Missing token

```json
{
  "success": false,
  "error": "Access denied. No token provided.",
  "code": "NO_TOKEN"
}
```

### Invalid token

```json
{
  "success": false,
  "error": "Invalid token.",
  "code": "INVALID_TOKEN"
}
```

### Token expired

```json
{
  "success": false,
  "error": "Token expired. Please login again.",
  "code": "TOKEN_EXPIRED"
}
```

### Auth limiter hit

```json
{
  "success": false,
  "error": "Too many attempts. Try again in 15 minutes.",
  "code": "AUTH_RATE_LIMIT_EXCEEDED"
}
```

### Token budget exceeded

```json
{
  "success": false,
  "error": "Daily token limit reached. Resets at midnight.",
  "code": "TOKEN_BUDGET_EXCEEDED"
}
```

### Multi-document validation errors

If `documentIds` is empty:

```json
{
  "success": false,
  "error": "documentIds must be a non-empty array"
}
```

If one document does not belong to the authenticated user or does not exist:

```json
{
  "success": false,
  "error": "Document not found"
}
```

If one document is not ready:

```json
{
  "success": false,
  "error": "Document \"some-file.txt\" is not ready for questions.",
  "code": "DOCUMENT_NOT_READY"
}
```

## Final note

This file reflects the actual behavior I verified locally on `2026-05-16`, not just the intended code flow. The main thing to watch while testing is the auth rate limiter, because it can block repeated register/login attempts during one test session.
