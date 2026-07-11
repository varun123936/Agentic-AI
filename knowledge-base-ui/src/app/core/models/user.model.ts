// These interfaces match exactly what your Node.js backend returns
// Always define models — never use 'any' in production Angular code

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  dailyTokenLimit: number;
  tokensUsedToday: number;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface TokenBudget {
  used: number;
  limit: number;
  remaining: number;
}