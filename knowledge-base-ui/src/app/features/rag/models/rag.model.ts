export interface SearchChunk {
  id: string;
  text: string;
  similarityScore: number;
  metadata: {
    documentId: string;
    documentName: string;
    chunkIndex: number;
    wordCount: number;
  };
}

export interface SearchResult {
  query: string;
  resultsFound: number;
  chunks: {
    text: string;
    similarityScore: number;
    documentName: string;
    documentId: string;
  }[];
}

export interface RagStats {
  totalChunksInStore: number;
  yourChunks: number;
  embeddingProvider: string;
}

export interface Source {
  documentName: string;
  documentId: string;
  similarityScore: number;
}

export interface StreamEvent {
  type: 'status' | 'context_found' | 'chunk' | 'done' | 'error' | 'warning';
  message?: string;
  content?: string;
  chunksFound?: number;
  sources?: Source[];
  tokens?: { input: number; output: number };
  latencyMs?: number;
  chunksUsed?: number;
}

// Filter option for document dropdown
export interface DocumentOption {
  label: string;
  value: string | null;
}