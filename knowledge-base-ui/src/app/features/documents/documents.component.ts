import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  inject,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Angular Material
import { MatToolbarModule }    from '@angular/material/toolbar';
import { MatCardModule }       from '@angular/material/card';
import { MatButtonModule }     from '@angular/material/button';
import { MatIconModule }       from '@angular/material/icon';
import { MatBadgeModule }      from '@angular/material/badge';
import { MatTooltipModule }    from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule }      from '@angular/material/chips';
import { MatDividerModule }    from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// PrimeNG
import { TableModule }         from 'primeng/table';
import { DialogModule }        from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule }         from 'primeng/toast';
import { TagModule }           from 'primeng/tag';
import { ProgressBarModule }   from 'primeng/progressbar';
import { SkeletonModule }      from 'primeng/skeleton';
import { TooltipModule }       from 'primeng/tooltip';
import { ButtonModule }        from 'primeng/button';
import { BadgeModule }         from 'primeng/badge';
import { MessageService, ConfirmationService } from 'primeng/api';

import { DocumentService }     from './services/document.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { Document, UploadItem } from './models/document.model';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    // Angular Material
    MatToolbarModule, MatCardModule, MatButtonModule,
    MatIconModule, MatBadgeModule, MatTooltipModule,
    MatProgressBarModule, MatChipsModule, MatDividerModule,
    MatSnackBarModule,
    // PrimeNG
    TableModule, DialogModule, ConfirmDialogModule,
    ToastModule, TagModule, ProgressBarModule,
    SkeletonModule, TooltipModule, ButtonModule, BadgeModule,
    // Shared
    LoadingSpinnerComponent
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css']
})
export class DocumentsComponent implements OnInit, OnDestroy {

  private documentService = inject(DocumentService);
  private messageService  = inject(MessageService);
  private snackBar        = inject(MatSnackBar);

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  // ── State ─────────────────────────────────────────────────────
  documents        = signal<Document[]>([]);
  uploadItems      = signal<UploadItem[]>([]);
  isLoading        = signal<boolean>(false);
  isDragOver       = signal<boolean>(false);
  indexingIds      = signal<Set<string>>(new Set());

  // Summary dialog
  showSummaryDialog    = signal<boolean>(false);
  summaryDocumentName  = signal<string>('');
  summaryText          = signal<string>('');
  isSummarizing        = signal<boolean>(false);
  private summaryCtrl: AbortController | null = null;

  // Delete confirm dialog
  showDeleteDialog     = signal<boolean>(false);
  documentToDelete     = signal<Document | null>(null);
  isDeleting           = signal<boolean>(false);

  // Allowed types
  private readonly ALLOWED_TYPES = [
    'application/pdf', 'text/plain', 'text/markdown'
  ];
  private readonly MAX_MB = 10;

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void { this.loadDocuments(); }

  ngOnDestroy(): void { this.summaryCtrl?.abort(); }

  // ── Load ──────────────────────────────────────────────────────
  loadDocuments(): void {
    this.isLoading.set(true);
    this.documentService.getDocuments().subscribe({
      next: res => {
        this.documents.set(res.data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.showError('Failed to load documents');
      }
    });
  }

  // ── Drag & Drop ───────────────────────────────────────────────
  onDragOver(e: DragEvent): void {
    e.preventDefault(); e.stopPropagation();
    this.isDragOver.set(true);
  }
  onDragLeave(e: DragEvent): void {
    e.preventDefault(); e.stopPropagation();
    this.isDragOver.set(false);
  }
  onDrop(e: DragEvent): void {
    e.preventDefault(); e.stopPropagation();
    this.isDragOver.set(false);
    this.processFiles(Array.from(e.dataTransfer?.files || []));
  }

  openFilePicker(): void {
    this.fileInputRef.nativeElement.click();
  }

  onFileInputChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.processFiles(Array.from(input.files || []));
    input.value = '';
  }

  // ── Validate & Upload ─────────────────────────────────────────
  private processFiles(files: File[]): void {
    for (const file of files) {
      if (!this.ALLOWED_TYPES.includes(file.type)) {
        this.addUploadItem(file, 'error',
          'File type not supported. Allowed: PDF, TXT, MD');
        continue;
      }
      if (file.size > this.MAX_MB * 1024 * 1024) {
        this.addUploadItem(file, 'error',
          `File exceeds ${this.MAX_MB}MB limit`);
        continue;
      }
      this.uploadFile(file);
    }
  }

  private addUploadItem(
    file: File,
    status: UploadItem['status'],
    errorMessage = ''
  ): UploadItem {
    const item: UploadItem = {
      file,
      uid: crypto.randomUUID(),
      status,
      progress: 0,
      errorMessage
    };
    this.uploadItems.update(items => [item, ...items]);
    return item;
  }

