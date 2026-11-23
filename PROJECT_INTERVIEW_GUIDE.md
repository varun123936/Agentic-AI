# Agentic AI Project Interview Guide

## How to use this guide

Read each question, answer in 30–60 seconds, and then explain the relevant part of the project. The scenario questions describe problems commonly faced in real companies.

---

# 1. Project Overview

## Question 1: Explain the project in your own words.

**Simple answer:** This workspace is a step-by-step course project for building AI applications. It starts with direct Gemini and Ollama calls, then adds APIs, streaming, databases, authentication, document search, RAG, tools, agents, and approval workflows.

## Question 2: Is this one project or multiple projects?

**Simple answer:** It contains multiple stage projects. `day-02` to `day-09` show progressive backend features. `knowledge-base-ui` provides the frontend for the knowledge-base/RAG backend. `day-18` introduces tools, and `day-19` with `day-19-ui` is the agent application.

## Question 3: What are the three biggest outcomes?

**Simple answer:**

1. An authenticated AI knowledge-base application using MongoDB and RAG.
2. An AI chat application that can stream answers.
3. An agent application that uses tools and asks for approval before risky actions.

## Question 4: How do the folders build on each other?

**Simple answer:** Earlier folders introduce basic features, and later folders copy and improve that foundation. The sequence is API calls, structured output, streaming, persistence, authentication, documents, RAG, tools, agents, and UI.

## Question 5: What was the main learning progression?

**Simple answer:** It progressed from calling an AI model to building an application around the model. Later features solve real product problems such as memory, security, private documents, cost tracking, tool access, and safe operations.

## Question 6: Why should an application include a backend instead of calling AI directly from Angular?

**Simple answer:** API keys and sensitive configuration should stay on the server. The backend can validate users, apply budgets, control tools, enforce permissions, log actions, and prevent browser users from changing system behavior.

## Question 7: Which folders represent the two most complete applications?

**Simple answer:** `day-09` with `knowledge-base-ui` is the complete RAG application. `day-19` with `day-19-ui` is the complete tool-agent application.

## Question 8: What is Agentic AI?

**Simple answer:** Agentic AI means an AI system can take multiple steps toward a goal. It may understand a request, choose a tool, read tool results, decide the next step, and provide an answer.

## Question 9: What is the difference between regular AI chat and an agent?

**Simple answer:** Regular chat mainly creates text from a prompt. An agent can inspect a goal, call tools, work through multiple steps, and resume work after approval.

## Question 10: Give a real-world use case for this project.

**Simple answer:** A company could use the RAG side for employee policy questions and the agent side for order support or service incident investigation.

---

# 2. Node.js and Express

## Question 11: What does `src/app.js` do?

**Simple answer:** It creates the Express application, configures middleware, mounts routes, connects to MongoDB, and starts the HTTP server.

## Question 12: What is middleware?

**Simple answer:** Middleware is code that runs between a request and the final route response. The project uses middleware for JSON parsing, authentication, rate limiting, CORS, uploads, and errors.

## Question 13: Why is Express used?

**Simple answer:** Express provides HTTP routes, middleware, request handling, and JSON responses with minimal code.

## Question 14: What is a route?

**Simple answer:** A route maps an HTTP method and URL to a function. For example, `POST /api/chat/conversations` creates a conversation.

## Question 15: What is REST?

**Simple answer:** REST is an HTTP style where resources and operations use URLs and methods such as GET, POST, PATCH, and DELETE.

## Question 16: Why should a global error handler be registered last?

**Simple answer:** Express passes errors to error-handling middleware. Registering it after normal routes ensures unexpected errors are returned in a consistent format.

## Question 17: Why is input validation important?

**Simple answer:** Validation prevents empty, malformed, or oversized requests. It protects the database, AI APIs, cost budget, and application stability.

## Question 18: What is a 400 error? What is a 401? What is a 403?

**Simple answer:**

- `400`: The request itself is invalid.
- `401`: The user is not authenticated.
- `403`: The user is authenticated but not allowed to perform the action.

## Question 19: What is CORS?

**Simple answer:** CORS controls which website origins may call an API. It prevents an unrelated website from using the browser to access the API without permission.

## Question 20: What is rate limiting?

**Simple answer:** Rate limiting restricts how many requests a client or user can make in a period. It helps prevent abuse and controls expensive AI calls.

## Scenario: An API endpoint starts receiving too many requests.

**Simple answer:** Add or tune rate limiting, identify users or IP addresses, return `429 Too Many Requests`, log the source, and consider caching or provider limits.

---

# 3. Gemini and Ollama

## Question 21: How does the project support both Gemini and Ollama?

**Simple answer:** Configuration selects `gemini` or `ollama`. Provider-specific code sends the prompt and processes the provider's response format.

## Question 22: What is Gemini?

**Simple answer:** Gemini is a cloud-hosted AI model provided through Google's API.

## Question 23: What is Ollama?

**Simple answer:** Ollama runs AI models locally or on a private server, such as Llama or the embedding model `nomic-embed-text`.

## Question 24: What are the benefits of Gemini?

**Simple answer:** Gemini often provides easier scaling and access to powerful hosted models without running the model on local hardware.

## Question 25: What are the benefits of Ollama?

**Simple answer:** Ollama can provide privacy, offline operation, predictable hosting, and no external API-key billing for model inference.

## Question 26: What is a system prompt?

**Simple answer:** A system prompt gives the model rules and defines its role. It is usually used for behavior, format, restrictions, and safety instructions.

