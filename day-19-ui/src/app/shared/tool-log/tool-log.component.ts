import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolLog } from '../../core/models/agent.models';

@Component({
  selector: 'app-tool-log',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tool-log-wrap">
      @if (logs().length === 0) {
        <div class="tool-log-empty">
          <i class="bi bi-wrench"></i>
          Tool calls will appear here
        </div>
      }
      @for (log of logs(); track log.id) {
        <div class="tool-log-item" [class]="'tl-' + log.status">
          @if (log.status === 'running') {
            <i class="bi bi-arrow-repeat spin text-warning"></i>
          }
          @if (log.status === 'done') {
            <i class="bi bi-check-circle-fill text-success"></i>
          }
          @if (log.status === 'error') {
            <i class="bi bi-x-circle-fill text-danger"></i>
          }
          <span class="tool-name">{{ log.name | titlecase }}</span>
          <span class="tool-time ms-auto text-muted">
            {{ log.ts | date:'HH:mm:ss' }}
          </span>
        </div>
      }
    </div>
  `,
  styles: [`
    .tool-log-wrap { display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto; }
    .tool-log-empty { color:#9ca3af; font-size:.78rem; text-align:center; padding:16px; display:flex; align-items:center; justify-content:center; gap:6px; }
    .tool-log-item { display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:8px; font-size:.78rem; border:1px solid; }
    .tl-running { background:#fffbeb; border-color:#fde68a; }
    .tl-done    { background:#f0fdf4; border-color:#bbf7d0; }
    .tl-error   { background:#fef2f2; border-color:#fecaca; }
    .tool-name  { font-weight:600; color:#374151; }
    .tool-time  { font-size:.7rem; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ToolLogComponent {
  @Input() logs = signal<ToolLog[]>([]);
}