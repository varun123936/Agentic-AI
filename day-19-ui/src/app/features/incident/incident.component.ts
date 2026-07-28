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
  selector: 'app-incident',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolLogComponent, ApprovalBoxComponent],
  templateUrl: './incident.component.html',
  styleUrls:  ['./incident.component.css']
})
export class IncidentComponent implements OnDestroy, AfterViewChecked {

  private agentService = inject(AgentService);
  @ViewChild('msgContainer') msgContainer!: ElementRef;
  @ViewChild('approvalBox')  approvalBox!:  ApprovalBoxComponent;

  messages      = signal<Message[]>([{ id: '0', role:'assistant', content:'🔍 Describe an incident and I will investigate systematically. I will ask for your approval before taking any action.' }]);
  toolLogs      = signal<ToolLog[]>([]);
  inputText     = signal<string>('');
  isStreaming   = signal<boolean>(false);
  statusText    = signal<string>('');
  latencyText   = signal<string>('');
  approval      = signal<ApprovalState | null>(null);

  private controller:     AbortController | null = null;
  private shouldScroll  = false;
  private streamingMsgId = '';

  readonly QUICK = [
    { icon:'bi-globe',       label:'Full system check',       q:'Check all services and investigate any issues' },
    { icon:'bi-credit-card', label:'Payment service down',    q:'The payment service seems down. Investigate and fix it.' },
    { icon:'bi-bell',        label:'Notification issue',      q:'Notification service is not working. Check logs.' },
    { icon:'bi-heart-pulse', label:'Check order service',     q:'Check health of order-service' }
  ];

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
    this.approval.set(null);

    this.addMsg('user', text);
    this.isStreaming.set(true);
    this.statusText.set('Starting investigation...');

    this.streamingMsgId = crypto.randomUUID();
    this.messages.update(msgs => [...msgs, { id: this.streamingMsgId, role:'assistant', content:'' }]);
    this.shouldScroll = true;

    this.controller = this.agentService.streamInvestigate(text, (evt) => this.handleEvent(evt));
  }

  handleEvent(evt: SseEvent): void {
    switch (evt.type) {

      case 'connected':
        this.statusText.set(`Connected → ${evt.model}`);
        break;

      case 'status':
        this.statusText.set(evt.message || '');
        break;

      case 'tool_call':
        this.updateLastToolLog('done');
        this.addToolLog(evt.toolName || '', 'running');
        this.updateStreamingMsg(`🔍 Running: ${(evt.toolName || '').replace(/_/g,' ')}...`);
        break;

      case 'chunk':
        this.streamingText += evt.content || '';
        this.updateStreamingMsg(this.streamingText);
        this.shouldScroll = true;
        break;

      case 'approval_required':
        this.updateLastToolLog('running');
        this.isStreaming.set(false);
        this.statusText.set('');
        this.updateStreamingMsg(evt.message || 'Approval required before proceeding.');
        this.approval.set({
          sessionId:   evt.sessionId || '',
          toolName:    evt.toolName  || '',
          toolArgs:    evt.toolArgs,
          message:     evt.message   || '',
          executionLog: evt.executionLog
        });
        this.shouldScroll = true;
        break;

      case 'complete':
        this.updateLastToolLog('done');
        this.finalizeMsg(evt.answer || 'Investigation complete.');
        this.isStreaming.set(false);
        this.statusText.set('');
        this.latencyText.set(`✓ ${evt.latencyMs}ms · ${evt.toolCallCount} steps`);
        this.shouldScroll = true;
        break;

      case 'error':
        this.updateLastToolLog('error');
        this.finalizeMsg(`❌ Error: ${evt.message}`);
        this.isStreaming.set(false);
        this.statusText.set('');
        break;
    }
  }

  private streamingText = '';

  onApproval(result: { approved: boolean; feedback: string }): void {
    const state = this.approval();
    if (!state) return;

    this.approval.set(null);
    this.isStreaming.set(true);
    this.statusText.set(result.approved ? 'Executing approved action...' : 'Finding alternatives...');
    this.streamingText = '';

    this.streamingMsgId = crypto.randomUUID();
    this.messages.update(msgs => [...msgs, { id: this.streamingMsgId, role:'assistant', content:'' }]);
    this.shouldScroll = true;

    this.controller = this.agentService.streamApprove(
      state.sessionId, result.approved, result.feedback,
      (evt) => this.handleEvent(evt)
    );
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  useQuick(q: string): void { this.inputText.set(q); this.send(); }

  private addMsg(role: 'user'|'assistant', content: string): void {
    this.messages.update(msgs => [...msgs, { id:crypto.randomUUID(), role, content }]);
    this.shouldScroll = true;
  }

  private updateStreamingMsg(content: string): void {
    this.messages.update(msgs => msgs.map(m => m.id === this.streamingMsgId ? { ...m, content } : m));
  }

  private finalizeMsg(content: string): void {
    this.streamingText = '';
    this.messages.update(msgs => msgs.map(m => m.id === this.streamingMsgId ? { ...m, content } : m));
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
    try { const el = this.msgContainer?.nativeElement; if(el) el.scrollTop = el.scrollHeight; } catch {}
  }
}