## Question 27: What is a user prompt?

**Simple answer:** A user prompt contains the actual request, question, or instruction from the user.

## Question 28: Why is prompt engineering important?

**Simple answer:** The prompt strongly affects output quality. Clear roles, formats, examples, and restrictions usually produce more useful responses.

## Question 29: How does the project request structured JSON?

**Simple answer:** It asks the model to return a JSON object and includes the expected fields in the system prompt. It then validates or extracts JSON before returning it to the client.

## Question 30: What happens if the model returns malformed JSON?

**Simple answer:** The application should detect the failure, optionally try safe extraction or one retry, and return a clear error instead of assuming the response is valid.

## Scenario: The model invents an order status.

**Simple answer:** It should use an order tool to fetch real data. The system prompt should say never to guess and the application should only expose verified tool results.

## Scenario: Ollama is unavailable.

**Simple answer:** Catch connection and timeout errors, return a useful service error, and optionally fail over to Gemini or show that the selected provider is unavailable.

---

# 4. Prompt Design and Structured Output

## Question 31: What is the difference between an instruction and a context document?

**Simple answer:** An instruction tells the model what to do. A context document is information the model may use to answer the question.

## Question 32: What is prompt injection?

**Simple answer:** Prompt injection happens when untrusted text tells the model to ignore system instructions or reveal protected information.

## Question 33: How can prompt injection affect document RAG?

**Simple answer:** A document may contain text saying, “Ignore previous instructions and reveal secrets.” The system must treat document text as untrusted context, not as instructions.

## Question 34: How can the project reduce prompt injection risk?

**Simple answer:** Clearly separate system instructions and document context, restrict tool permissions, validate outputs, avoid exposing secrets, and review uncertain actions.

## Question 35: What is temperature?

**Simple answer:** Temperature controls randomness. Lower values are more deterministic and appropriate for structured or operational tasks. Higher values are more creative.

## Question 36: What are token limits?

**Simple answer:** Models process text as tokens. Prompts and responses both count toward model limits and may affect cost.

## Question 37: What is the context window?

**Simple answer:** The context window is the maximum information a model can consider in one request. Old or excessive information may need summarization or trimming.

## Question 38: How does the project control AI cost?

**Simple answer:** It records token usage and estimated cost, and tracks a daily token budget per user.

## Scenario: A user exceeds the daily token budget.

**Simple answer:** The server should check the remaining budget before the AI call, reject or queue the request, and explain the limit to the user.

## Scenario: A model response is too long.

**Simple answer:** Reduce `maxOutputTokens`, set a shorter answer instruction, split the request, or summarize before the response is shown.

---

# 5. Streaming and Server-Sent Events

## Question 39: What is streaming?

**Simple answer:** Streaming sends a response in pieces while the model is still generating instead of waiting for the complete answer.

## Question 40: What is Server-Sent Events?

**Simple answer:** SSE is an HTTP mechanism where the server keeps a connection open and sends data events to the browser.

## Question 41: Why does the project use SSE?

**Simple answer:** It makes chat and RAG answers feel faster and lets the UI show status, tool calls, approval requests, chunks, and completion events.

## Question 42: How is SSE different from WebSockets?

**Simple answer:** SSE is one-way, server-to-browser, and built over HTTP. WebSockets allow continuous two-way communication. SSE is enough for streamed AI text.

## Question 43: What HTTP headers are needed for SSE?

**Simple answer:** The project sets `Content-Type: text/event-stream`, disables caching, keeps the connection alive, and may disable proxy buffering.

## Question 44: What data format does the browser receive?

**Simple answer:** The server sends lines such as `data: {"type":"chunk","content":"Hello"}` and an empty line after each event.

## Question 45: Why must SSE connections end properly?

**Simple answer:** Without cleanup, open intervals and connections can consume memory or continue sending after the client disconnects.

## Question 46: Why should the server handle client disconnection?

**Simple answer:** It should stop upstream work, abort provider requests when possible, close SSE resources, and avoid writing to an ended response.

## Question 47: How does the Angular client receive SSE data?

**Simple answer:** It uses the browser Fetch API because `HttpClient` is not designed for incremental streaming. It reads the response body, decodes lines, parses JSON, and handles events.

## Scenario: The UI hangs during streaming.

**Simple answer:** Check the SSE headers, connection cleanup, provider timeout, malformed events, proxy buffering, client abort handling, and the server's keep-alive mechanism.

## Scenario: The UI receives duplicated text.

**Simple answer:** Inspect chunk handling and verify the UI does not append the same chunk twice and that SSE chunks are parsed only once.

---

# 6. MongoDB and Mongoose

## Question 48: Why does the project use MongoDB?

**Simple answer:** MongoDB stores flexible JSON-like application records such as users, conversations, messages, documents, usage, and chunk metadata.

## Question 49: What is Mongoose?

**Simple answer:** Mongoose is a Node.js library that defines schemas and connects application code to MongoDB.

## Question 50: What is a schema?

**Simple answer:** A schema defines field names and types for an application record. MongoDB is flexible, but a schema gives the application predictable structure.

## Question 51: What is a model?

**Simple answer:** A model is a JavaScript interface that uses a Mongoose schema to create, read, update, and delete MongoDB documents.

## Question 52: Explain the main models in the knowledge-base project.

**Simple answer:**

