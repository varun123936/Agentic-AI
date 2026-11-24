1. Explain the AI chatbot backend you developed using Node.js.
Answer:
I developed an AI-powered chat backend using Node.js, Express, MongoDB and Gemini API.

The application supports conversation management, streaming AI responses, message history and usage tracking.

We have separated the backend into three major layers.

First, the route layer handles incoming HTTP requests, validates user messages and manages SSE responses.

Second, the conversation service handles business logic, such as creating conversations, saving messages, retrieving chat history and tracking token usage in MongoDB.

Third, the AI integration service communicates with external AI providers. We currently support Gemini and Ollama through a common interface.

For streaming, we use the Gemini streaming API. As the AI generates response chunks, our Node.js backend reads them and immediately forwards them to the frontend using Server-Sent Events.

We also use AbortController to cancel ongoing requests when the client disconnects.

Once generation completes, we save the complete assistant response along with token usage, latency and estimated cost.

Additionally, we implemented conversation summarization using the AI model.


