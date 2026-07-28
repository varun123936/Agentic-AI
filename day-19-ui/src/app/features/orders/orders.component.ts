import {
  Component, OnDestroy, signal, inject,
  ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { AgentService }  from '../../core/services/agent.service';
import { ToolLogComponent }    from '../../shared/tool-log/tool-log.component';
import { ApprovalBoxComponent } from '../../shared/approval-box/approval-box.component';
import { Message, ToolLog, SseEvent, ApprovalState } from '../../core/models/agent.models';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolLogComponent, ApprovalBoxComponent],
  templateUrl: './orders.component.html',
  styleUrls:  ['./orders.component.css']
})
export class OrdersComponent implements OnDestroy, AfterViewChecked {

  private agentService = inject(AgentService);
  @ViewChild('msgContainer') msgContainer!: ElementRef;

  messages      = signal<Message[]>([{ id:'0', role:'assistant', content:'📦 I can check orders, search products, and process cancellations (with your approval). How can I help?' }]);
  toolLogs      = signal<ToolLog[]>([]);
  inputText     = signal<string>('');
  isStreaming   = signal<boolean>(false);
  statusText    = signal<string>('');
  latencyText   = signal<string>('');
  approval      = signal<ApprovalState | null>(null);

  private controller:     AbortController | null = null;
  private shouldScroll  = false;
  private streamingMsgId = '';
  private streamingText  = '';

  readonly QUICK = [
    { icon:'bi-search',     label:'Check ORD-1001 status',     q:'What is the status of order ORD-1001?' },
    { icon:'bi-list-ul',    label:'All orders for Ravi',        q:'Show all orders for ravi@example.com' },
    { icon:'bi-x-circle',   label:'Cancel ORD-1002',            q:'Cancel my order ORD-1002, I changed my mind' },
    { icon:'bi-phone',      label:'Search iPhones',             q:'Search for iPhone products and check stock' }
  ];

  ngOnDestroy(): void { this.controller?.abort(); }
  ngAfterViewChecked(): void { if(this.shouldScroll){ this.scrollToBottom(); this.shouldScroll=false; } }

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.isStreaming()) return;
    this.controller?.abort();
    this.inputText.set(''); this.toolLogs.set([]); this.latencyText.set(''); this.approval.set(null);
    this.addMsg('user', text);
    this.isStreaming.set(true); this.statusText.set('Connecting...');
    this.streamingMsgId = crypto.randomUUID(); this.streamingText = '';
    this.messages.update(msgs => [...msgs, { id:this.streamingMsgId, role:'assistant', content:'' }]);
    this.shouldScroll = true;
    this.controller = this.agentService.streamOrder(text, (evt) => this.handleEvent(evt));
  }

  handleEvent(evt: SseEvent): void {
    switch(evt.type) {
      case 'connected':  this.statusText.set(`Connected → ${evt.provider}`); break;
      case 'status':     this.statusText.set(evt.message||''); break;
      case 'tool_call':
        this.updateLastToolLog('done');
        this.addToolLog(evt.toolName||'', 'running');
        this.updateStreamingMsg(`🔍 Checking: ${(evt.toolName||'').replace(/_/g,' ')}...`);
        break;
      case 'chunk':
        this.streamingText += evt.content||'';
        this.updateStreamingMsg(this.streamingText);
        this.shouldScroll = true;
        break;
      case 'approval_required':
        this.updateLastToolLog('running');
        this.isStreaming.set(false); this.statusText.set('');
        this.updateStreamingMsg(evt.message||'Your confirmation is needed.');
        this.approval.set({ sessionId:evt.sessionId||'', toolName:evt.toolName||'', toolArgs:evt.toolArgs, message:evt.message||'' });
        this.shouldScroll = true;
        break;
      case 'complete':
        this.updateLastToolLog('done');
        this.finalizeMsg(evt.answer||'Done.');
        this.isStreaming.set(false); this.statusText.set('');
        this.latencyText.set(`✓ ${evt.latencyMs}ms · ${evt.toolCallCount} tool call${evt.toolCallCount!==1?'s':''}`);
        this.shouldScroll = true;
        break;
      case 'error':
        this.updateLastToolLog('error');
        this.finalizeMsg(`❌ Error: ${evt.message}`);
        this.isStreaming.set(false); this.statusText.set('');
        break;
    }
  }

  onApproval(result: { approved: boolean; feedback: string }): void {
    const state = this.approval();
    if (!state) return;
    this.approval.set(null); this.isStreaming.set(true);
    this.statusText.set(result.approved ? 'Processing...' : 'Cancelling...');
    this.streamingText = '';
    this.streamingMsgId = crypto.randomUUID();
    this.messages.update(msgs => [...msgs, { id:this.streamingMsgId, role:'assistant', content:'' }]);
    this.shouldScroll = true;
    this.controller = this.agentService.streamApprove(state.sessionId, result.approved, result.feedback, (evt) => this.handleEvent(evt));
  }

  onKeydown(e: KeyboardEvent): void { if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); this.send(); } }
  useQuick(q: string): void { this.inputText.set(q); this.send(); }

  private addMsg(role: 'user'|'assistant', content: string): void {
    this.messages.update(msgs => [...msgs, { id:crypto.randomUUID(), role, content }]);
    this.shouldScroll = true;
  }
  private updateStreamingMsg(content: string): void {
    this.messages.update(msgs => msgs.map(m => m.id===this.streamingMsgId ? { ...m, content } : m));
  }
  private finalizeMsg(content: string): void {
    this.streamingText = '';
    this.messages.update(msgs => msgs.map(m => m.id===this.streamingMsgId ? { ...m, content } : m));
  }
  private addToolLog(name: string, status: ToolLog['status']): void {
    this.toolLogs.update(logs => [...logs, { id:crypto.randomUUID(), name:name.replace(/_/g,' '), status, ts:new Date() }]);
  }
  private updateLastToolLog(status: ToolLog['status']): void {
    this.toolLogs.update(logs => {
      if (!logs.length) return logs;
      return [...logs.slice(0,-1), { ...logs[logs.length-1], status }];
    });
  }
  private scrollToBottom(): void {
    try { const el=this.msgContainer?.nativeElement; if(el) el.scrollTop=el.scrollHeight; } catch {}
  }
}