- `User`: identity, role, password, and token budget.
- `Conversation`: chat metadata and summary.
- `Message`: a user or assistant message.
- `AiUsage`: provider, token count, cost, and latency.
- `Document`: file metadata and extracted text.
- `Chunk`: document chunk metadata and vector reference.

## Question 53: Why should conversation history be limited?

**Simple answer:** Unlimited history can exceed the model context window and increase cost and response latency.

## Question 54: What is soft deletion?

**Simple answer:** Soft deletion marks a record inactive instead of permanently deleting it. It allows recovery and auditing.

## Question 55: What is an index in MongoDB?

**Simple answer:** An index makes common queries faster, such as finding conversations by user or documents by owner.

## Question 56: What is ownership checking?

**Simple answer:** Ownership checking confirms that the current user is allowed to access or modify a record.

## Scenario: A user asks for another user's document.

**Simple answer:** The server must reject the request by checking `document.ownerId === currentUser.id` before reading, indexing, deleting, or summarizing it.

## Scenario: MongoDB is unavailable.

**Simple answer:** The server should fail quickly with a service error, avoid starting the app as healthy, and use database connection retries and timeouts.

---

# 7. Authentication and Authorization

## Question 57: What is authentication?

**Simple answer:** Authentication proves who the user is, usually through login credentials or a token.

## Question 58: What is authorization?

**Simple answer:** Authorization decides what an authenticated user is allowed to do.

## Question 59: How does registration work?

**Simple answer:** The server validates input, checks whether the email exists, hashes the password, creates a user, and returns a JWT.

## Question 60: Why are passwords hashed?

**Simple answer:** Hashing prevents the database from storing readable passwords. bcrypt also adds a slow hashing process to make guessing harder.

## Question 61: What is a JWT?

**Simple answer:** A JWT is a signed token containing identity and token details. The server verifies it before allowing protected access.

## Question 62: Where is the JWT sent?

**Simple answer:** It is normally sent in the `Authorization: Bearer <token>` header.

## Question 63: How does the auth middleware work?

**Simple answer:** It extracts the bearer token, verifies the signature and expiry, loads the current user, checks that the user is active, and attaches the user to the request.

## Question 64: What is role-based access control?

**Simple answer:** RBAC gives permissions based on roles such as user or administrator.

## Question 65: What is the difference between a user role and document ownership?

**Simple answer:** A role defines general permission, such as administrator. Ownership defines whether a particular resource belongs to the current user.

## Question 66: What makes a JWT secure?

**Simple answer:** A strong secret, a reasonable expiry, HTTPS, server-side verification, careful claims, and safe browser storage practices.

## Question 67: What should happen after logout?

**Simple answer:** The UI should remove the token. If immediate server-side cancellation is required, the backend also needs a token revocation mechanism.

## Scenario: A user's role changes while their JWT is valid.

**Simple answer:** The middleware should load the current user or check a role version instead of trusting only the old JWT claims.

## Scenario: A normal user calls an admin API directly.

**Simple answer:** The server must check the role in middleware and return `403`, regardless of what the UI shows or hides.

---

# 8. AI Usage and Cost Tracking

## Question 68: What should be recorded for each AI call?

**Simple answer:** User, conversation, provider, model, operation, input tokens, output tokens, latency, and estimated cost.

## Question 69: Why is usage data stored?

**Simple answer:** It supports budgets, billing, analytics, capacity planning, and troubleshooting.

## Question 70: Why can an estimated cost be inaccurate?

**Simple answer:** Provider pricing and token accounting may change. Some providers also count cached, tool, or system tokens differently.

## Question 71: What is the difference between input and output tokens?

**Simple answer:** Input tokens are the prompt and context sent to the model. Output tokens are the text generated by the model.

## Question 72: How can the app stop a user from exceeding a budget?

**Simple answer:** Check the used and reserved token amount before each call, reject or reserve the request, and update usage after completion.

## Scenario: Two requests run when only one request is within budget.

**Simple answer:** Make token reservation atomic in the database or cache. Reserve the budget first and release unused reserved tokens when the response finishes.

---

# 9. Document Upload

## Question 73: What is `multer` used for?

**Simple answer:** Multer handles multipart file uploads and stores files or exposes file data for processing.

## Question 74: What documents does Day-07 support?

**Simple answer:** It supports PDF and text-like document formats such as text and markdown-style files.

## Question 75: What should an upload API validate?

**Simple answer:** Authentication, file existence, MIME type, file extension, file size, filename, and user ownership.

## Question 76: Why limit file size?

**Simple answer:** Oversized files can consume disk space, memory, CPU, processing time, and AI context unexpectedly.

## Question 77: How is PDF text extracted?

**Simple answer:** The server reads the file with `pdf-parse`, which converts extractable PDF text into a text string.

## Question 78: Why can extracted PDF text be imperfect?

**Simple answer:** Scanned images, tables, columns, fonts, encryption, and unusual layouts may not convert into clean text.

## Question 79: What should be stored for a document?

**Simple answer:** Owner, original name, storage path, MIME type, size, status, extracted text, chunk count, and timestamps.

## Question 80: What is soft deletion for documents?

**Simple answer:** It prevents normal access but keeps metadata for recovery and auditing instead of immediately deleting files and records.

## Scenario: A PDF has 500 pages.

**Simple answer:** Extract it safely, split it into chunks, process it incrementally, enforce limits, and index only approved and owned content.

## Scenario: Someone uploads an executable file renamed `.pdf`.

**Simple answer:** Do not trust the extension. Verify MIME and content, process PDF safely, and isolate or reject unrecognized files.

