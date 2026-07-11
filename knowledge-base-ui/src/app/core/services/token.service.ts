import { Injectable } from '@angular/core';

// TokenService has ONE job: manage the JWT token in localStorage
// Keeping it separate means you can swap storage mechanism
// (localStorage → httpOnly cookies) without touching AuthService

const TOKEN_KEY = 'kb_token';
const USER_KEY = 'kb_user';

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  // ── Save token ──────────────────────────────────────────────
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  // ── Get token ───────────────────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  // ── Remove token (on logout) ────────────────────────────────
  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ── Check if token exists ───────────────────────────────────
  hasToken(): boolean {
    return !!this.getToken();
  }

  // ── Check if token is expired ────────────────────────────────
  // JWT payload is base64 encoded — decode and check exp field
  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      // JWT = header.payload.signature
      // Split on '.' and take the middle part (payload)
      const payload = token.split('.')[1];

      // Payload is base64 encoded — decode it to JSON
      const decoded = JSON.parse(atob(payload));

      // exp is a Unix timestamp in seconds
      // Date.now() is in milliseconds — divide by 1000
      const currentTime = Date.now() / 1000;

      return decoded.exp < currentTime;

    } catch {
      // If we can't decode it, treat as expired
      return true;
    }
  }

  // ── Save user to localStorage ────────────────────────────────
  setUser(user: any): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  // ── Get user from localStorage ───────────────────────────────
  getUser(): any | null {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  }
}