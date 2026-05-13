# Day-06 Zero to Advanced Guide

This file explains the `day-06` project from zero in the order the app actually works.

Goal of this project:

- user can register and login
- user can create conversations
- user can send a message to AI
- AI response is streamed back live
- token usage is tracked
- admin can see system usage

This guide uses simple English and points to exact code locations so you can understand the project deeply and build something similar later.

---

## 1. Big Picture First

This is an Express + MongoDB backend for an AI chat application.

Main responsibilities:

1. start server
2. connect database
3. authenticate users with JWT
4. store conversations and messages
5. call AI provider
6. track token usage and cost
7. give admin analytics

Main folders:

- `src/app.js` -> application entry point
- `src/config/` -> database and AI configuration
- `src/models/` -> MongoDB schemas
- `src/middleware/` -> auth, rate limit, error handling
- `src/routes/` -> API endpoints
- `src/services/` -> business logic and AI integration

---

## 2. Runtime Order of the App

When the app starts, this is the real order:

1. environment variables are loaded before `app.js`
2. `app.js` creates the Express app
3. database config is loaded
4. AI config is loaded
5. middleware is registered
6. routes are registered
7. error handler is registered last
8. MongoDB connection is opened
9. server starts listening

Code:

- [app.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/app.js:13)
- [db.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/db.config.js:5)
- [ai.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/ai.config.js:23)

---

## 3. App Startup Explained

### 3.1 Express app creation

In [app.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/app.js:13), Express app is created:

```js
const app = express();
const PORT = AI_CONFIG.port;
```

Meaning:

- `app` is the main server object
- `PORT` comes from config, not hardcoded directly here

### 3.2 CORS middleware

In [app.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/app.js:17), the app allows frontend requests:

```js
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', AI_CONFIG.corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});
```

Simple meaning:

- browser checks if request is allowed
- backend says which origin, methods, and headers are allowed
- `OPTIONS` request is ended early

### 3.3 JSON body parsing

In [app.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/app.js:26):

```js
app.use(express.json({ limit: '10kb' }));
```

Meaning:

- converts request JSON into `req.body`
- limits body size to avoid abuse

### 3.4 Route registration

In [app.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/app.js:29):

```js
app.use('/api/auth', authRoutes);
app.use('/api/chat', aiRateLimiter, chatRoutes);
app.use('/api/admin', adminRoutes);
```

Meaning:

- all auth routes start with `/api/auth`
- all chat routes start with `/api/chat`
- chat routes also get rate limiting
- admin routes start with `/api/admin`

### 3.5 404 and error handler

Important order:

- 404 handler: [app.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/app.js:38)
- global error handler: [app.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/app.js:47)

Why error handler is last:

- Express reaches it only if earlier code throws an error

### 3.6 Database connection and listen

In [app.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/app.js:50):

```js
connectDB().then(() => {
  app.listen(PORT, () => {
    ...
  });
});
```

Meaning:

- first connect MongoDB
- only then start server
- this avoids requests hitting an app with no DB connection

---

## 4. Database Connection Flow

Main code: [db.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/db.config.js:5)

### What happens

1. read `MONGODB_URI`
2. if missing, throw error
3. connect with Mongoose
4. log success
5. register connection event handlers
6. exit process if connection fails

Important lines:

- check env var: [db.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/db.config.js:7)
- connect MongoDB: [db.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/db.config.js:12)
- fail fast timeout: [db.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/db.config.js:13)

Why this matters:

- your app depends on MongoDB
- if DB is down, app should fail clearly instead of behaving randomly

---

## 5. AI Configuration Flow

Main code: [ai.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/ai.config.js:5)

### What this file does

- reads environment variables
- cleans them
- decides which AI provider to use
- validates required config
- exports one `AI_CONFIG` object for whole app

### Important logic

Provider selection:

- [ai.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/ai.config.js:10)

Allowed providers:

- [ai.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/ai.config.js:15)

Gemini key required:

- [ai.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/ai.config.js:19)

Final exported config:

- [ai.config.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/config/ai.config.js:23)

Simple idea:

- if provider is `gemini`, use Google Gemini
- if provider is `ollama`, use local Ollama

---

## 6. Data Models in the Correct Learning Order

