import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatToolbarModule }    from '@angular/material/toolbar';
import { MatCardModule }       from '@angular/material/card';
import { MatButtonModule }     from '@angular/material/button';
import { MatIconModule }       from '@angular/material/icon';
import { MatFormFieldModule }  from '@angular/material/form-field';
import { MatInputModule }      from '@angular/material/input';
import { MatSelectModule }     from '@angular/material/select';
import { MatChipsModule }      from '@angular/material/chips';
import { MatDividerModule }    from '@angular/material/divider';
import { MatTooltipModule }    from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule }      from '@angular/material/badge';

// PrimeNG
import { ButtonModule }        from 'primeng/button';
import { TagModule }           from 'primeng/tag';
import { ToastModule }         from 'primeng/toast';
import { SkeletonModule }      from 'primeng/skeleton';
import { TooltipModule }       from 'primeng/tooltip';
import { DropdownModule }      from 'primeng/dropdown';
import { MessageService }      from 'primeng/api';
import { ProgressBarModule }   from 'primeng/progressbar';
import { PanelModule }         from 'primeng/panel';

// Services
import { RagService }          from './services/rag.service';
import { DocumentService }     from '../documents/services/document.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

import {
  SearchChunk,
  RagStats,
  Source,
  DocumentOption
} from './models/rag.model';

@Component({
  selector: 'app-rag',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    // Angular Material
    MatToolbarModule, MatCardModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatChipsModule, MatDividerModule,
    MatTooltipModule, MatProgressBarModule, MatBadgeModule,
    // PrimeNG
    ButtonModule, TagModule, ToastModule, SkeletonModule,
    TooltipModule, DropdownModule, ProgressBarModule, PanelModule,
    // Shared
    LoadingSpinnerComponent
  ],
  providers: [MessageService],
  templateUrl: './rag.component.html',
  styleUrls: ['./rag.component.css']
})
export class RagComponent implements OnInit, OnDestroy {

  private ragService      = inject(RagService);
  private documentService = inject(DocumentService);
  private messageService  = inject(MessageService);

  // ── Search state ──────────────────────────────────────────────
  searchQuery       = signal<string>('');
  selectedDocId     = signal<string | null>(null);
  documentOptions   = signal<DocumentOption[]>([{ label: 'All Documents', value: null }]);

  // ── Results state ─────────────────────────────────────────────
  searchChunks      = signal<SearchChunk[]>([]);
  isSearching       = signal<boolean>(false);

  // ── RAG chat state ────────────────────────────────────────────
  aiAnswer          = signal<string>('');
  isStreaming       = signal<boolean>(false);
  streamStatus      = signal<string>('');
  streamSources     = signal<Source[]>([]);
  chunksUsed        = signal<number>(0);
  lastLatencyMs     = signal<number>(0);
  lastInputTokens   = signal<number>(0);
  lastOutputTokens  = signal<number>(0);
  streamError       = signal<string>('');
  hasSearched       = signal<boolean>(false);

  // ── Stats ─────────────────────────────────────────────────────
  ragStats          = signal<RagStats | null>(null);

  // ── Active tab on mobile ──────────────────────────────────────
  activeTab         = signal<'results' | 'answer'>('results');

  // ── Computed ──────────────────────────────────────────────────
  canSearch = computed(() =>
    this.searchQuery().trim().length >= 3 && !this.isStreaming()
  );

  topChunk = computed(() =>
    this.searchChunks().length > 0 ? this.searchChunks()[0] : null
  );

