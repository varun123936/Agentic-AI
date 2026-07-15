import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../../core/services/loader.service';

@Component({
  selector: 'app-global-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loaderService.isLoading()) {
      <div class="global-loader-bar">
        <div class="loader-progress"></div>
      </div>
    }
  `,
  styles: [`
    .global-loader-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      z-index: 9999;
      background: rgba(26, 86, 219, 0.15);
      overflow: hidden;
    }

    .loader-progress {
      height: 100%;
      background: linear-gradient(
        90deg,
        #1a56db,
        #7c3aed,
        #1a56db
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite ease-in-out;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `]
})
export class GlobalLoaderComponent {
  loaderService = inject(LoaderService);
}