  private uploadFile(file: File): void {
    const item = this.addUploadItem(file, 'uploading');

    this.documentService.uploadFile(file).subscribe({
      next: event => {
        this.patchUploadItem(item.uid, { progress: event.progress });
        if (event.result) {
          this.patchUploadItem(item.uid, {
            status: 'success', progress: 100, result: event.result
          });
          this.messageService.add({
            severity: 'success',
            summary: 'Upload Complete',
            detail: `${file.name} uploaded successfully`
          });
          this.loadDocuments();
        }
      },
      error: err => {
        this.patchUploadItem(item.uid, {
          status: 'error',
          errorMessage: err.error?.error || 'Upload failed'
        });
        this.showError(err.error?.error || 'Upload failed');
      }
    });
  }

  private patchUploadItem(uid: string, updates: Partial<UploadItem>): void {
    this.uploadItems.update(items =>
      items.map(i => i.uid === uid ? { ...i, ...updates } : i)
    );
  }

  removeUploadItem(uid: string): void {
    this.uploadItems.update(items => items.filter(i => i.uid !== uid));
  }

  clearQueue(): void { this.uploadItems.set([]); }

  // ── Index ─────────────────────────────────────────────────────
  indexDocument(doc: Document): void {
    // ── BUG FIX: use doc._id not doc.id ──
    const docId = doc._id;

    this.indexingIds.update(ids => {
      const s = new Set(ids); s.add(docId); return s;
    });

    this.documentService.indexDocument(docId).subscribe({
      next: res => {
        this.indexingIds.update(ids => {
          const s = new Set(ids); s.delete(docId); return s;
        });
        this.documents.update(docs =>
          docs.map(d => d._id === docId ? { ...d, isIndexed: true } : d)
        );
        this.messageService.add({
          severity: 'success',
          summary: 'Indexed Successfully',
          detail: `${res.data?.chunksCreated} chunks created from "${doc.originalName}"`
        });
      },
      error: err => {
        this.indexingIds.update(ids => {
          const s = new Set(ids); s.delete(docId); return s;
        });
        const msg = err.error?.code === 'ALREADY_INDEXED'
          ? 'Document is already indexed'
          : err.error?.error || 'Indexing failed';
        this.showError(msg);
      }
    });
  }

  isIndexing(docId: string): boolean {
    return this.indexingIds().has(docId);
  }

  // ── Delete ────────────────────────────────────────────────────
  confirmDelete(doc: Document): void {
    this.documentToDelete.set(doc);
    this.showDeleteDialog.set(true);
  }

  cancelDelete(): void {
    this.showDeleteDialog.set(false);
    this.documentToDelete.set(null);
  }

  executeDelete(): void {
    const doc = this.documentToDelete();

    // ── BUG FIX: guard against undefined _id ──
    if (!doc?._id) {
      this.showError('Cannot delete: document ID is missing');
      this.cancelDelete();
      return;
    }

    this.isDeleting.set(true);

    this.documentService.deleteDocument(doc._id).subscribe({
      next: () => {
        this.documents.update(docs =>
          docs.filter(d => d._id !== doc._id)
        );
        this.isDeleting.set(false);
        this.showDeleteDialog.set(false);
        this.documentToDelete.set(null);
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: `"${doc.originalName}" removed`
        });
      },
      error: err => {
        this.isDeleting.set(false);
        this.showError(err.error?.error || 'Delete failed');
      }
    });
  }

  // ── Summary ───────────────────────────────────────────────────
  openSummary(doc: Document): void {
    this.summaryDocumentName.set(doc.originalName);
    this.summaryText.set('');
    this.isSummarizing.set(true);
    this.showSummaryDialog.set(true);

    this.summaryCtrl = this.documentService.summarizeDocument(
      doc._id,
      chunk => this.summaryText.update(t => t + chunk),
      ()    => this.isSummarizing.set(false),
      err   => {
        this.isSummarizing.set(false);
        this.summaryText.set(`Error: ${err}`);
      }
    );
  }

  closeSummary(): void {
    this.summaryCtrl?.abort();
    this.showSummaryDialog.set(false);
    this.summaryText.set('');
    this.isSummarizing.set(false);
  }

  // ── Helpers ───────────────────────────────────────────────────
  formatFileSize(bytes: number): string {
    return this.documentService.formatFileSize(bytes);
  }

  getFileIcon(mimeType: string): string {
    return this.documentService.getFileIcon(mimeType);
  }

  getFileSeverity(mimeType: string): any {
    return this.documentService.getFileSeverity(mimeType);
  }

  getTypeLabel(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType === 'text/plain')      return 'TXT';
    return 'MD';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatNumber(n: number | null): string {
    if (!n && n !== 0) return '—';
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  }

  getTokenPercent(tokens: number | null): number {
    if (!tokens) return 0;
    return Math.min((tokens / 1_000_000) * 100, 100);
  }

  getTokenSeverity(tokens: number | null): string {
    if (!tokens) return 'success';
    const pct = tokens / 1_000_000;
    if (pct < 0.5) return 'success';
    if (pct < 0.8) return 'warning';
    return 'danger';
  }

  private showError(msg: string): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: msg
    });
  }
}