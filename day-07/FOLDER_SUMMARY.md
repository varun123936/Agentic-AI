# Day-07 Folder Summary

## Concept
Day-07 extends authenticated chat with document knowledge. Users upload PDF or text files, the server extracts text, stores document metadata in MongoDB, and places relevant document content into the AI prompt for single-document or multi-document answers.

## Real-world example
A legal or customer-support team can ask questions about internal manuals, policies, contracts, or reports. The AI answers from the organization's uploaded documents rather than relying only on general model knowledge.

## Architecture
```mermaid
flowchart LR
    Client[Client] --> Auth[JWT middleware]
    Auth --> Upload[Document route]
    Upload --> Multer[File upload middleware]
    Multer --> Extract[PDF or text extraction]
    Extract --> Mongo[(MongoDB document record)]
    Client --> Query[Document Q&A request]
    Query --> Service[Document service]
    Mongo --> Service
    Service --> Prompt[Document-aware prompt]
    Prompt --> AI[Gemini or Ollama]
    AI -->|SSE| Client
```

**Components:**
- `src/middleware/upload.middleware.js`: Validates and stores uploaded files.
- `src/models/document.model.js`: Stores ownership, metadata, extracted text, and status.
- `src/services/document.service.js`: Extracts text and builds document-aware prompts.
- `src/routes/document.routes.js`: Upload, list, delete, summarize, and query endpoints.
- Existing chat, authentication, model, usage, and streaming components remain in place.

**Communication:** Multer writes the file to disk, the document service extracts text and saves metadata, and later document queries load authorized document content into the prompt. The AI response is streamed back to the client. This is a document-grounded pattern, before introduction of vector search.