  private streamController: AbortController | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadDocumentOptions();
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.streamController?.abort();
  }

  // ── Load document list for filter dropdown ────────────────────
  private loadDocumentOptions(): void {
    this.documentService.getDocuments().subscribe({
      next: res => {
        const docs = res.data || [];
        const options: DocumentOption[] = [
          { label: 'All Documents', value: null },
          ...docs
            .filter(d => d.isIndexed)
            .map(d => ({
              label: d.originalName,
              value: d._id
            }))
        ];
        this.documentOptions.set(options);
      }
    });
  }

  // ── Load RAG stats ────────────────────────────────────────────
  private loadStats(): void {
    this.ragService.getStats().subscribe({
      next: res => {
        if (res.data) this.ragStats.set(res.data);
      }
    });
  }

  // ── Handle Enter key in search box ────────────────────────────
  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.runSearch();
    }
  }

  // ── Full RAG flow — search + AI answer ───────────────────────
  runSearch(): void {
    const query = this.searchQuery().trim();
    if (!query || query.length < 3) return;

    // Cancel any active stream
    this.streamController?.abort();

    // Reset state
    this.searchChunks.set([]);
    this.aiAnswer.set('');
    this.streamSources.set([]);
    this.streamError.set('');
    this.chunksUsed.set(0);
    this.lastLatencyMs.set(0);
    this.lastInputTokens.set(0);
    this.lastOutputTokens.set(0);
    this.hasSearched.set(true);
    this.isStreaming.set(true);
    this.streamStatus.set('Searching knowledge base...');
    this.activeTab.set('answer');

    // Start RAG chat stream
    this.streamController = this.ragService.ragChat(
      query,
      this.selectedDocId(),

      // onStatus
      (msg) => {
        this.streamStatus.set(msg);
      },

      // onContext — chunks found
      (count, sources) => {
        this.chunksUsed.set(count);
        this.streamSources.set(sources);
        this.streamStatus.set(
          count > 0
            ? `Found ${count} relevant section${count !== 1 ? 's' : ''}. Generating answer...`
            : 'No relevant context found. Answering from general knowledge...'
        );

        // Also run pure search to show chunks panel
        this.loadChunks(query);
      },

      // onChunk
      (chunk) => {
        this.aiAnswer.update(t => t + chunk);
        if (this.activeTab() !== 'answer') {
          this.activeTab.set('answer');
        }
      },

      // onDone
      (meta) => {
        this.isStreaming.set(false);
        this.streamStatus.set('');
        this.lastLatencyMs.set(meta.latencyMs || 0);
        this.lastInputTokens.set(meta.tokens?.input || 0);
        this.lastOutputTokens.set(meta.tokens?.output || 0);
      },

      // onError
      (err) => {
        this.isStreaming.set(false);
        this.streamStatus.set('');
        this.streamError.set(err);
      }
    );
  }

  // ── Load context chunks for the results panel ─────────────────
  private loadChunks(query: string): void {
    this.isSearching.set(true);

    this.ragService.search(
      query,
      this.selectedDocId(),
      5
    ).subscribe({
      next: res => {
        // Map to SearchChunk shape
        const chunks: SearchChunk[] = (res.data?.chunks || []).map((c, i) => ({
          id: `chunk-${i}`,
          text: c.text,
          similarityScore: c.similarityScore,
          metadata: {
            documentId: c.documentId,
            documentName: c.documentName,
            chunkIndex: i,
            wordCount: c.text.split(' ').length
          }
        }));
        this.searchChunks.set(chunks);
        this.isSearching.set(false);
      },
      error: () => {
        this.isSearching.set(false);
      }
    });
  }

  // ── Clear everything ──────────────────────────────────────────
  clearSearch(): void {
    this.streamController?.abort();
    this.searchQuery.set('');
    this.searchChunks.set([]);
    this.aiAnswer.set('');
    this.streamSources.set([]);
    this.streamError.set('');
    this.streamStatus.set('');
    this.isStreaming.set(false);
    this.hasSearched.set(false);
    this.activeTab.set('results');
  }

  clearError(): void {
    this.streamError.set('');
  }

  // ── Helpers ───────────────────────────────────────────────────
  getScoreColor(score: number): 'success' | 'info' | 'warn' | 'danger' {
  if (score >= 0.8) return 'success';
  if (score >= 0.6) return 'info';
  if (score >= 0.4) return 'warn';    // ← was 'warning', PrimeNG uses 'warn'
  return 'danger';
}

  getScoreLabel(score: number): string {
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Low';
  }

  getScorePercent(score: number): number {
    return Math.round(score * 100);
  }

  highlightQuery(text: string): string {
    // Simple highlight — returns text as-is
    // Full highlight needs DomSanitizer — keeping simple here
    return text;
  }

  formatNumber(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  }

  getSuggestedQueries(): string[] {
    return [
      'What is the refund policy?',
      'How do I contact support?',
      'What are the payment methods?',
      'Explain the onboarding process'
    ];
  }

  useSuggestedQuery(query: string): void {
    this.searchQuery.set(query);
    this.runSearch();
  }
}