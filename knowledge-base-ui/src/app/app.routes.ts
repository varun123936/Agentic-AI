import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  // Default redirect
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },

  // Public routes — no guard
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component')
        .then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component')
        .then(m => m.RegisterComponent)
  },

  // Protected routes — authGuard required
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component')
        .then(m => m.DashboardComponent)
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/chat/chat.component')
        .then(m => m.ChatComponent)
  },
  {
    path: 'documents',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/documents/documents.component')
        .then(m => m.DocumentsComponent)
  },
  {
    path: 'rag',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/rag/rag.component')
        .then(m => m.RagComponent)
  },
  {
  path: 'conversations',
  canActivate: [authGuard],
  loadComponent: () =>
    import('./features/conversations/conversations.component')
      .then(m => m.ConversationsComponent)
  },

  // Admin only routes — both guards required
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/admin.component')
        .then(m => m.AdminComponent)
  },

  // 404
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found/not-found.component')
        .then(m => m.NotFoundComponent)
  }
];