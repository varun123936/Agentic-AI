import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  ViewChild,
  ElementRef,
  inject,
  AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from './services/chat.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import {
  Conversation,
  Message,
  StreamingState
} from './models/chat.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {

  private chatService = inject(ChatService);

  // ── Template refs ────────────────────────────────────────────
  @ViewChild('messageContainer') messageContainer!: ElementRef;
  @ViewChild('messageInputRef') messageInputRef!: ElementRef;

  // ── State signals ────────────────────────────────────────────
  conversations = signal<Conversation[]>([]);
  activeConversation = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  messageInput = signal<string>('');

  isLoadingConversations = signal<boolean>(false);
  isLoadingMessages = signal<boolean>(false);
  isCreatingConversation = signal<boolean>(false);

  streaming = signal<StreamingState>({
    isStreaming: false,
    currentText: '',
    error: ''
  });

  // Track if we need to scroll to bottom
  private shouldScrollToBottom = false;

  // AbortController to cancel in-progress stream
  private activeStreamController: AbortController | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadConversations();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    // Cancel any active stream when component is destroyed
    this.activeStreamController?.abort();
  }

  // ── Load conversations list ───────────────────────────────────
  loadConversations(): void {
    this.isLoadingConversations.set(true);

    this.chatService.getConversations().subscribe({
      next: (res) => {
        this.conversations.set(res.data || []);
        this.isLoadingConversations.set(false);

        // Auto-open first conversation if exists
        const convs = res.data || [];
        if (convs.length > 0 && !this.activeConversation()) {
          this.selectConversation(convs[0]);
        }
      },
      error: () => {
        this.isLoadingConversations.set(false);
      }
    });
  }

  // ── Create new conversation ───────────────────────────────────
  createConversation(): void {
    this.isCreatingConversation.set(true);

    this.chatService.createConversation().subscribe({
      next: (res) => {
        if (res.data) {
          // Add to top of list
          this.conversations.update(convs => [res.data!, ...convs]);
          // Switch to new conversation
          this.selectConversation(res.data);
        }
        this.isCreatingConversation.set(false);
      },
      error: () => {
        this.isCreatingConversation.set(false);
      }
    });
  }

  // ── Select a conversation ─────────────────────────────────────
  selectConversation(conversation: Conversation): void {
    // Cancel any active stream first
    this.activeStreamController?.abort();

    // Reset streaming state
    this.streaming.set({
      isStreaming: false,
      currentText: '',
      error: ''
    });

    this.activeConversation.set(conversation);
    this.loadMessages(conversation._id);
  }

  // ── Load messages for a conversation ─────────────────────────
  loadMessages(conversationId: string): void {
    this.isLoadingMessages.set(true);
    this.messages.set([]);

    this.chatService.getMessages(conversationId).subscribe({
      next: (res) => {
        this.messages.set(res.data || []);
        this.isLoadingMessages.set(false);
        this.shouldScrollToBottom = true;
      },
      error: () => {
        this.isLoadingMessages.set(false);
      }
    });
  }

  // ── Send a message ────────────────────────────────────────────
  sendMessage(): void {
    const text = this.messageInput().trim();
    const conv = this.activeConversation();

    // Guards
    if (!text || !conv || this.streaming().isStreaming) return;
    if (text.length > 2000) {
      this.streaming.update(s => ({
        ...s,
        error: 'Message must be under 2000 characters'
      }));
      return;
    }

    // Cancel any previous stream
    this.activeStreamController?.abort();

    // Add user message to UI immediately — optimistic update
    const userMessage: Message = {
      role: 'user',
      content: text,
      createdAt: new Date().toISOString()
    };
    this.messages.update(msgs => [...msgs, userMessage]);

    // Clear input and start streaming state
    this.messageInput.set('');
    this.streaming.set({
      isStreaming: true,
      currentText: '',
      error: ''
    });
    this.shouldScrollToBottom = true;

    // Start stream
    this.activeStreamController = this.chatService.streamMessage(
      conv._id,
      text,

      // onChunk — append each word/token to currentText
      (chunk) => {
        this.streaming.update(s => ({
          ...s,
          currentText: s.currentText + chunk
        }));
        this.shouldScrollToBottom = true;
      },

      // onDone — stream finished
      (meta) => {
        const finalText = this.streaming().currentText;

        // Add completed assistant message to messages array
        const assistantMessage: Message = {
          role: 'assistant',
          content: finalText,
          createdAt: new Date().toISOString(),
          aiMeta: {
            model: 'gemini-2.5-flash',
            provider: 'gemini',
            inputTokens: meta.tokens?.input || 0,
            outputTokens: meta.tokens?.output || 0,
            latencyMs: meta.latencyMs || 0
          }
        };

        this.messages.update(msgs => [...msgs, assistantMessage]);

        // Reset streaming state
        this.streaming.set({
          isStreaming: false,
          currentText: '',
          error: ''
        });

        // Update conversation title and message count in sidebar
        this.updateConversationInList(conv._id);
        this.shouldScrollToBottom = true;
      },

      // onError
      (err) => {
        this.streaming.set({
          isStreaming: false,
          currentText: '',
          error: err || 'Something went wrong. Please try again.'
        });
        this.shouldScrollToBottom = true;
      }
    );
  }

  // ── Handle Enter key ──────────────────────────────────────────
  onKeyDown(event: KeyboardEvent): void {
    // Enter = send, Shift+Enter = new line
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // ── Update conversation metadata in sidebar ───────────────────
  private updateConversationInList(conversationId: string): void {
    // Reload the single conversation from backend
    // to get updated title and messageCount
    this.chatService.getConversations().subscribe({
      next: (res) => {
        this.conversations.set(res.data || []);
      }
    });
  }

  // ── Scroll to bottom of messages ──────────────────────────────
  private scrollToBottom(): void {
    try {
      const el = this.messageContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch {
      // Ignore scroll errors
    }
  }

  // ── Utility: format timestamp ──────────────────────────────────
  formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ── Utility: format token number ──────────────────────────────
  formatTokens(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  }

  // ── Utility: check if message is last in list ──────────────────
  isLastMessage(index: number): boolean {
    return index === this.messages().length - 1;
  }

  clearError(): void {
  this.streaming.update(s => ({
    ...s,
    error: ''
  }));
}
}