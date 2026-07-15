import {
  Component,
  OnInit,
  signal,
  inject,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

// Angular Material
import { MatCardModule }        from '@angular/material/card';
import { MatButtonModule }      from '@angular/material/button';
import { MatIconModule }        from '@angular/material/icon';
import { MatDividerModule }     from '@angular/material/divider';
import { MatToolbarModule }     from '@angular/material/toolbar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule }     from '@angular/material/tooltip';

// PrimeNG
import { ButtonModule }      from 'primeng/button';
import { TagModule }         from 'primeng/tag';
import { SkeletonModule }    from 'primeng/skeleton';
import { TimelineModule }    from 'primeng/timeline';
import { ToastModule }       from 'primeng/toast';
import { MessageService }    from 'primeng/api';

// Services
import { AuthService }       from '../../core/services/auth.service';
import { ChatService }       from '../chat/services/chat.service';
import { DocumentService }   from '../documents/services/document.service';
import { RagService }        from '../rag/services/rag.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { Conversation }      from '../chat/models/chat.model';

interface QuickAction {
  icon: string;
  label: string;
  description: string;
  route: string;
  color: string;
}

interface ActivityItem {
  icon: string;
  color: string;
  title: string;
  subtitle: string;
  time: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule,
    MatDividerModule, MatToolbarModule,
    MatProgressBarModule, MatTooltipModule,
    ButtonModule, TagModule, SkeletonModule,
    TimelineModule, ToastModule,
    LoadingSpinnerComponent
  ],
  providers: [MessageService],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  authService     = inject(AuthService);
  private chatService     = inject(ChatService);
  private documentService = inject(DocumentService);
  private ragService      = inject(RagService);
  private router          = inject(Router);
  private messageService  = inject(MessageService);

  // ── State ─────────────────────────────────────────────────────
  recentConversations = signal<Conversation[]>([]);
  totalDocuments      = signal<number>(0);
  indexedDocuments    = signal<number>(0);
  ragChunks           = signal<number>(0);

  isLoadingConvs  = signal<boolean>(false);
  isLoadingDocs   = signal<boolean>(false);

  // ── Computed ──────────────────────────────────────────────────
  currentUser = computed(() => this.authService.currentUser());

  tokenUsagePercent = computed(() => {
    const user = this.currentUser();
    if (!user || !user.dailyTokenLimit) return 0;
    return Math.min(
      Math.round((user.tokensUsedToday / user.dailyTokenLimit) * 100),
      100
    );
  });

  tokensRemaining = computed(() => {
    const user = this.currentUser();
    if (!user) return 0;
    return Math.max(user.dailyTokenLimit - user.tokensUsedToday, 0);
  });

  greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  });

  // ── Quick actions ─────────────────────────────────────────────
  quickActions: QuickAction[] = [
    {
      icon: 'chat',
      label: 'Start Chat',
      description: 'Have a conversation with your AI assistant',
      route: '/chat',
      color: 'blue'
    },
    {
      icon: 'upload_file',
      label: 'Upload Document',
      description: 'Add documents to your knowledge base',
      route: '/documents',
      color: 'green'
    },
    {
      icon: 'manage_search',
      label: 'Search Knowledge',
      description: 'Semantically search across all documents',
      route: '/rag',
      color: 'purple'
    },
    {
      icon: 'history',
      label: 'View History',
      description: 'Browse and resume past conversations',
      route: '/conversations',
      color: 'orange'
    }
  ];

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadRecentConversations();
    this.loadDocumentStats();
    this.loadRagStats();
    this.authService.refreshUser().subscribe();
  }

  // ── Load recent conversations ─────────────────────────────────
  loadRecentConversations(): void {
    this.isLoadingConvs.set(true);
    this.chatService.getConversations().subscribe({
      next: res => {
        // Show only last 5
        this.recentConversations.set((res.data || []).slice(0, 5));
        this.isLoadingConvs.set(false);
      },
      error: () => this.isLoadingConvs.set(false)
    });
  }

  // ── Load document stats ───────────────────────────────────────
  loadDocumentStats(): void {
    this.isLoadingDocs.set(true);
    this.documentService.getDocuments().subscribe({
      next: res => {
        const docs = res.data || [];
        this.totalDocuments.set(docs.length);
        this.indexedDocuments.set(
          docs.filter(d => d.isIndexed).length
        );
        this.isLoadingDocs.set(false);
      },
      error: () => this.isLoadingDocs.set(false)
    });
  }

  // ── Load RAG stats ────────────────────────────────────────────
  loadRagStats(): void {
    this.ragService.getStats().subscribe({
      next: res => {
        this.ragChunks.set(res.data?.yourChunks || 0);
      }
    });
  }

  // ── Navigate to chat with conversation ───────────────────────
  openConversation(conv: Conversation): void {
    // Store selected conv ID so ChatComponent can pick it up
    sessionStorage.setItem('selectedConvId', conv._id);
    this.router.navigate(['/chat']);
  }

  // ── Navigate to new chat ──────────────────────────────────────
  startNewChat(): void {
    this.router.navigate(['/chat']);
  }

  // ── Helpers ───────────────────────────────────────────────────
  formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000)      return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1)   return 'Just now';
    if (diffMins < 60)  return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7)   return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short'
    });
  }

  getTokenBarColor(): 'primary' | 'accent' | 'warn' {
    const pct = this.tokenUsagePercent();
    if (pct >= 90) return 'warn';
    if (pct >= 60) return 'accent';
    return 'primary';
  }
}