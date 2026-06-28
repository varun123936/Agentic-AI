# Day-02: AI Model Exploration & Prompt Building

## Table of Contents

1. [Project Overview](#project-overview)
2. [What Changed From Day-01](#what-changed-from-day-01)
3. [Core Components](#core-components)
4. [Project Structure](#project-structure)
5. [Environment Setup](#environment-setup)
6. [Key Concepts Learned](#key-concepts-learned)
7. [Running the Tests](#running-the-tests)
8. [Summary](#summary)

---

## Project Overview

Day-02 is the foundation phase of the AI course. The goal is to move from "using AI through a web browser" to "interacting with AI via code." It focuses on the basic mechanics of calling LLM (Large Language Model) APIs and the art of **Prompt Engineering**.

### Goals of Day-02
- Establish connectivity with cloud-based (Gemini) and local (Ollama) AI models.
- Understand the difference between System Prompts and User Prompts.
- Learn how to structure a "Prompt Builder" to create consistent AI requests.
- Compare the response quality and latency of different providers.

---

## What Changed From Day-01

While Day-01 was likely an introduction to the concept of Agentic AI and LLMs, Day-02 introduces **implementation**:

- **Conceptual $\rightarrow$ Practical**: First time writing JavaScript code to call an AI.
- **Web UI $\rightarrow$ API**: Moving from chat.google.com to the Google Generative AI SDK.
- **Manual $\rightarrow$ Automated**: Building a `prompt-builder.js` to automate the creation of complex prompts instead of typing them manually.

---

## Core Components

### 1. Gemini Integration (`gemini-test.js`)
A standalone script to test the Google Gemini API.
- **Mechanism**: Uses the `@google/generative-ai` SDK.
- **Key Step**: Configuring the API key and selecting a model (e.g., `gemini-1.5-flash`).
- **Observation**: High speed, cloud-hosted, requires an internet connection.

### 2. Ollama Integration (`ollama-test.js`)
A standalone script to test locally hosted AI.
- **Mechanism**: Sends HTTP requests to the local Ollama server (`http://localhost:11434`).
- **Key Step**: Ensuring the Ollama app is running and the model (e.g., `llama3`) is pulled.
- **Observation**: Complete privacy, runs offline, speed depends on local hardware (GPU/RAM).

### 3. The Prompt Builder (`prompt-builder.js`)
The most important architectural piece of Day-02. Instead of sending a simple string, the prompt builder allows for:
- **System Role**: Defining *who* the AI is (e.g., "You are a senior software engineer").
- **Constraints**: Defining *how* the AI should respond (e.g., "Keep it under 50 words", "Use bullet points").
- **User Input**: Inserting the actual query into a pre-defined template.

**Example Logic:**
`Final Prompt = [System Role] + [Constraints] + [User Query]`

---

## Project Structure

```text
day-02/
├── gemini-test.js      # Script to test Google Gemini API
├── ollama-test.js      # Script to test Local Ollama API
├── prompt-builder.js   # Logic for constructing professional prompts
└── package.json        # Project dependencies
```

---

## Environment Setup

To run the scripts in Day-02, the following are required:

1. **Node.js** installed.
2. **Gemini API Key**: Obtained from Google AI Studio.
3. **Ollama Installed**: Downloaded and running from ollama.com.
4. **`.env` File**:
   ```env
   GEMINI_API_KEY=your_actual_api_key
   AI_PROVIDER=gemini # or ollama
   ```

---

## Key Concepts Learned

### 1. Prompt Engineering
Learning that the quality of the AI's output is directly proportional to the quality of the input.
- **Bad Prompt**: "Write a story about a cat."
- **Good Prompt**: "You are a professional children's author. Write a 200-word whimsical story about a cat who discovers a secret portal in a library. Use a gentle tone and end with a moral lesson."

### 2. API vs. Local Inference
| Feature | Gemini (Cloud) | Ollama (Local) |
| --- | --- | --- |
| **Setup** | Easy (API Key) | Medium (Install App) |
| **Privacy** | Data sent to Google | Data stays on machine |
| **Cost** | Free/Paid Tiers | Free (uses your electricity) |
| **Hardware** | Google's TPU/GPU | Your CPU/GPU |

### 3. The "System Prompt"
Understanding that the system prompt sets the "behavioral guardrails" for the AI, while the user prompt provides the "task".

---

## Running the Tests

### Testing Gemini:
```bash
node gemini-test.js
```

### Testing Ollama:
```bash
node ollama-test.js
```

---

## Summary

Day-02 is about **Experimentation**. By building the `prompt-builder.js` and testing both cloud and local models, the foundation is laid for the more complex systems in Day-03 (Structured Data), Day-04 (Streaming), and Day-05 (Conversations).
