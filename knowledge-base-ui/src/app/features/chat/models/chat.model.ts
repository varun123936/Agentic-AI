export interface Conversation {
  _id: string;
  title: string;
  messageCount: number;
  totalTokensUsed: number;
  lastMessageAt: string;
  createdAt: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  aiMeta?: {
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  };
}

// Used only in the component — not from API
// Tracks the streaming state of the current AI response
export interface StreamingState {
  isStreaming: boolean;
  currentText: string;
  error: string;
}

export interface DoneEvent {
  type: 'done';
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  latencyMs: number;
}