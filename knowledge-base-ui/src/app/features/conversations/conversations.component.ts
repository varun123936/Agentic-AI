import {
  Component,
  OnInit,
  signal,
  inject,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

// Angular Material
import { MatCardModule }       from '@angular/material/card';
import { MatButtonModule }     from '@angular/material/button';
import { MatIconModule }       from '@angular/material/icon';
import { MatToolbarModule }    from '@angular/material/toolbar';
import { MatFormFieldModule }  from '@angular/material/form-field';
import { MatInputModule }      from '@angular/material/input';
import { MatDividerModule }    from '@angular/material/divider';
import { MatTooltipModule }    from '@angular/material/tooltip';

// PrimeNG
import { TableModule }      from 'primeng/table';
import { ButtonModule }     from 'primeng/button';
import { TagModule }        from 'primeng/tag';
import { SkeletonModule }   from 'primeng/skeleton';
import { TooltipModule }    from 'primeng/tooltip';
import { ToastModule }      from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import {
  MessageService,
  ConfirmationService
} from 'primeng/api';

// Services
import { ChatService }  from '../chat/services/chat.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { Conversation } from '../chat/models/chat.model';

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatToolbarModule, MatFormFieldModule, MatInputModule,
    MatDividerModule, MatTooltipModule,
    TableModule, ButtonModule, TagModule,
    SkeletonModule, TooltipModule, ToastModule,
    ConfirmDialogModule,
    LoadingSpinnerComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './conversations.component.html',
  styleUrls: ['./conversations.component.css']
})
export class ConversationsComponent implements OnInit {

  private chatService          = inject(ChatService);
  private router               = inject(Router);
  private messageService       = inject(MessageService);
  private confirmationService  = inject(ConfirmationService);

  // ── State ─────────────────────────────────────────────────────
  conversations = signal<Conversation[]>([]);
  searchQuery   = signal<string>('');
  isLoading     = signal<boolean>(false);

  // ── Filtered list ─────────────────────────────────────────────
  filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.conversations();
    return this.conversations().filter(c =>
      (c.title || '').toLowerCase().includes(q)
    );
  });

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadConversations();
  }

  // ── Load ──────────────────────────────────────────────────────
  loadConversations(): void {
    this.isLoading.set(true);
    this.chatService.getConversations().subscribe({
      next: res => {
        this.conversations.set(res.data || []);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  // ── Resume conversation ───────────────────────────────────────
  resumeConversation(conv: Conversation): void {
    sessionStorage.setItem('selectedConvId', conv._id);
    this.router.navigate(['/chat']);
  }

  // ── Helpers ───────────────────────────────────────────────────
  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatRelative(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays  = Math.floor(diffMs / 86400000);

    if (diffMins < 1)    return 'Just now';
    if (diffMins < 60)   return `${diffMins}m ago`;
    if (diffHours < 24)  return `${diffHours}h ago`;
    if (diffDays < 7)    return `${diffDays}d ago`;
    return this.formatDate(dateStr);
  }

  formatTokens(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  }

  getMessageSeverity(
    count: number
  ): 'success' | 'info' | 'secondary' {
    if (count >= 20) return 'success';
    if (count >= 5)  return 'info';
    return 'secondary';
  }

  getTotalMessages(): number {
    return this.conversations().reduce(
      (sum, c) => sum + c.messageCount, 0
    );
  }

  getTotalTokens(): number {
    return this.conversations().reduce(
      (sum, c) => sum + c.totalTokensUsed, 0
    );
  }
}