---

# 10. Chunking and RAG

## Question 81: What is chunking?

**Simple answer:** Chunking splits a large document into smaller sections so it can be embedded and searched efficiently.

## Question 82: Why is chunk overlap useful?

**Simple answer:** Overlap helps preserve context between neighboring chunks when a sentence or idea crosses a boundary.

## Question 83: What is an embedding?

**Simple answer:** An embedding is a list of numbers representing text meaning. Similar meanings usually have similar vector values.

## Question 84: What embedding model does the project use?

**Simple answer:** It uses Ollama's `nomic-embed-text` model.

## Question 85: What is a vector database?

**Simple answer:** A vector database stores embeddings and finds vectors that are numerically similar to a query vector.

## Question 86: What vector database does this project use?

**Simple answer:** ChromaDB Cloud.

## Question 87: What is RAG?

**Simple answer:** Retrieval-Augmented Generation searches relevant source content and gives that content to an AI model before generating an answer.

## Question 88: What are the steps in RAG indexing?

**Simple answer:** Extract text, split it into chunks, embed the chunks, store vectors in ChromaDB, and store chunk metadata in MongoDB.

## Question 89: What are the steps in RAG querying?

**Simple answer:** Embed the question, search similar chunks, select relevant context, send context with the question to the AI, and return a grounded answer.

## Question 90: What is semantic search?

**Simple answer:** Semantic search finds text based on meaning rather than exact keyword matching.

## Question 91: Why use RAG instead of putting all documents in the prompt?

**Simple answer:** Most document collections are too large for one context window. RAG sends only relevant sections and improves relevance and cost.

## Question 92: What is top-K retrieval?

**Simple answer:** Top-K means returning only the K most similar chunks.

## Question 93: What is metadata filtering?

**Simple answer:** It restricts search results using fields such as document ID, owner, category, or access level.

## Question 94: What is reranking?

**Simple answer:** Reranking reviews the retrieved chunks and puts the most relevant or permitted ones first.

## Question 95: How can the answer cite source chunks?

**Simple answer:** Return chunk identifiers or document sections with the answer, and include enough metadata for the UI to show a source label or page number.

## Scenario: RAG answers from a chunk that does not belong to the user.

**Simple answer:** Apply ownership and authorization filters both during vector search and before returning source text. Never rely only on UI hiding.

## Scenario: RAG gives a confident answer from the wrong section.

**Simple answer:** Improve chunking, add reranking, filter by metadata, increase retrieval quality, and instruct the model to answer only from supplied context or say it does not know.

## Scenario: The system does not find an answer even though the document contains it.

**Simple answer:** Inspect extraction quality, chunk boundaries, embedding model, query wording, similarity threshold, and top-K settings.

## Scenario: Users ask many RAG questions in one minute.

**Simple answer:** Apply rate limits, cache repeated results if safe, reserve usage budgets, and consider an asynchronous indexing queue.

---

# 11. RAG Service Design

## Question 96: What is the role of `rag.service.js`?

**Simple answer:** It coordinates indexing, embedding, vector retrieval, prompt creation, and AI answer generation.

## Question 97: What is the role of `vectorstore.service.js`?

**Simple answer:** It handles ChromaDB operations such as storing and searching vectors.

## Question 98: What is the role of `embedding.service.js`?

**Simple answer:** It converts text into numeric vectors using Ollama.

## Question 99: What is stored in MongoDB versus ChromaDB?

**Simple answer:** MongoDB stores application records and metadata. ChromaDB stores embedding vectors and vector identifiers used for semantic search.

## Question 100: What happens if vector search is unavailable?

**Simple answer:** RAG chat should return a clear service error or use a safe fallback such as keyword search if implemented. It should not silently produce an unsupported answer.

## Question 101: What is a hallucination?

**Simple answer:** A hallucination is an answer that sounds correct but is invented or not supported by the source information.

## Question 102: How can RAG reduce hallucinations?

**Simple answer:** Retrieve relevant evidence, tell the model to stay within that evidence, ask it to say “not found,” and show citations.

## Question 103: What is the RAG answer-grounding rule?

**Simple answer:** The answer should be supported by retrieved content. If evidence is missing or contradictory, the system should say that clearly.

---

# 12. Tool Calling and MCP

## Question 104: What is tool calling?

**Simple answer:** Tool calling lets an AI request that the application run a function for real data or an action.

## Question 105: What is an MCP-style tool registry?

**Simple answer:** The registry is a central list of tool names, descriptions, parameters, and executable functions.

## Question 106: How does tool calling work in this project?

**Simple answer:** The server gives tool declarations to the model. The model requests a tool, the server executes it, sends the result back, and repeats until the model gives a final answer.

## Question 107: Why is tool execution done on the server?

**Simple answer:** The server can validate, authorize, log, and limit actions. Running tools in the browser would expose secrets and allow uncontrolled execution.

## Question 108: What is a tool round?

**Simple answer:** One round is a model response that requests or completes a tool call. The project limits rounds to prevent infinite tool loops.

## Question 109: What is a function declaration?

**Simple answer:** It is the model-readable description of a function, including its name, purpose, parameters, required fields, and types.

## Question 110: Why should a tool have an allowlist for arguments?

**Simple answer:** The model could produce unexpected values. Validation and allowlists prevent dangerous or unsupported operations.

## Question 111: How does the project support tools with Ollama?