You should understand the models in this order:

1. `User`
2. `Conversation`
3. `Message`
4. `AiUsage`

Reason:

- a user owns conversations
- a conversation contains many messages
- AI usage records are created when assistant messages are saved

---

## 7. User Model Deep Explanation

Main code: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:4)

### 7.1 Fields

Important fields:

- `name`: user display name
- `email`: unique login identity
- `password`: hashed password
- `role`: `user` or `admin`
- `isActive`: whether account is usable
- `dailyTokenLimit`: max tokens per day
- `tokensUsedToday`: how many tokens already consumed today
- `tokenResetDate`: last reset marker
- `lastLoginAt`: last login time

Code references:

- basic identity fields: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:5)
- email validation: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:12)
- password hidden by default: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:21)
- role and activity: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:28)
- token budget fields: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:39)

### 7.2 Why `select: false` on password matters

Code: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:25)

```js
select: false
```

Meaning:

- password will not be returned from normal queries
- safer by default

So if code really needs password, it must explicitly ask for it.

That is why login does this:

- [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:93)

```js
.select('+password')
```

### 7.3 Password hashing

Code: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:63)

```js
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});
```

Simple meaning:

- before saving user
- if password changed
- hash it with bcrypt
- store hash, not plain password

Why this is good:

- if database leaks, plain passwords are not exposed

### 7.4 Password comparison

Code: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:71)

```js
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
```

Meaning:

- compare entered password with stored hash
- bcrypt handles hash comparison securely

### 7.5 Token budget helper

Code: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:76)

This method:

1. checks if day changed
2. resets token count in memory if needed
3. returns allowed, used, limit, remaining

Important line:

- budget decision: [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:87)

This method explains the business rule of the project:

- every user gets a daily token budget

---

## 8. Conversation Model Deep Explanation

Main code: [conversation.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/conversation.model.js:3)

### Fields

- `userId`: owner of the chat
- `title`: short conversation title
- `status`: `active` or `archived`
- `messageCount`: how many messages are in this chat
- `totalTokensUsed`: total tokens spent in this conversation
- `lastMessageAt`: when latest message arrived
- `summary`: optional short summary

Key references:

- owner field: [conversation.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/conversation.model.js:4)
- title field: [conversation.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/conversation.model.js:10)
- token total field: [conversation.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/conversation.model.js:29)
- summary field: [conversation.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/conversation.model.js:40)

### Compound index

Code: [conversation.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/conversation.model.js:52)

```js
conversationSchema.index({ userId: 1, status: 1, lastMessageAt: -1 });
```

Meaning:

- quickly find one user's active conversations
- sort newest first

Why conversation keeps `messageCount` and `totalTokensUsed`:

- frontend can show summary quickly
- we do not need to scan all messages every time

---

## 9. Message Model Deep Explanation

Main code: [message.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/message.model.js:3)

### Fields

- `conversationId`: which conversation this message belongs to
- `role`: `user`, `assistant`, or `system`
- `content`: message text
- `aiMeta`: extra metadata for assistant replies

Key references:

- relation to conversation: [message.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/message.model.js:4)
- role field: [message.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/message.model.js:11)
- content field: [message.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/message.model.js:17)
- ai metadata block: [message.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/message.model.js:25)

### What `aiMeta` stores

For assistant replies it stores:

- model name
- provider name
- input tokens
- output tokens
- total tokens
- latency
- estimated cost

Why this is useful:

- each assistant message carries its own AI details

### Index

Code: [message.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/message.model.js:61)

This helps load conversation messages in time order.

---

## 10. AiUsage Model Deep Explanation

Main code: [aiUsage.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/aiUsage.model.js:7)

This model is for analytics, not for chat display.

### Fields

- `conversationId`: which conversation generated usage
- `messageId`: which assistant message generated usage
- `userId`: which user used tokens
- `provider`: gemini or ollama
- `model`: exact AI model
- `inputTokens`
- `outputTokens`
- `totalTokens`
- `estimatedCostUsd`
- `isFree`

Key references:

