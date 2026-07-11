import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenService } from '../services/token.service';

// ── Auth Interceptor ──────────────────────────────────────────
// This runs for EVERY HTTP request made by Angular's HttpClient
// It automatically adds the JWT token to the Authorization header
//
// Without this: every service would need to manually add the header
// With this: you never think about it again

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const tokenService = inject(TokenService);
  const token = tokenService.getToken();

  // If we have a token, clone the request and add the header
  // Why clone? HttpRequest objects are immutable in Angular
  if (token) {
    const authRequest = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authRequest);
  }

  // No token — send request as-is (for login/register endpoints)
  return next(req);
};