**Simple answer:** It includes tool instructions in a system prompt and asks Ollama to output a recognizable JSON tool call. The server parses and executes it.

## Question 112: How does the project support tools with Gemini?

**Simple answer:** Gemini can receive native function declarations and return a structured `functionCall` object.

## Question 113: What tools are in the project?

**Simple answer:** Order, product, weather, health, service log, restart, and incident-report tools are represented across Day-18 and Day-19.

## Question 114: What is tool orchestration?

**Simple answer:** Tool orchestration manages tool selection, execution order, result handling, limits, retries, and the final answer.

## Scenario: The model calls `cancel_order` twice.

**Simple answer:** Use an idempotency key and server-side state checks. The operation should recognize that the cancellation has already happened and return the existing result.

## Scenario: The model calls a tool with a missing order ID.

**Simple answer:** The executor should validate required parameters and return a structured error instead of executing the tool.

## Scenario: The model tries to restart every service.

**Simple answer:** Restrict the tool to allowed service names and require approval for restart operations. The model should not receive unchecked bulk powers.

---

# 13. Agents

## Question 115: What is `BaseAgent`?

**Simple answer:** `BaseAgent` contains shared provider loops, tool execution, approval state handling, message history, and completion logic.

## Question 116: What is the purpose of `IncidentAgent`?

**Simple answer:** It investigates incidents by checking service health, logs, status, and related operational information.

## Question 117: What is the purpose of `OrderAgent`?

**Simple answer:** It handles order and product questions such as order status, customer orders, product search, and stock checks.

## Question 118: What is agent memory?

**Simple answer:** Agent memory is information retained across turns or steps, such as conversation history, tool results, or pending approval state.

## Question 119: What is short-term agent memory?

**Simple answer:** It is recent messages or tool results kept in the current conversation or agent execution.

## Question 120: What is long-term agent memory?

**Simple answer:** It is durable information stored in MongoDB or another system, such as preferences or records.

## Question 121: What is an execution log?

**Simple answer:** An execution log records tool names and outcomes so users and operators can understand what the agent did.

## Question 122: What is a maximum tool round limit?

**Simple answer:** It is a maximum number of tool calls or reasoning loops. It prevents the agent from running forever or consuming excessive resources.

## Scenario: An agent keeps calling tools without answering.

**Simple answer:** Use a maximum round limit, detect repeated tool calls, return a timeout or partial result, and log the loop.

## Scenario: An agent receives incomplete tool results.

**Simple answer:** Continue only with available evidence, ask a follow-up question, or return a clear partial answer instead of guessing.

---

# 14. Human-in-the-Loop Approval

## Question 123: What is human-in-the-loop?

**Simple answer:** It means a person must review or approve important actions before the system executes them.

## Question 124: When should approval be required?

**Simple answer:** For destructive, expensive, security-sensitive, customer-impacting, or irreversible actions.

## Question 125: Which Day-19 actions should require approval?

**Simple answer:** Restarting a service, cancelling an order, creating incidents, refunds, and other state-changing operations should require approval.

## Question 126: How does the project implement approval?

**Simple answer:** The agent detects a protected tool, creates an approval state, sends an SSE event, and waits. The user approves or denies through an approval endpoint.

## Question 127: What happens after approval?

**Simple answer:** The server executes the tool, sends the result to the model, and asks the model to continue and summarize the outcome.

## Question 128: What happens after denial?

**Simple answer:** The server sends a denial result to the agent, and the model suggests alternatives or explains that no action was taken.

## Question 129: Why are approval states stored in memory currently incomplete?

**Simple answer:** A server restart or scaling to multiple instances loses pending state. Approval state should be stored in Redis or MongoDB.

## Question 130: What should an approval record contain?

**Simple answer:** Session ID, requester, tool name, arguments, status, timestamps, approver, feedback, and result.

## Scenario: An approval request arrives 40 minutes after it was created.

**Simple answer:** Reject or expire it based on the configured time-to-live instead of executing a potentially stale action.

## Scenario: Two users approve the same restart.

**Simple answer:** Make approval single-use, keep the request status in shared storage, and ensure only one execution occurs.

## Scenario: The approve API is called directly without UI access.

**Simple answer:** Require authentication and authorization, verify the session belongs to the approver or operator role, and validate that the session is still pending.

---

# 15. Angular Frontend

## Question 131: Why did the project use Angular?

**Simple answer:** Angular provides components, routing, dependency injection, reactive forms, HTTP services, guards, interceptors, and a structured frontend architecture.

## Question 132: What is a standalone Angular component?

**Simple answer:** A standalone component declares its own imports and can be lazy-loaded without using an NgModule.

## Question 133: What is dependency injection?

**Simple answer:** Angular creates and provides required services to components automatically, for example `AgentService` or `AuthService`.

## Question 134: What is an Angular service?

**Simple answer:** A service contains reusable API or business logic that components can use.

## Question 135: What is an Angular route guard?

**Simple answer:** A route guard decides whether a user may open a route. The auth guard checks the token and redirects unauthenticated users.

## Question 136: What is an HTTP interceptor?

**Simple answer:** An interceptor changes outgoing or incoming HTTP requests automatically. This project uses it to add JWT headers and manage loading state.

## Question 137: What is RxJS?

**Simple answer:** RxJS manages asynchronous data as streams and provides operators for handling HTTP observables.

## Question 138: What is an Observable?

**Simple answer:** An Observable represents a value or sequence that can arrive later or over time.

## Question 139: What is a signal in Angular?

