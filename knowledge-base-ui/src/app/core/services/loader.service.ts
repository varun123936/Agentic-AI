import { Injectable, signal } from '@angular/core';

// Global loading state service
// Any component can show/hide the top progress bar

@Injectable({ providedIn: 'root' })
export class LoaderService {

  // Signal — true when any HTTP call is in progress
  isLoading = signal<boolean>(false);

  private activeRequests = 0;

  show(): void {
    this.activeRequests++;
    this.isLoading.set(true);
  }

  hide(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests === 0) {
      this.isLoading.set(false);
    }
  }
}