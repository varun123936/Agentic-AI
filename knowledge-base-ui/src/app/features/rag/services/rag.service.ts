import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import {
  SearchResult,
  RagStats,
  Source
} from '../models/rag.model';

@Injectable({ providedIn: 'root' })
export class RagService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Pure vector search — returns chunks, no AI ────────────────
  search(
    query: string,
    documentId?: string | null,
    topK: number = 5
  ): Observable<ApiResponse<SearchResult>> {
    const body: any = { query, topK };
    if (documentId) body['documentId'] = documentId;

    return this.http.post<ApiResponse<SearchResult>>(
      `${this.baseUrl}/rag/search`,
      body
    );
  }

  // ── RAG chat — search + stream AI answer ─────────────────────
  ragChat(
    question: string,
    documentId: string | null,
    onStatus:  (msg: string) => void,
    onContext: (count: number, sources: Source[]) => void,
    onChunk:   (text: string) => void,
    onDone:    (meta: any) => void,
    onError:   (err: string) => void
  ): AbortController {
    const controller = new AbortController();
    const token = localStorage.getItem('kb_token');

    const body: any = { question };
    if (documentId) body['documentId'] = documentId;

    fetch(`${this.baseUrl}/rag/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(async response => {
      if (!response.ok) {
        const err = await response.json();
        onError(err.error || 'RAG chat failed');
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

            if (parsed.type === 'status') {
              onStatus(parsed.message || '');
            }
            if (parsed.type === 'context_found') {
              onContext(parsed.chunksFound || 0, parsed.sources || []);
            }
            if (parsed.type === 'chunk') {
              onChunk(parsed.content || '');
            }
            if (parsed.type === 'done') {
              onDone(parsed);
            }
            if (parsed.type === 'error') {
              onError(parsed.message || 'Unknown error');
            }
          } catch { /* skip partial */ }
        }
      }
    }).catch(err => {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Connection failed');
      }
    });

    return controller;
  }

  // ── RAG stats ─────────────────────────────────────────────────
  getStats(): Observable<ApiResponse<RagStats>> {
    return this.http.get<ApiResponse<RagStats>>(
      `${this.baseUrl}/rag/stats`
    );
  }
}