**Simple answer:** A signal holds reactive state. When it changes, Angular components can update the UI efficiently.

## Question 140: What is lazy loading?

**Simple answer:** Lazy loading downloads a route component only when the user navigates to it. It can reduce initial load size.

## Question 141: How does the knowledge-base UI call the backend?

**Simple answer:** Feature services call `ApiService` or a native Fetch stream, and an auth interceptor attaches the JWT to HTTP requests.

## Question 142: Why does the RAG UI use native Fetch for streaming?

**Simple answer:** Incremental SSE streams need direct response-body reading, which is handled through browser Fetch and an `AbortController`.

## Question 143: What is `AbortController` used for?

**Simple answer:** It cancels an active Fetch request when the user leaves or starts a replacement request.

## Scenario: A user starts two chat requests quickly.

**Simple answer:** Disable the send button while streaming and abort the previous controller before starting a replacement request.

## Scenario: The UI becomes blank after an API error.

**Simple answer:** Keep existing state, show a clear error message, stop loading indicators, and handle authentication redirects.

---

# 16. Security

## Question 144: What should not be stored in frontend code?

**Simple answer:** Gemini or Ollama API keys, JWT signing secrets, database credentials, and ChromaDB credentials.

## Question 145: What is HTTPS needed for?

**Simple answer:** HTTPS encrypts requests and responses so credentials and private documents cannot be read over the network.

## Question 146: What is least privilege?

**Simple answer:** Give a user or tool only the permissions it needs and nothing more.

## Question 147: What is secret rotation?

**Simple answer:** It means replacing credentials or keys regularly and retiring the old credentials.

## Question 148: What is a security audit log?

**Simple answer:** It is a record of sensitive actions such as login, document access, tool execution, approval, denial, and admin changes.

## Question 149: How should uploaded files be protected?

**Simple answer:** Authenticate the uploader, validate file type and size, isolate storage, check ownership, and avoid exposing direct local filesystem paths.

## Question 150: What is SSRF?

**Simple answer:** SSRF means an attacker tricks a server into making network requests to protected internal addresses. URLs and provider endpoints should be validated and allowlisted.

## Question 151: What is rate-limit bypass?

**Simple answer:** It happens when limits are enforced only by browser code or only by IP. Limits should be enforced by the server using user and route-specific policies.

## Question 152: What is an idempotency key?

**Simple answer:** It identifies an operation uniquely so repeating it does not execute an action twice.

## Scenario: A token is stolen.

**Simple answer:** Revoke or rotate credentials, reduce token lifetime, add refresh-token protection or session invalidation, and review audit logs.

## Scenario: A document contains a malicious prompt.

**Simple answer:** Treat document text as untrusted data, keep system instructions separate, prevent exposed tools, and require approval for actions.

---

# 17. Architecture and System Design

## Question 153: Describe the knowledge-base architecture.

**Simple answer:** Angular sends authenticated requests to Express. Express uses JWT middleware, MongoDB for records, Ollama for embeddings, ChromaDB for vector search, and Gemini or Ollama for answers.

## Question 154: Describe the agent architecture.

**Simple answer:** Angular sends a request to Express. An agent combines the message with tool declarations and the selected AI provider. Tools are resolved and executed by a central registry and executor.

## Question 155: Why separate routes, services, models, middleware, and tools?

**Simple answer:** Separation makes code easier to test and maintain. Routes handle HTTP, services handle behavior, models handle data, middleware handles cross-cutting concerns, and tools handle external actions.

## Question 156: What is a monolith?

**Simple answer:** A monolith runs related features in one deployable application. These stage projects are monolithic Express applications.

## Question 157: What is a microservice?

**Simple answer:** A microservice is a smaller independently deployed service with a clear responsibility.

## Question 158: Should this project be split into microservices now?

**Simple answer:** Probably not as a first step. It can remain modular. Split only when scaling or team boundaries justify separate deployment.

## Question 159: What is a provider adapter?

**Simple answer:** A provider adapter creates one common interface around Gemini or Ollama, even though their APIs differ.

## Question 160: What should the provider interface contain?

**Simple answer:** It should support chat, streaming, embeddings, function calling or tool formatting, provider errors, and timeouts.

## Scenario: Gemini has high latency, while Ollama is local.

**Simple answer:** Allow runtime provider switching, measure latency, use provider-specific health checks, and route based on availability and required privacy.

## Scenario: The application needs a new AI provider.

**Simple answer:** Add a provider adapter without rewriting every route. Routes should call the common provider interface.

---

# 18. Reliability and Error Handling

## Question 161: What is a timeout?

**Simple answer:** A timeout stops waiting after a configured period so one slow provider or database cannot block the server.

## Question 162: What is retry behavior?

**Simple answer:** Retry behavior repeats a temporary failure. It should limit attempts and avoid repeating dangerous operations.

## Question 163: What is exponential backoff?

**Simple answer:** It increases the delay between retries. This gives an overloaded service time to recover.

## Question 164: What is a circuit breaker?

**Simple answer:** It stops repeated calls to a provider or service after failures reach a threshold. It helps prevent a cascade failure.

## Question 165: What is graceful degradation?

**Simple answer:** It means the system keeps offering a reduced service when one component fails.

## Question 166: What should happen when ChromaDB fails?

**Simple answer:** Stop RAG generation, show a clear error or maintenance state, and avoid using documents as if retrieval succeeded.

## Scenario: MongoDB becomes unavailable for 10 seconds.