- design comment: [aiUsage.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/aiUsage.model.js:3)
- user reference: [aiUsage.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/aiUsage.model.js:20)
- provider and model: [aiUsage.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/aiUsage.model.js:26)
- token fields: [aiUsage.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/aiUsage.model.js:37)
- indexes: [aiUsage.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/aiUsage.model.js:68)

Why a separate collection exists:

- analytics queries become faster
- we do not need to scan full chat messages
- admin reports become easier

---

## 11. Authentication Flow from Zero

Auth files:

- [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:7)
- [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:5)

### 11.1 Registration flow

Route:

- [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:34)

Real flow:

1. receive `name`, `email`, `password`
2. validate required fields
3. check if email already exists
4. create user
5. password is hashed by model pre-save hook
6. generate JWT
7. return token and user info

Important code:

- validation: [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:38)
- duplicate email check: [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:48)
- user creation: [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:57)
- token generation: [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:58)

### 11.2 JWT generation

Helper:

- [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:25)

```js
return jwt.sign(
  { userId },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);
```

Meaning:

- token stores `userId`
- it is signed with secret key
- it expires after some time

### 11.3 Login flow

Route:

- [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:81)

Flow:

1. receive `email` and `password`
2. load user with hidden password included
3. reject if user not found or inactive
4. compare password
5. update `lastLoginAt`
6. generate JWT
7. return token and user info

Important code:

- load user with password: [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:93)
- compare password: [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:102)
- update last login: [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:110)

### 11.4 `/me` profile flow

Route:

- [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:138)

This returns current logged in user information.

### 11.5 Logout flow

Route:

- [auth.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/auth.routes.js:165)

This project uses stateless JWT.

Meaning:

- backend does not destroy token server-side
- client should delete token
- production systems often add token blacklist storage

---

## 12. Authentication Middleware Deep Explanation

Main code: [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:5)

### Step-by-step

#### Step 1: read Authorization header

- [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:8)

Expected format:

```txt
Authorization: Bearer <token>
```

If missing:

- returns 401

#### Step 2: verify JWT

- [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:22)

This checks:

- signature is valid
- token is not expired

#### Step 3: load actual user from DB

- [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:41)

Why this step matters:

- token may still be valid
- but user may be deleted or deactivated

#### Step 4: attach user info to request

- [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:52)

This is very important.

After this, next code can use:

```js
req.user.id
req.user.role
req.user.dailyTokenLimit
```

That is why chat and admin routes do not ask for user id manually from request body.

---

## 13. Rate Limiting

Main code: [rateLimiter.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/rateLimiter.js:5)

### Why rate limiting exists

- stop abuse
- reduce brute force attempts
- protect AI cost
- protect server resources

### Limiters in project

#### AI limiter

- [rateLimiter.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/rateLimiter.js:5)

20 requests per minute per user or IP.

#### Stream limiter

- [rateLimiter.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/rateLimiter.js:30)

10 stream requests per minute.

#### Auth limiter

- [rateLimiter.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/rateLimiter.js:51)

10 auth attempts in 15 minutes.

### Interesting detail

Code:

- [rateLimiter.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/rateLimiter.js:14)

If logged in, limiter keys by `req.user.id`.
If not logged in, limiter keys by IP.

That is a good real-world design.

---

## 14. Conversation Service Deep Explanation

Main code: [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:6)

This file contains business logic.

Think of it like this:

- routes receive HTTP request
- services do the real work

### 14.1 Create conversation

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:7)

This simply creates:

```js
Conversation.create({ userId })
```

At start, title is default `"New Conversation"`.

### 14.2 Validate conversation access

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:14)

This is one of the most important security parts.

It checks:

1. valid Mongo ObjectId
2. conversation exists
3. conversation belongs to current user

Code:

```js
const conversation = await Conversation.findOne({
  _id: conversationId,
  userId
});
```

This prevents user A from reading user B's chat.

### 14.3 List user conversations

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:37)

It returns:

- only active conversations
- newest first
- selected summary fields only

### 14.4 Archive conversation

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:45)

This is soft delete, not permanent delete.

Meaning:

- data stays in DB
- `status` becomes `archived`

### 14.5 Load message history

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:64)

Why sorted oldest first:

- AI needs conversation in natural order

Then it maps messages into this simple shape:

```js
{ role, content }
```

That is exactly what the AI service needs.

