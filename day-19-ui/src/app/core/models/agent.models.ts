export interface Message {
  role:    'user' | 'assistant' | 'status' | 'error';
  content: string;
  id:      string;
}

export interface ToolLog {
  id:      string;
  name:    string;
  status:  'running' | 'done' | 'error';
  ts:      Date;
}

export interface SseEvent {
  type:         string;
  content?:     string;
  message?:     string;
  answer?:      string;
  toolName?:    string;
  toolArgs?:    any;
  sessionId?:   string;
  latencyMs?:   number;
  toolCallCount?:number;
  executionLog?: any[];
  tokens?:      { input:number; output:number };
  provider?:    string;
  model?:       string;
  chunksFound?: number;
}

export interface ApprovalState {
  sessionId:   string;
  toolName:    string;
  toolArgs:    any;
  message:     string;
  executionLog?: any[];
}

export interface ProviderConfig {
  provider: string;
  model:    string;
  tools:    string[];
}