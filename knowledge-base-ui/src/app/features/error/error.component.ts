import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }   from '@angular/material/icon';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule
  ],
  template: `
    <div class="error-page">
      <div class="error-card">
        <div class="error-icon-wrap">
          <mat-icon class="error-icon">error_outline</mat-icon>
        </div>
        <h1>Something went wrong</h1>
        <p>
          An unexpected error occurred.
          Please try refreshing the page.
        </p>
        <div class="error-actions">
          <button
            mat-raised-button
            color="primary"
            onclick="window.location.reload()"
          >
            <mat-icon>refresh</mat-icon>
            Refresh Page
          </button>
          <button
            mat-stroked-button
            routerLink="/dashboard"
          >
            <mat-icon>home</mat-icon>
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .error-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fef2f2;
      padding: 24px;
    }
    .error-card {
      background: #fff;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 460px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(220,38,38,0.1);
    }
    .error-icon-wrap {
      width: 72px;
      height: 72px;
      background: #fef2f2;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .error-icon {
      font-size: 36px;
      height: 36px;
      width: 36px;
      color: #dc2626;
    }
    h1 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #111827;
      margin: 0 0 10px 0;
    }
    p {
      color: #6b7280;
      font-size: 0.9rem;
      margin: 0 0 28px 0;
    }
    .error-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .error-actions button mat-icon {
      font-size: 18px;
      height: 18px;
      width: 18px;
      margin-right: 4px;
    }
  `]
})
export class ErrorComponent {}