### 14.6 Save user message

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:86)

Flow:

1. create message document with role `user`
2. increment conversation `messageCount`
3. update `lastMessageAt`
4. if first message, set title from content

Important line:

- auto title condition: [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:104)

### 14.7 Save assistant message and usage

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:116)

This function does a lot:

1. calculate cost
2. calculate total tokens
3. save assistant message with `aiMeta`
4. save separate `AiUsage` record
5. update conversation totals

This is the heart of token tracking in the project.

### 14.8 Token calculation

Important line:

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:134)

```js
const totalTokens = (aiMetadata.inputTokens || 0) + (aiMetadata.outputTokens || 0);
```

Meaning:

- input tokens = prompt side
- output tokens = AI response side
- total = both added together

### 14.9 Cost calculation

Important lines:

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:128)

```js
const inputCost = (aiMetadata.inputTokens / 1_000_000) * 0.075;
const outputCost = (aiMetadata.outputTokens / 1_000_000) * 0.30;
```

Meaning:

- cost formula is based on per-million-token pricing
- this project applies cost only for Gemini
- Ollama is treated as free here

### 14.10 Usage stats aggregation

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:179)

This uses MongoDB aggregation to compute:

- usage grouped by provider
- today's total tokens
- today's total requests

---

## 15. Chat Route Flow from Zero

Main code: [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:8)

Very important first line:

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:11)

```js
router.use(authenticate);
```

Meaning:

- every chat route needs logged in user

### 15.1 Create conversation route

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:18)

Flow:

1. route receives request
2. `req.user.id` already exists from auth middleware
3. service creates conversation
4. response returns created conversation

### 15.2 List conversations route

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:29)

This returns only current user's active conversations.

### 15.3 Get messages route

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:39)

Important detail:

first it validates ownership, then it loads messages.

This order is correct and secure.

---

## 16. Token Budget Middleware Flow

Main code: [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:88)

This middleware runs before streaming AI response.

### Real flow

1. load current user from DB
2. compare current day with `tokenResetDate`
3. if new day, reset `tokensUsedToday`
4. compute budget object
5. block request if limit reached
6. attach `req.tokenBudget`

Key references:

- load current user: [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:90)
- detect new day: [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:93)
- persist reset: [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:99)
- attach budget: [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:128)

### Very important understanding

This middleware checks before AI call starts.

It does not know exact future token usage.
It only knows whether the user currently still has budget left.

After AI finishes, actual token usage is added to user usage.

That later update happens in:

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:116)

---

## 17. Streaming Chat Flow End to End

This is the most important flow in the whole project.

Route:

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:51)

### Full flow in correct order

1. user sends message to `/conversations/:id/stream`
2. auth middleware verifies user
3. token budget middleware checks limit
4. route validates message text
5. route validates conversation ownership
6. SSE headers are set
7. user message is saved
8. message history is loaded
9. AI streaming starts
10. chunks are sent to client live
11. final token counts are received
12. assistant message is saved
13. usage analytics is saved
14. user token usage is incremented
15. final `done` event is sent

### 17.1 Input validation

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:59)

Checks:

- message must exist
- message must be under 2000 characters

### 17.2 Conversation validation

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:66)

It calls service method to ensure:

- conversation exists
- user owns it

### 17.3 SSE headers

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:72)

Why needed:

- this is not normal JSON response
- server keeps connection open
- sends multiple events over time

### 17.4 Abort controller

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:79)

Meaning:

- if client closes connection
- backend aborts AI request too
- saves resources

### 17.5 Save user message before AI call

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:83)

Why save first:

- conversation history remains complete
- even if AI fails later, user prompt is preserved

### 17.6 Load recent history

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:84)

Then:

```js
const contextHistory = history.slice(0, -1);
```

Meaning:

- just-saved user message is removed from history copy
- because it is passed separately as `newMessage`
- this avoids duplicate prompt in AI request

This line is easy to miss but very important:

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:85)

### 17.7 Streaming chunks back

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:95)

```js
(chunk) => {
  fullResponse += chunk;
  res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
}
```

Meaning:

- each AI piece is appended into `fullResponse`
- same piece is immediately sent to frontend

So the app does two things at once:

