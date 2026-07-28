import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProviderConfig, SseEvent } from '../models/agent.models';

@Injectable({ providedIn: 'root' })
export class AgentService {

  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getConfig(): Observable<ProviderConfig> {
    return this.http.get<ProviderConfig>(`${this.base}/config`);
  }

  switchProvider(provider: string): Observable<ProviderConfig> {
    return this.http.post<ProviderConfig>(`${this.base}/config/provider`, { provider });
  }

  getTools(): Observable<any> {
    return this.http.get(`${this.base}/agent/tools`);
  }

  // ── Generic SSE stream ────────────────────────────────────────
  // Uses native fetch — HttpClient cannot handle SSE streaming
  stream(
    endpoint: string,
    body: any,
    onEvent: (event: SseEvent) => void
  ): AbortController {
    const controller = new AbortController();

    fetch(`${this.base}${endpoint}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal
    }).then(async response => {
      if (!response.ok) {
        onEvent({ type: 'error', message: `HTTP ${response.status}` });
        return;
      }

      const reader  = response.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const s = line.slice(6).trim();
          if (!s) continue;
          try { onEvent(JSON.parse(s)); } catch { /* skip malformed */ }
        }
      }
    }).catch(err => {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', message: err.message });
      }
    });

    return controller;
  }

  // ── Shorthand stream helpers ──────────────────────────────────
  streamChat(message: string, history: any[], onEvent: (e: SseEvent) => void) {
    return this.stream('/agent/stream', { message, history }, onEvent);
  }

  streamInvestigate(message: string, onEvent: (e: SseEvent) => void) {
    return this.stream('/incident/investigate', { message }, onEvent);
  }

  streamOrder(message: string, onEvent: (e: SseEvent) => void) {
    return this.stream('/incident/order', { message }, onEvent);
  }

  streamApprove(sessionId: string, approved: boolean, feedback: string, onEvent: (e: SseEvent) => void) {
    return this.stream('/incident/approve', { sessionId, approved, feedback }, onEvent);
  }
}