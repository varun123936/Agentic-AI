import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// ── Error Interceptor ─────────────────────────────────────────
// Handles HTTP errors globally — no need to handle 401/403 in every service
//
// Most important for AI apps:
// - 401 Unauthorized: token expired → redirect to login
// - 429 Too Many Requests: rate limit hit → show friendly message
// - 503 Service Unavailable: AI provider down → handle gracefully

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {

      // ── 401: Token expired or invalid ──────────────────────
      if (error.status === 401) {
        const errorCode = error.error?.code;

        if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_TOKEN') {
          // Clear session and redirect to login
          // User will see login page with a message
          authService.clearSession();
          router.navigate(['/login'], {
            queryParams: { reason: 'session_expired' }
          });
        }
      }

      // ── 403: Not authorized (not admin) ────────────────────
      if (error.status === 403) {
        router.navigate(['/dashboard']);
      }

      // ── 429: Rate limit or token budget exceeded ────────────
      if (error.status === 429) {
        const errorCode = error.error?.code;
        if (errorCode === 'TOKEN_BUDGET_EXCEEDED') {
          console.warn('Daily AI token budget exceeded');
          // Components will handle this via the error in their subscribe
        }
      }

      // ── 503: AI service unavailable ────────────────────────
      if (error.status === 503) {
        console.warn('AI service temporarily unavailable');
        // Components handle this — show retry message
      }

      // Always re-throw so individual components can also handle errors
      return throwError(() => error);
    })
  );
};