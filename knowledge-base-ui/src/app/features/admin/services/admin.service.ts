import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/models/api-response.model';
import {
  AdminUser,
  AdminUsage,
  AdminStats,
  UpdateTokenLimitRequest,
  SystemHealth
} from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Get all users ─────────────────────────────────────────────
  getUsers(): Observable<ApiResponse<AdminUser[]>> {
    return this.http.get<ApiResponse<AdminUser[]>>(
      `${this.baseUrl}/admin/users`
    );
  }

  // ── Get usage analytics ───────────────────────────────────────
  getUsage(): Observable<ApiResponse<AdminUsage>> {
    return this.http.get<ApiResponse<AdminUsage>>(
      `${this.baseUrl}/admin/usage`
    );
  }

  // ── Get summary stats ─────────────────────────────────────────
  getStats(): Observable<ApiResponse<AdminStats>> {
    return this.http.get<ApiResponse<AdminStats>>(
      `${this.baseUrl}/admin/stats`
    );
  }

  // ── Update user token limit ───────────────────────────────────
  updateTokenLimit(
    userId: string,
    body: UpdateTokenLimitRequest
  ): Observable<ApiResponse<AdminUser>> {
    return this.http.patch<ApiResponse<AdminUser>>(
      `${this.baseUrl}/admin/users/${userId}/token-limit`,
      body
    );
  }

  // ── Check system health (frontend pings each service) ─────────
  async checkHealth(apiUrl: string): Promise<SystemHealth[]> {
    const results: SystemHealth[] = [];
    const token = localStorage.getItem('kb_token');

    // Check API server
    try {
      const start = Date.now();
      const res = await fetch(`${apiUrl.replace('/api', '')}/health`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const latencyMs = Date.now() - start;
      const data = await res.json();
      results.push({
        service: 'API Server',
        status: data.status === 'ok' ? 'ok' : 'error',
        detail: `Node.js + Express`,
        latencyMs
      });
    } catch {
      results.push({
        service: 'API Server',
        status: 'error',
        detail: 'Cannot reach backend'
      });
    }

    // Check MongoDB (via stats endpoint)
    try {
      const start = Date.now();
      await fetch(`${apiUrl}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      results.push({
        service: 'MongoDB',
        status: 'ok',
        detail: 'Connected',
        latencyMs: Date.now() - start
      });
    } catch {
      results.push({
        service: 'MongoDB',
        status: 'error',
        detail: 'Connection failed'
      });
    }

    // Check ChromaDB (via rag stats)
    try {
      const start = Date.now();
      const res = await fetch(`${apiUrl}/rag/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      results.push({
        service: 'Chroma Cloud',
        status: data.success ? 'ok' : 'error',
        detail: data.success
          ? `${data.data?.totalChunksInStore ?? 0} chunks stored`
          : 'Query failed',
        latencyMs: Date.now() - start
      });
    } catch {
      results.push({
        service: 'Chroma Cloud',
        status: 'error',
        detail: 'Cannot reach Chroma'
      });
    }

    // Check Ollama
    try {
      const start = Date.now();
      const res = await fetch('http://localhost:11434/api/tags');
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name);
      results.push({
        service: 'Ollama',
        status: 'ok',
        detail: models.length
          ? `Models: ${models.slice(0, 2).join(', ')}`
          : 'No models pulled',
        latencyMs: Date.now() - start
      });
    } catch {
      results.push({
        service: 'Ollama',
        status: 'error',
        detail: 'Not running — run: ollama serve'
      });
    }

    return results;
  }
}