import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import { Conversation, Message } from '../models/chat.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Create a new conversation ────────────────────────────────
  createConversation(): Observable<ApiResponse<Conversation>> {
    return this.http.post<ApiResponse<Conversation>>(
      `${this.baseUrl}/chat/conversations`,
      {}
    );
  }

  // ── Get all conversations for current user ───────────────────
  getConversations(): Observable<ApiResponse<Conversation[]>> {
    return this.http.get<ApiResponse<Conversation[]>>(
      `${this.baseUrl}/chat/conversations`
    );
  }

  // ── Get messages for a conversation ─────────────────────────
  getMessages(conversationId: string): Observable<ApiResponse<Message[]>> {
    return this.http.get<ApiResponse<Message[]>>(
      `${this.baseUrl}/chat/conversations/${conversationId}/messages`
    );
  }

  // ── Stream a message ─────────────────────────────────────────
  // Returns AbortController so caller can cancel the stream
  streamMessage(
    conversationId: string,
    message: string,
    onChunk: (text: string) => void,
    onDone: (meta: any) => void,
    onError: (err: string) => void
  ): AbortController {
    const controller = new AbortController();
    const token = localStorage.getItem('kb_token');

    fetch(
      `${this.baseUrl}/chat/conversations/${conversationId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message }),
        signal: controller.signal
      }
    ).then(async response => {
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
            // Skip partial JSON chunks
          }
        }
      }

    }).catch(err => {
      // AbortError is normal — user navigated away or sent new message
      if (err.name !== 'AbortError') {
        onError(err.message || 'Connection failed');
      }
    });

    return controller;
  }
}