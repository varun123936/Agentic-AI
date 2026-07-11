import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

// ── Auth Guard ────────────────────────────────────────────────
// Protects routes that require login
// Angular calls this before navigating to a protected route
// If it returns false — navigation is cancelled and user goes to /login

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  // Check both: has token AND token is not expired
  if (authService.isLoggedIn() && !tokenService.isTokenExpired()) {
    return true;
  }

  // Not logged in or token expired
  // Save the URL they were trying to reach — redirect after login
  tokenService.removeToken();
  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url }
  });
  return false;
};