- build final full answer
- stream partial answer live

### 17.8 On stream completion

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:100)

When AI finishes:

1. latency is calculated
2. total tokens are calculated
3. assistant message is saved
4. user's daily token usage is updated
5. final `done` event is sent

### 17.9 Final done event

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:124)

It sends:

- token counts
- latency
- updated budget usage

This is what frontend can use to show final stats.

---

## 18. AI Streaming Service Deep Explanation

Main code: [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:11)

This file hides provider-specific AI logic behind one unified interface.

### 18.1 `streamAI()` as the wrapper

Code:

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:11)

Simple idea:

- route calls one function
- that function decides whether to use Gemini or Ollama

This is good design because route code stays cleaner.

### 18.2 Gemini stream flow

Starts here:

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:32)

Flow:

1. read Gemini config
2. build request URL
3. convert history into Gemini format
4. send POST request
5. read SSE response stream
6. extract text chunks
7. extract token usage from final chunk
8. call `onDone`

### 18.3 Role conversion for Gemini

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:44)

Important detail:

Gemini expects assistant history role as `model`, not `assistant`.

That is why this code exists:

```js
role: msg.role === 'assistant' ? 'model' : 'user'
```

### 18.4 Text extraction

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:102)

This pulls text out of Gemini response JSON and passes it to callback.

### 18.5 Safety check

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:108)

If Gemini blocks answer for safety reasons, route is informed through error callback.

### 18.6 Token extraction from Gemini

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:117)

This is where token counts come from:

```js
inputTokens = parsed.usageMetadata.promptTokenCount || 0;
outputTokens = parsed.usageMetadata.candidatesTokenCount || 0;
```

This matters because later token math depends on these values.

### 18.7 Ollama stream flow

Starts here:

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:144)

Difference from Gemini:

- Ollama uses NDJSON, not the same Gemini SSE JSON structure
- it uses normal roles including `system`
- token values are returned as `0` in this implementation

Important note:

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:209)

So for Ollama in this project:

- chat works
- streaming works
- detailed token accounting is not really available the same way

### 18.8 Non-streaming helper

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:249)

This is useful for tasks where full JSON response is needed instead of live stream.

### 18.9 Safe JSON parser

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:324)

This strips markdown code fences and parses JSON safely.

Good for future features like:

- summarization
- structured AI extraction
- AI-generated objects

---

## 19. Exact Token Calculation Flow

This is the part many people get confused about.

Here is the exact order.

### Step 1: AI provider returns token counts

Gemini sets:

- `inputTokens`
- `outputTokens`

Code:

- [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:118)

### Step 2: chat route receives them

Code:

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:100)

```js
async ({ inputTokens, outputTokens }) => {
  const latencyMs = Date.now() - startTime;
  const totalTokens = inputTokens + outputTokens;
```

### Step 3: assistant save service calculates again for persistence

Code:

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:134)

```js
const totalTokens = (aiMetadata.inputTokens || 0) + (aiMetadata.outputTokens || 0);
```

Why calculate again:

- service should be self-contained
- service should save a correct final value from metadata it receives

### Step 4: assistant message stores token metadata

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:141)

Stored in `Message.aiMeta`.

### Step 5: analytics collection stores token record

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:153)

Stored in `AiUsage`.

### Step 6: conversation total is incremented

- [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:167)

```js
$inc: {
  messageCount: 1,
  totalTokensUsed: totalTokens
}
```

Meaning:

- add assistant message count
- add tokens to conversation summary

### Step 7: user daily token count is incremented

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:116)

```js
await User.findByIdAndUpdate(userId, {
  $inc: { tokensUsedToday: totalTokens }
});
```

Meaning:

- conversation total tracks one conversation
- user token budget tracks all usage across the day

### Easy difference to remember

- `Message.aiMeta.totalTokens` -> one assistant reply
- `Conversation.totalTokensUsed` -> one conversation total
- `User.tokensUsedToday` -> one user's daily total
- `AiUsage.totalTokens` -> analytics row for reporting

---

## 20. Admin Flow

Main code: [admin.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/admin.routes.js:9)

Important line:

```js
router.use(authenticate, requireAdmin);
```

Meaning:

- user must be logged in
- user must have role `admin`

