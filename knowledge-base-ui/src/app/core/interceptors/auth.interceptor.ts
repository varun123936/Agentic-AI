import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenService } from '../services/token.service';
import { LoaderService } from '../services/loader.service';
import { finalize } from 'rxjs';

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
  const loaderService = inject(LoaderService);
  const token = tokenService.getToken();

  // Skip loader for streaming endpoints
  // — they manage their own loading state
  const isStreamingRequest =
    req.url.includes('/stream') ||
    req.url.includes('/summarize') ||
    req.url.includes('/rag/chat');

  if (!isStreamingRequest) {
    loaderService.show();
  }

  // If we have a token, clone the request and add the header
  // Why clone? HttpRequest objects are immutable in Angular
  const authRequest = token
    ? req.clone({
      headers: req.headers.set(
        'Authorization', `Bearer ${token}`
      )
    })
    : req;

  return next(authRequest).pipe(
    finalize(() => {
      if (!isStreamingRequest) {
        loaderService.hide();
      }
    })
  );
};