import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';
import {
  User,
  AuthResponse,
  LoginRequest,
  RegisterRequest
} from '../models/user.model';
import { ApiResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = environment.apiUrl;

  // ── Signals — Angular's modern state management ──────────────
  // Signals automatically update any component that reads them
  // Think of them like BehaviorSubject but simpler

  private _currentUser = signal<User | null>(null);
  private _isLoading = signal<boolean>(false);

  // Public readonly computed values
  // Components read these — can't write to them directly
  currentUser = this._currentUser.asReadonly();
  isLoading = this._isLoading.asReadonly();

  // computed() = automatically recalculates when _currentUser changes
  isLoggedIn = computed(() => !!this._currentUser());
  isAdmin = computed(() => this._currentUser()?.role === 'admin');

  constructor(
    private http: HttpClient,
    private tokenService: TokenService,
    private router: Router
  ) {
    // On app startup, restore user from localStorage if token exists
    this.restoreSession();
  }

  // ── Restore session from localStorage ────────────────────────
  // This runs when the user refreshes the page — they stay logged in
  private restoreSession(): void {
    if (this.tokenService.hasToken() && !this.tokenService.isTokenExpired()) {
      const savedUser = this.tokenService.getUser();
      if (savedUser) {
        this._currentUser.set(savedUser);
      }
    } else {
      // Token expired — clear everything
      this.tokenService.removeToken();
    }
  }

  // ── Login ─────────────────────────────────────────────────────
  login(credentials: LoginRequest): Observable<AuthResponse> {
    this._isLoading.set(true);

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/auth/login`,
      credentials
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Save token and user to localStorage
          this.tokenService.setToken(response.data.token);
          this.tokenService.setUser(response.data.user);

          // Update the signal — all components that read currentUser update
          this._currentUser.set(response.data.user);

          this._isLoading.set(false);
        }
      }),
      catchError(error => {
        this._isLoading.set(false);
        return throwError(() => error);
      })
    );
  }

  // ── Register ──────────────────────────────────────────────────
  register(userData: RegisterRequest): Observable<AuthResponse> {
    this._isLoading.set(true);

    return this.http.post<AuthResponse>(
      `${this.apiUrl}/auth/register`,
      userData
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.tokenService.setToken(response.data.token);
          this.tokenService.setUser(response.data.user);
          this._currentUser.set(response.data.user);
          this._isLoading.set(false);
        }
      }),
      catchError(error => {
        this._isLoading.set(false);
        return throwError(() => error);
      })
    );
  }

  // ── Logout ────────────────────────────────────────────────────
  logout(): void {
    // Call backend logout endpoint (optional — JWT is stateless)
    this.http.post(`${this.apiUrl}/auth/logout`, {}).subscribe({
      complete: () => this.clearSession()
    });
  }

  // ── Clear local session ───────────────────────────────────────
  clearSession(): void {
    this.tokenService.removeToken();
    this._currentUser.set(null);
    this.router.navigate(['/login']);
  }

  // ── Refresh current user from backend ────────────────────────
  // Call this after updating token budget or profile
  refreshUser(): Observable<ApiResponse<User>> {
    return this.http.get<ApiResponse<User>>(
      `${this.apiUrl}/auth/me`
    ).pipe(
      tap(response => {
        if (response.success && response.data) {
          this._currentUser.set(response.data);
          this.tokenService.setUser(response.data);
        }
      })
    );
  }
}