### 20.1 Get all users

- [admin.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/admin.routes.js:13)

Returns up to 100 users, newest first, without password field.

### 20.2 Get system usage

- [admin.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/admin.routes.js:28)

This aggregates:

- by provider
- by model
- total tokens
- total cost
- request count

Then it also computes 7-day trend:

- [admin.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/admin.routes.js:46)

### 20.3 Get dashboard stats

- [admin.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/admin.routes.js:72)

This combines:

- total users
- total conversations
- total tokens
- total cost
- total requests

It uses `Promise.all`, which is good because multiple DB tasks run in parallel.

### 20.4 Update user token limit

- [admin.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/admin.routes.js:103)

Flow:

1. read `dailyTokenLimit` from request body
2. validate minimum value
3. update user
4. return updated user

This lets admin control how much AI budget each user gets per day.

---

## 21. Error Handling Flow

Main code: [errorHandler.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/errorHandler.js:5)

This middleware converts raw errors into safe API responses.

### What it handles

- AI provider errors
- AI unavailable errors
- AI blocked responses
- AI JSON parse errors
- Mongoose validation errors
- duplicate key errors
- invalid ObjectId errors
- JWT errors
- custom app errors
- generic fallback errors

### Why this is good design

- client gets predictable JSON
- internal details are not leaked too much
- logs stay detailed on server side

Important logging block:

- [errorHandler.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/errorHandler.js:9)

This logs:

- error message
- type
- status code
- path
- method
- user id

That is very helpful for debugging production issues.

---

## 22. Full Project Flow in One Story

If you want to remember the whole app, remember this story:

1. app starts in `app.js`
2. MongoDB connects
3. user registers
4. password is hashed by `User` model
5. user logs in
6. JWT is created
7. user calls chat route
8. auth middleware verifies token
9. conversation is created or opened
10. user message is saved in `Message`
11. conversation summary is updated
12. recent history is loaded
13. `streamAI()` calls Gemini or Ollama
14. chunks stream back live
15. Gemini returns token usage
16. assistant message is saved in `Message`
17. analytics row is saved in `AiUsage`
18. conversation token total is updated
19. user's daily token usage is updated
20. admin can later see usage reports

If you understand that story, you understand the project architecture.

---

## 23. How to Rebuild This Project Yourself Later

If you build something similar in future, follow this order:

1. create Express app
2. connect MongoDB
3. create `User` model
4. add registration and login
5. add JWT auth middleware
6. create `Conversation` and `Message` models
7. create conversation service functions
8. create stream route
9. create AI provider wrapper service
10. track tokens and cost
11. add `AiUsage` analytics model
12. add admin analytics routes
13. add rate limiting
14. add global error handling

This order matches the way professional backend systems usually grow.

---

## 24. Common Confusions Cleared

### "Where does token calculation happen?"

Answer:

- token counts come from Gemini stream in [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:118)
- total token math happens in [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:102) and [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:134)

### "Why save both Message and AiUsage?"

Answer:

- `Message` is for chat history
- `AiUsage` is for reporting and analytics

### "Why save token totals in Conversation too?"

Answer:

- fast summary view
- easier frontend display
- no need to recalculate from all messages every time

### "Why check user again from DB in auth middleware?"

Answer:

- token alone is not enough
- account could be deactivated after token issue

### "Why remove the last history message before AI call?"

Answer:

- because the new message is already passed separately
- otherwise prompt would be duplicated

Reference:

- [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:85)

---

## 25. Best Files to Revise Before Interview or Practice

If you revise only a few files, revise these first:

1. [app.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/app.js:13)
2. [user.model.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/models/user.model.js:4)
3. [auth.middleware.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/middleware/auth.middleware.js:5)
4. [conversation.service.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/conversation.service.js:86)
5. [chat.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/chat.routes.js:51)
6. [ai.stream.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/services/ai.stream.js:11)
7. [admin.routes.js](C:/Users/HP/Desktop/Agentic-AI/day-06/src/routes/admin.routes.js:28)

---

## 26. Final Mental Model

Use this one-line memory trick:

`routes receive -> middleware protects -> services process -> models store -> AI responds -> analytics track`

That is the whole project in one sentence.

