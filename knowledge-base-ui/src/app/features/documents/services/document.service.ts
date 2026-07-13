import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpEventType,
  HttpRequest
} from '@angular/common/http';
import { Observable, map, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import {
  Document,
  UploadResponse,
  IndexResult
} from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Upload with progress ──────────────────────────────────────
  uploadFile(file: File): Observable<{
    progress: number;
    result?: UploadResponse;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const req = new HttpRequest(
      'POST',
      `${this.baseUrl}/documents/upload`,
      formData,
      { reportProgress: true }
    );

    return this.http.request(req).pipe(
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total
            ? Math.round(100 * event.loaded / event.total)
            : 0;
          return { progress };
        }
        if (event.type === HttpEventType.Response) {
          const body = event.body as ApiResponse<UploadResponse>;
          return { progress: 100, result: body.data };
        }
        return { progress: 0 };
      }),
      catchError(err => throwError(() => err))
    );
  }

  // ── Get documents ─────────────────────────────────────────────
  getDocuments(): Observable<ApiResponse<Document[]>> {
    return this.http.get<ApiResponse<Document[]>>(
      `${this.baseUrl}/documents`
    );
  }

  // ── Index into RAG ────────────────────────────────────────────
  indexDocument(documentId: string): Observable<ApiResponse<IndexResult>> {
    return this.http.post<ApiResponse<IndexResult>>(
      `${this.baseUrl}/rag/index/${documentId}`,
      {}
    );
  }

  // ── Delete document ───────────────────────────────────────────
  // FIXED: now correctly uses _id
  deleteDocument(documentId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.baseUrl}/documents/${documentId}`
    );
  }

  // ── Summarize (streaming) ─────────────────────────────────────
  summarizeDocument(
    documentId: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: string) => void
  ): AbortController {
    const controller = new AbortController();
    const token = localStorage.getItem('kb_token');

    fetch(`${this.baseUrl}/documents/${documentId}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    }).then(async response => {
      if (!response.ok) {
        const err = await response.json();
        onError(err.error || 'Summarize failed');
        return;
      }
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.replace('data: ', '').trim();
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'chunk') onChunk(parsed.content);
            if (parsed.type === 'done')  onDone();
            if (parsed.type === 'error') onError(parsed.message);
          } catch { /* skip partial */ }
        }
      }
    }).catch(err => {
      if (err.name !== 'AbortError') onError(err.message);
    });

    return controller;
  }

  // ── Helpers ───────────────────────────────────────────────────
  formatFileSize(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getFileSeverity(mimeType: string): 'danger' | 'secondary' | 'info' {
    if (mimeType === 'application/pdf') return 'danger';
    if (mimeType === 'text/plain')      return 'secondary';
    return 'info';
  }

  getFileIcon(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'pi pi-file-pdf';
    if (mimeType === 'text/plain')      return 'pi pi-file';
    return 'pi pi-code';
  }
}