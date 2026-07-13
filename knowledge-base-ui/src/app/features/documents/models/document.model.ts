// ── THE BUG FIX ───────────────────────────────────────────────
// MongoDB returns _id not id
// All previous code used doc.id — caused undefined on delete

export interface Document {
  _id: string;       // ← FIXED: was 'id', MongoDB sends '_id'
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number | null;
  wordCount: number | null;
  estimatedTokenCount: number | null;
  queryCount: number;
  extractionStatus: 'pending' | 'processing' | 'done' | 'failed';
  isIndexed?: boolean;
  createdAt: string;
}

export interface UploadResponse {
  _id: string;       // ← FIXED
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  pageCount: number | null;
  wordCount: number | null;
  estimatedTokenCount: number | null;
  createdAt: string;
}

export interface IndexResult {
  documentId: string;
  documentName: string;
  chunksCreated: number;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

export interface UploadItem {
  file: File;
  uid: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage: string;
  result?: UploadResponse;
}