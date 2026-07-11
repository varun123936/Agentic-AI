import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

// ── Admin Guard ───────────────────────────────────────────────
// Used in addition to authGuard for admin-only routes
// Always use both: [authGuard, adminGuard]

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  // Logged in but not admin — send to dashboard
  router.navigate(['/dashboard']);
  return false;
};