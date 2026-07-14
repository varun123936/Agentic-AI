export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  isActive: boolean;
  dailyTokenLimit: number;
  tokensUsedToday: number;
  lastLoginAt?: string;
  createdAt: string;
}

export interface UsageByProvider {
  _id: string;              // provider name
  totalTokens: number;
  totalCostUsd: number;
  requestCount: number;
}

export interface DailyTrend {
  _id: string;              // date string YYYY-MM-DD
  totalTokens: number;
  totalCostUsd: number;
  requests: number;
}

export interface AdminUsage {
  byProvider: UsageByProvider[];
  dailyTrend: DailyTrend[];
}

export interface AdminStats {
  totalUsers: number;
  totalConversations: number;
  totalTokens: number;
  totalCostUsd: number;
  totalRequests: number;
}

export interface UpdateTokenLimitRequest {
  dailyTokenLimit: number;
}

export interface SystemHealth {
  service: string;
  status: 'ok' | 'error' | 'checking';
  detail: string;
  latencyMs?: number;
}