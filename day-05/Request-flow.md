CLIENT REQUEST
    ↓
[src/app.js] line 14
    ↓ (routes to /api/chat)
[src/routes/chat.routes.js] lines 47-147
    ├─ Line 48-50: Extract message & userId
    ├─ Line 53-58: Validate message
    ├─ Line 61-66: Check if conversation belongs to user
    ├─ Line 68-72: Set SSE headers (for streaming)
    ├─ Line 78: Save user message → [src/services/conversation.service.js] line 51-71
    ├─ Line 80: Load conversation history → [src/services/conversation.service.js] line 39-46
    ├─ Line 87: Call streamAI → [src/services/ai.stream.js] line 8-15
    │    ├─ Calls Gemini API (if enabled)
    │    └─ Streams response chunks
    ├─ Line 96-100: Each chunk sent to client (res.write)
    ├─ Line 105-119: Save assistant message → [src/services/conversation.service.js] line 74-133
    ├─ Line 120-124: Send completion signal to client
    └─ Line 125: End response

----------------------------------------------------------------------------------------------------------

SIMPLE EXAMPLE: Summarize Conversation
When you call POST /api/chat/conversations/:id/summarize:

Line-by-Line:

[app.js:14] - Route to /api/chat
[chat.routes.js:170-176] - Handle summarize endpoint
[chat.routes.js:172] - Call ConversationService.summarizeConversation()
[conversation.service.js:158-228] - Main summarization logic:
Line 160: Get conversation from MongoDB
Line 163: Load all messages from conversation
Line 168: Format messages as text
Line 174: Create AI prompt
Line 181: Call streamAI() to generate summary
Line 220: Save summary to database
Line 223: Return summary result
[chat.routes.js:173] - Send response back to client with summary

--------------------------------------------------------------------------------------------------------

REQUEST JOURNEY:
Entry Point (app.js)
  → Routes (chat.routes.js)
  → Services (conversation.service.js)
  → Database (MongoDB)
  → AI API (Gemini/Ollama)
  → Response Back Up the Chain
  → Client Receives Data