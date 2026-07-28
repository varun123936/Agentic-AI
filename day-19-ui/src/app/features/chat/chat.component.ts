import {
  Component, OnInit, OnDestroy,
  signal, inject, ViewChild,
  ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { AgentService } from '../../core/services/agent.service';
import { ToolLogComponent } from '../../shared/tool-log/tool-log.component';
import { Message, ToolLog, SseEvent } from '../../core/models/agent.models';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolLogComponent],
  templateUrl: './chat.component.html',
  styleUrls:  ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {

  private agentService = inject(AgentService);

  @ViewChild('msgContainer') msgContainer!: ElementRef;

  messages      = signal<Message[]>([]);
  toolLogs      = signal<ToolLog[]>([]);
  inputText     = signal<string>('');
  isStreaming   = signal<boolean>(false);
  streamingText = signal<string>('');
  statusText    = signal<string>('');
  latencyText   = signal<string>('');

  private controller:     AbortController | null = null;
  private shouldScroll  = false;
  streamingMsgId = '';

  readonly QUICK = [
    { icon: 'bi-box-seam',    label: 'Order ORD-1001 status',           q: 'What is the status of order ORD-1001?' },
    { icon: 'bi-list-ul',     label: 'All orders for ravi@example.com', q: 'Show all orders for ravi@example.com' },
    { icon: 'bi-search',      label: 'Search Apple laptops',             q: 'Search for Apple laptops available' },
    { icon: 'bi-cloud-sun',   label: 'Weather in Hyderabad',             q: 'What is the weather in Hyderabad today?' },
    { icon: 'bi-shuffle',     label: 'Multi-tool: weather + products',   q: 'Check weather in Mumbai and find Sony headphones' }
  ];

  ngOnInit(): void {
    this.addMsg('assistant', '👋 Hello! I can check orders, search products, get weather, and more. Ask me anything!');
  }

  ngOnDestroy(): void { this.controller?.abort(); }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) { this.scrollToBottom(); this.shouldScroll = false; }
  }

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.isStreaming()) return;

    this.controller?.abort();
    this.inputText.set('');
    this.toolLogs.set([]);
    this.latencyText.set('');
    this.addMsg('user', text);
    this.isStreaming.set(true);
    this.statusText.set('Connecting...');

    // Add placeholder AI message
    this.streamingMsgId = crypto.randomUUID();
    this.messages.update(msgs => [...msgs, { id: this.streamingMsgId, role: 'assistant', content: '' }]);
    this.streamingText.set('');
    this.shouldScroll = true;

    this.controller = this.agentService.streamChat(text, [], (evt) => this.handleEvent(evt));
  }

  handleEvent(evt: SseEvent): void {
    switch (evt.type) {

      case 'connected':
        this.statusText.set(`Connected → ${evt.model}`);
        break;

      case 'status':
        this.statusText.set(evt.message || '');
        // Add tool log entry if it mentions a tool
        if (evt.message?.toLowerCase().includes('using')) {
          const name = evt.message.replace(/^Using:\s*/i,'').replace('...','').trim();
          this.addToolLog(name, 'running');
        }
        break;

      case 'tool_call':
        this.updateLastToolLog('done');
        this.addToolLog(evt.toolName || '', 'running');
        break;

      case 'chunk':
        this.streamingText.update(t => t + (evt.content || ''));
        this.updateStreamingMsg(this.streamingText());
        this.shouldScroll = true;
        break;

      case 'done':
        this.updateLastToolLog('done');
        this.finalizeStreamingMsg();
        this.isStreaming.set(false);
        this.statusText.set('');
        this.latencyText.set(`✓ ${evt.latencyMs}ms · ${evt.toolCallCount} tool call${evt.toolCallCount !== 1 ? 's' : ''}`);
        this.shouldScroll = true;
        break;

      case 'error':
        this.updateLastToolLog('error');
        this.updateStreamingMsg(`❌ Error: ${evt.message}`);
        this.isStreaming.set(false);
        this.statusText.set('');
        break;
    }
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  useQuick(q: string): void { this.inputText.set(q); this.send(); }

  private addMsg(role: 'user' | 'assistant', content: string): void {
    this.messages.update(msgs => [...msgs, { id: crypto.randomUUID(), role, content }]);
    this.shouldScroll = true;
  }

  private updateStreamingMsg(content: string): void {
    this.messages.update(msgs => msgs.map(m => m.id === this.streamingMsgId ? { ...m, content } : m));
  }

  private finalizeStreamingMsg(): void {
    // Content is already set via chunks — just ensure no cursor artifact
    this.streamingText.set('');
  }

  private addToolLog(name: string, status: ToolLog['status']): void {
    this.toolLogs.update(logs => [...logs, { id: crypto.randomUUID(), name: name.replace(/_/g,' '), status, ts: new Date() }]);
  }

  private updateLastToolLog(status: ToolLog['status']): void {
    this.toolLogs.update(logs => {
      if (!logs.length) return logs;
      const last = logs[logs.length - 1];
      return [...logs.slice(0, -1), { ...last, status }];
    });
  }

  private scrollToBottom(): void {
    try {
      const el = this.msgContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }
}