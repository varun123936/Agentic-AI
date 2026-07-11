import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="d-flex align-items-center justify-content-center gap-2"
         [class]="containerClass">

      <!-- Bootstrap spinner — type changes based on size -->
      <div
        role="status"
        [class]="spinnerClass"
        [style.color]="color"
      >
        <span class="visually-hidden">Loading...</span>
      </div>

      <!-- Optional message next to spinner -->
      @if (message) {
        <span class="text-muted" [class]="textClass">
          {{ message }}
        </span>
      }

    </div>
  `
})
export class LoadingSpinnerComponent {

  // ── Inputs ─────────────────────────────────────────────────
  @Input() message: string = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() color: string = '#0d6efd';      // Bootstrap primary blue default
  @Input() type: 'border' | 'grow' = 'border';  // border = spinning ring, grow = pulsing dot
  @Input() centered: boolean = true;       // centers with py padding
  @Input() overlay: boolean = false;       // full screen overlay mode

  // ── Computed classes ────────────────────────────────────────
  get spinnerClass(): string {
    // Bootstrap spinner sizes:
    // spinner-border-sm = small
    // spinner-border    = default (medium)
    // No built-in lg — we use inline style for large
    const base = `spinner-${this.type}`;
    if (this.size === 'sm') return `${base} spinner-${this.type}-sm`;
    return base;
  }

  get containerClass(): string {
    const classes: string[] = [];
    if (this.centered) classes.push('py-4');
    if (this.overlay) classes.push('position-fixed top-0 start-0 w-100 h-100 bg-white bg-opacity-75');
    return classes.join(' ');
  }

  get textClass(): string {
    const sizes = {
      sm: 'small',
      md: '',
      lg: 'fs-5'
    };
    return sizes[this.size];
  }
}