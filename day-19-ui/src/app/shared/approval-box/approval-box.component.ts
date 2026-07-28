import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApprovalState } from '../../core/models/agent.models';

@Component({
  selector: 'app-approval-box',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (state) {
      <div class="approval-wrap">
        <div class="approval-header">
          <i class="bi bi-shield-exclamation text-warning"></i>
          <strong>Action Requires Your Approval</strong>
        </div>

        <p class="approval-msg">{{ state.message }}</p>

        <div class="approval-detail">
          <small class="text-muted">Tool: <strong>{{ state.toolName }}</strong></small>
          <pre class="approval-args">{{ state.toolArgs | json }}</pre>
        </div>

        <input
          [(ngModel)]="feedback"
          type="text"
          class="form-control form-control-sm mb-3"
          placeholder="Optional: reason or feedback for audit log..."
        />

        <div class="approval-btns">
          <button class="btn btn-success btn-sm" (click)="onApprove()" [disabled]="busy">
            @if (busy) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            } @else {
              <i class="bi bi-check-lg me-1"></i>
            }
            Approve
          </button>
          <button class="btn btn-danger btn-sm" (click)="onDeny()" [disabled]="busy">
            <i class="bi bi-x-lg me-1"></i>Deny
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .approval-wrap { background:linear-gradient(135deg,#fffbeb,#fef3c7); border:2px solid #f59e0b; border-radius:12px; padding:16px; margin-top:12px; }
    .approval-header { display:flex; align-items:center; gap:8px; font-size:.95rem; color:#92400e; margin-bottom:8px; }
    .approval-msg { color:#78350f; font-size:.85rem; margin-bottom:10px; }
    .approval-detail { background:#fff; border-radius:8px; padding:10px; margin-bottom:10px; }
    .approval-args { font-size:.72rem; color:#6b7280; margin:4px 0 0 0; max-height:80px; overflow-y:auto; white-space:pre-wrap; }
    .approval-btns { display:flex; gap:8px; }
  `]
})
export class ApprovalBoxComponent {
  @Input() state: ApprovalState | null = null;
  @Output() approve = new EventEmitter<{ approved: boolean; feedback: string }>();

  feedback = '';
  busy     = false;

  onApprove(): void {
    this.busy = true;
    this.approve.emit({ approved: true, feedback: this.feedback });
  }

  onDeny(): void {
    this.busy = true;
    this.approve.emit({ approved: false, feedback: this.feedback });
  }

  reset(): void {
    this.busy = false;
    this.feedback = '';
  }
}