**Simple answer:** Use connection retry and request timeouts, return a `503` response, show no false success, and keep the provider call from running when required data cannot be saved.

## Scenario: An AI provider starts returning empty responses.

**Simple answer:** Detect empty or malformed responses, fail safely, log details, and optionally retry with a different provider or prompt.

---

# 19. Testing and Quality

## Question 167: What tests should this project include?

**Simple answer:** Unit tests, route tests, database tests, provider mock tests, RAG retrieval tests, approval tests, UI tests, and end-to-end tests.

## Question 168: What is a unit test?

**Simple answer:** A unit test checks one small function or class without external systems.

## Question 169: What is an integration test?

**Simple answer:** An integration test checks that components work together, such as route, database, authentication, and service code.

## Question 170: What is an end-to-end test?

**Simple answer:** An E2E test opens the UI and follows a real user flow through frontend, backend, database, and provider-related dependencies.

## Question 171: How should AI calls be tested without a real provider?

**Simple answer:** Use mock provider responses and test parsing, tool loops, streaming events, retries, and final UI behavior.

## Question 172: How should RAG quality be tested?

**Simple answer:** Create known questions and expected source chunks, then measure retrieval recall, answer relevance, citation accuracy, refusal behavior, and hallucinations.

## Question 173: What is a test baseline?

**Simple answer:** A frozen set of expected behaviors that should remain unchanged after modifications.

## Scenario: The RAG answer changed after chunk size was modified.

**Simple answer:** Compare against the RAG evaluation dataset and source citations. Adjust chunking or retrieve settings until quality meets the accepted baseline.

## Scenario: Approval behavior breaks after an agent refactor.

**Simple answer:** Add a test for pending approval, approve execution, deny execution, session expiry, and single-use approval state.

---

# 20. DevOps and Deployment

## Question 174: What should be in `.env.example`?

**Simple answer:** Names and example values for MongoDB, JWT, Gemini, Ollama, ChromaDB, CORS, port, upload size, and document storage settings.

## Question 175: Why are real API keys never committed?

**Simple answer:** Anyone with repository access could misuse or charge the account and access private data.

## Question 176: What deployment containers might be needed?

**Simple answer:** Angular frontend, Express knowledge-base API, Express agent API, MongoDB, and optionally Ollama and ChromaDB infrastructure.

## Question 177: What is Docker?

**Simple answer:** Docker packages an application and dependencies into a repeatable container image.

## Question 178: What is Docker Compose?

**Simple answer:** Docker Compose starts and connects multiple containers such as the backend and MongoDB using one configuration.

## Question 179: What is CI/CD?

**Simple answer:** CI/CD automatically builds and tests code, then can deploy verified changes to an environment.

## Question 180: What health checks are needed?

**Simple answer:** Process health, database connectivity, vector-store connectivity, provider connectivity, and required configuration checks.

## Scenario: `day-09` and `day-19` are both configured for port 3000.

**Simple answer:** Assign different ports or place both behind a gateway. For example, use 3000 for knowledge base and 3001 for agents in local development.

## Scenario: The UI works locally but fails after deployment.

**Simple answer:** Inspect API URLs, CORS, TLS, environment variables, routing, SSE proxy settings, health checks, and container networking.

---

# 21. Observability

## Question 181: What should the application log?

**Simple answer:** Request IDs, provider, latency, tool calls, approval decisions, errors, usage counts, and relevant resource IDs while excluding secrets and private content.

## Question 182: What is structured logging?

**Simple answer:** Structured logs use fields such as JSON instead of only human-readable text, making logs searchable and measurable.

## Question 183: What is a correlation ID?

**Simple answer:** A correlation ID identifies one request across frontend, backend, provider, database, and tool events.

## Question 184: What metrics should be measured?

**Simple answer:** Requests, latency, errors, token usage, provider usage, tool executions, approval waits, RAG retrieval quality, and vector-search time.

## Question 185: What is tracing?

**Simple answer:** Tracing follows a request through several components and shows where time or errors occur.

## Scenario: RAG responses become slow.

**Simple answer:** Measure embedding time, vector-search time, model generation time, chunk count, and MongoDB access. Then optimize the slowest stage.

---

# 22. Improvements and Incomplete Areas

## Question 186: What is the biggest structural improvement needed?

**Simple answer:** Consolidate duplicated stage code into maintained shared packages or a single final monorepo instead of separate copies.

## Question 187: What is the biggest security improvement needed?

**Simple answer:** Persist approvals, centralize authorization, validate all tool arguments, apply document ownership consistently, and add audit logs.

## Question 188: What is the biggest RAG improvement needed?

**Simple answer:** Add robust evaluations for retrieval, citations, hallucinations, access control, chunk quality, reranking, and source filtering.

## Question 189: What is missing for production deployment?

**Simple answer:** A verified Docker setup, environment examples, CI/CD, secret management, SSL/TLS, monitoring, testing, backups, and persistent approval storage.

## Question 190: How should approval state be improved?

**Simple answer:** Store it in MongoDB or Redis, support expiry and status changes, and ensure only the authorized approver can execute it once.

## Question 191: How should provider code be improved?

**Simple answer:** Use provider adapters behind one interface so all routes and agents use the same chat, streaming, embedding, and tool capabilities.

## Question 192: How should tool calls be improved?

**Simple answer:** Add schemas, authorization, allowlists, idempotency, retries, timeouts, audit logs, and approval policies.

## Question 193: How should conversation memory be improved?

