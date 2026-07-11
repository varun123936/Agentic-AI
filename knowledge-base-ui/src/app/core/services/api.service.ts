import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';

// ── API Service ───────────────────────────────────────────────
// Central place for all HTTP calls to your Node.js backend
// Auth header is added automatically by authInterceptor
// Error handling is done automatically by errorInterceptor

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Generic GET ───────────────────────────────────────────
  get<T>(endpoint: string, params?: Record<string, string>): Observable<ApiResponse<T>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        httpParams = httpParams.set(key, value);
      });
    }
    return this.http.get<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`,
      { params: httpParams }
    );
  }

  // ── Generic POST ──────────────────────────────────────────
  post<T>(endpoint: string, body: any): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`,
      body
    );
  }

  // ── Generic PATCH ─────────────────────────────────────────
  patch<T>(endpoint: string, body: any): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`,
      body
    );
  }

  // ── Generic DELETE ────────────────────────────────────────
  delete<T>(endpoint: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`
    );
  }

  // ── File upload ───────────────────────────────────────────
  // Uses FormData — different content type than JSON
  upload<T>(endpoint: string, formData: FormData): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(
      `${this.baseUrl}${endpoint}`,
      formData
      // Don't set Content-Type header — browser sets it automatically
      // with the correct multipart boundary for file uploads
    );
  }

  // ── SSE Streaming ─────────────────────────────────────────
  // HttpClient cannot handle SSE — we use the native fetch API for streaming
  // Returns a function you call to start the stream
  stream(endpoint: string, body: any): {
    start: (
      onChunk: (text: string) => void,
      onDone: (meta: any) => void,
      onError: (err: string) => void
    ) => AbortController
  } {
    return {
      start: (onChunk, onDone, onError) => {
        const controller = new AbortController();
        const token = localStorage.getItem('kb_token');

        fetch(`${this.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body),
          signal: controller.signal
        }).then(async response => {
          if (!response.ok) {
            const errData = await response.json();
            onError(errData.error || 'Request failed');
            return;
          }

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.replace('data: ', '').trim();
              if (!jsonStr) continue;

              try {
                const parsed = JSON.parse(jsonStr);

                if (parsed.type === 'chunk') {
                  onChunk(parsed.content);
                }
                if (parsed.type === 'done') {
                  onDone(parsed);
                }
                if (parsed.type === 'error') {
                  onError(parsed.message);
                }
              } catch {
                // Partial JSON — skip
              }
            }
          }
        }).catch(err => {
          if (err.name !== 'AbortError') {
            onError(err.message);
          }
        });

        return controller;
      }
    };
  }
}