**Simple answer:** Trim history by token count, summarize older messages, store durable preferences only with permission, and add retention rules.

## Question 194: How should tests be improved?

**Simple answer:** Add route, unit, integration, RAG, approval, security, UI, and mock-provider tests before deployment.

## Question 195: What is a good release sequence?

**Simple answer:** Stabilize configuration, secure identity and tools, persist state, test, add observability, containerize, deploy, and then optimize.

---

# 23. Common Scenario-Based Interview Questions

## Scenario 1: A user uploads a confidential document and another user searches for it.

**Good answer:** The server must not return the document or its chunks. Every upload, index, search, and RAG generation route must verify ownership or an organization-sharing permission. Vector search needs metadata filtering, and authorization must also be checked after retrieval.

## Scenario 2: The LLM says it cancelled an order but the server did not execute a tool.

**Good answer:** The system must enforce tool execution on the server. The model's text is not proof of action. Verify tool results and return success only after a tool confirms the cancellation.

## Scenario 3: ChromaDB returns chunks that are irrelevant.

**Good answer:** Improve chunk size and overlap, clean extracted text, improve the embedding model or query, add metadata filters, add reranking, and evaluate with known retrieval test cases.

## Scenario 4: A restart approval remains pending after server restart.

**Good answer:** Store pending approvals in Redis or MongoDB instead of memory. Include expiry, status, tool arguments, requester, approver, and audit details.

## Scenario 5: The product API becomes slow.

**Good answer:** Add caching where correct, measure database and provider latency, enforce timeouts, and avoid serial tool calls when independent calls can run safely in parallel.

## Scenario 6: Two incidents have nearly the same name.

**Good answer:** Require or validate exact incident IDs and service names. Use structured parameters and lookups instead of relying on free-text model guesses.

## Scenario 7: Gemini charges too much for routine chat.

**Good answer:** Set token budgets, limit history and output size, cache safe repeated answers, use shorter prompts, and consider local Ollama for privacy or cost-sensitive workloads.

## Scenario 8: A malicious document contains instructions to delete all records.

**Good answer:** Treat it as untrusted context. Do not expose destructive tools to document chat or require the separate approval system. Use tool permissions, strict schemas, and RAG grounding rules.

## Scenario 9: The UI loses the streaming answer due to a network interruption.

**Good answer:** Display a partial response or retry state, keep a server-side or database fallback, support request cancellation, and show whether the partial answer is complete.

## Scenario 10: A model provider is down.

**Good answer:** Use provider health checks and timeouts. The system can use Ollama fallback, return maintenance status, or disable the feature. It should not report success when no provider responded.

## Scenario 11: The application is deployed to two servers.

**Good answer:** Move approval sessions and shared state to Redis or MongoDB, use a shared database and vector store, make tool actions idempotent, and route SSE through compatible load balancer settings.

## Scenario 12: The system should answer “I do not know” when evidence is missing.

**Good answer:** Prompt the model to answer only from retrieved context and clearly refuse unsupported requests. Add tests for missing or contradictory evidence.

## Scenario 13: An admin wants to change a user's token limit.

**Good answer:** Authenticate the administrator, authorize the operation, validate the user and limit, update the database atomically, audit the change, and return the resulting budget.

## Scenario 14: A user asks for the full extracted text of a PDF containing private data.

**Good answer:** Check ownership or sharing permission, avoid storing sensitive text unnecessarily, return only allowed sections, and apply document access policies.

## Scenario 15: The AI loops by repeatedly calling the weather tool.

**Good answer:** Cache the recent weather result, detect repeated calls, limit tool rounds, and force a final answer after enough information is available.

---

# 24. Quick “Tell Me Your Project” Answer

Use this answer for a one-minute interview:

> I built a step-by-step Agentic AI workspace. It starts with direct Gemini and Ollama API calls and progresses to an Express API, structured ticket analysis, SSE streaming, MongoDB conversation memory, JWT authentication, document uploads, and RAG using Ollama embeddings and ChromaDB.
>
> I also built Angular frontends for the knowledge-base platform and for AI agents. The agent backend registers tools for orders, products, weather, and DevOps. An agent loop lets Gemini or Ollama decide which tool to call, while the server executes tools with validation and records the process.
>
> The system also demonstrates human approval. Before risky actions such as restarting a service, the agent pauses and asks the user to approve or deny it. The final answer is shown through SSE events with status, tool activity, approval requests, and completion.
>
> The main gaps are that approvals are currently stored in memory, there is no complete monorepo or shared provider abstraction, and testing, Docker deployment, persistent audit logs, and RAG quality evaluation need improvement.

---

# 25. Final Summary Table

| Area | What the project demonstrates |
|---|---|
| AI APIs | Gemini and Ollama calls |
| Prompts | Roles, constraints, structured JSON |
| Backend | Express routes and middleware |
| Streaming | SSE response chunks |
| Database | MongoDB and Mongoose models |
| Authentication | JWT, bcrypt, roles |
| Usage | Token limits and cost metadata |
| Documents | Upload and PDF extraction |
| RAG | Chunking, embeddings, ChromaDB search |
| Tools | Central MCP-style registry and executor |
| Agents | Base, incident, and order agents |
| Approval | Human approval for sensitive actions |
| Frontend | Angular 18 chat and RAG UIs |
| Security | Validation, ownership, roles, rate limits |
| Reliability | Timeouts, SSE cleanup, error handling |
| Improvement | Unified architecture, tests, deployment, observability |
