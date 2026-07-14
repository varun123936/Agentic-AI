import {
  Component,
  OnInit,
  signal,
  inject,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

// Angular Material
import { MatToolbarModule }     from '@angular/material/toolbar';
import { MatCardModule }        from '@angular/material/card';
import { MatButtonModule }      from '@angular/material/button';
import { MatIconModule }        from '@angular/material/icon';
import { MatDividerModule }     from '@angular/material/divider';
import { MatTooltipModule }     from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule }       from '@angular/material/badge';
import { MatTabsModule }        from '@angular/material/tabs';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule }   from '@angular/material/form-field';
import { MatInputModule }       from '@angular/material/input';

// PrimeNG
import { TableModule }          from 'primeng/table';
import { ChartModule }          from 'primeng/chart';
import { TagModule }            from 'primeng/tag';
import { ToastModule }          from 'primeng/toast';
import { SkeletonModule }       from 'primeng/skeleton';
import { TooltipModule }        from 'primeng/tooltip';
import { ButtonModule }         from 'primeng/button';
import { DialogModule }         from 'primeng/dialog';
import { InputNumberModule }    from 'primeng/inputnumber';
import { MessageService }       from 'primeng/api';
import { KnobModule }           from 'primeng/knob';

// Services & Models
import { AdminService }  from './services/admin.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import {
  AdminUser,
  AdminStats,
  AdminUsage,
  DailyTrend,
  UsageByProvider,
  SystemHealth
} from './models/admin.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    // Angular Material
    MatToolbarModule, MatCardModule, MatButtonModule,
    MatIconModule, MatDividerModule, MatTooltipModule,
    MatProgressBarModule, MatBadgeModule, MatTabsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    // PrimeNG
    TableModule, ChartModule, TagModule, ToastModule,
    SkeletonModule, TooltipModule, ButtonModule,
    DialogModule, InputNumberModule, KnobModule,
    // Shared
    LoadingSpinnerComponent
  ],
  providers: [MessageService],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {

  private adminService   = inject(AdminService);
  private messageService = inject(MessageService);

  // ── State ─────────────────────────────────────────────────────
  stats         = signal<AdminStats | null>(null);
  users         = signal<AdminUser[]>([]);
  usage         = signal<AdminUsage | null>(null);
  healthChecks  = signal<SystemHealth[]>([]);

  isLoadingStats  = signal<boolean>(false);
  isLoadingUsers  = signal<boolean>(false);
  isLoadingUsage  = signal<boolean>(false);
  isCheckingHealth = signal<boolean>(false);

  // Token limit dialog
  showTokenDialog    = signal<boolean>(false);
  selectedUser       = signal<AdminUser | null>(null);
  newTokenLimit      = signal<number>(100000);
  isUpdatingLimit    = signal<boolean>(false);

  // Chart data
  trendChartData     = signal<any>(null);
  trendChartOptions  = signal<any>(null);
  providerChartData  = signal<any>(null);
  providerChartOptions = signal<any>(null);

  // Active tab index
  activeTabIndex: number = 0;

  // ── Computed ──────────────────────────────────────────────────
  totalCostFormatted = computed(() => {
    const cost = this.stats()?.totalCostUsd || 0;
    return cost < 0.01 ? '< $0.01' : `$${cost.toFixed(4)}`;
  });

  allSystemsOk = computed(() =>
    this.healthChecks().length > 0 &&
    this.healthChecks().every(h => h.status === 'ok')
  );

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadStats();
    this.loadUsers();
    this.loadUsage();
    this.runHealthChecks();
  }

  // ── Load summary stats ────────────────────────────────────────
  loadStats(): void {
    this.isLoadingStats.set(true);
    this.adminService.getStats().subscribe({
      next: res => {
        if (res.data) this.stats.set(res.data);
        this.isLoadingStats.set(false);
      },
      error: () => this.isLoadingStats.set(false)
    });
  }

  // ── Load users ────────────────────────────────────────────────
  loadUsers(): void {
    this.isLoadingUsers.set(true);
    this.adminService.getUsers().subscribe({
      next: res => {
        this.users.set(res.data || []);
        this.isLoadingUsers.set(false);
      },
      error: () => this.isLoadingUsers.set(false)
    });
  }

  // ── Load usage + build charts ─────────────────────────────────
  loadUsage(): void {
    this.isLoadingUsage.set(true);
    this.adminService.getUsage().subscribe({
      next: res => {
        if (res.data) {
          this.usage.set(res.data);
          this.buildTrendChart(res.data.dailyTrend);
          this.buildProviderChart(res.data.byProvider);
        }
        this.isLoadingUsage.set(false);
      },
      error: () => this.isLoadingUsage.set(false)
    });
  }

  // ── Run health checks ─────────────────────────────────────────
  async runHealthChecks(): Promise<void> {
    this.isCheckingHealth.set(true);

    // Show checking state for each service
    this.healthChecks.set([
      { service: 'API Server',   status: 'checking', detail: '' },
      { service: 'MongoDB',      status: 'checking', detail: '' },
      { service: 'Chroma Cloud', status: 'checking', detail: '' },
      { service: 'Ollama',       status: 'checking', detail: '' },
    ]);

    const results = await this.adminService.checkHealth(environment.apiUrl);
    this.healthChecks.set(results);
    this.isCheckingHealth.set(false);
  }

  // ── Build 7-day trend line chart ──────────────────────────────
  private buildTrendChart(trends: DailyTrend[]): void {
    const labels = trends.map(t => {
      const date = new Date(t._id);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short'
      });
    });

    this.trendChartData.set({
      labels,
      datasets: [
        {
          label: 'Tokens Used',
          data: trends.map(t => t.totalTokens),
          fill: true,
          backgroundColor: 'rgba(26, 86, 219, 0.1)',
          borderColor: '#1a56db',
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#1a56db',
          yAxisID: 'y'
        },
        {
          label: 'Requests',
          data: trends.map(t => t.requests),
          fill: false,
          borderColor: '#10b981',
          borderWidth: 2,
          tension: 0.4,
          borderDash: [4, 4],
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
          yAxisID: 'y1'
        }
      ]
    });

    this.trendChartOptions.set({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const val = ctx.raw as number;
              if (ctx.datasetIndex === 0) {
                return ` Tokens: ${val >= 1000
                  ? (val / 1000).toFixed(1) + 'k' : val}`;
              }
              return ` Requests: ${val}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        },
        y: {
          type: 'linear',
          position: 'left',
          grid: { color: '#f3f4f6' },
          ticks: {
            font: { size: 11 },
            callback: (val: number) =>
              val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val
          }
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 11 } }
        }
      }
    });
  }

 // ── Safe provider name extractor ──────────────────────────────
// MongoDB _id in aggregation can be a string OR an object
getProviderName(id: any): string {
  if (!id) return 'unknown';
  if (typeof id === 'string') return id;
  if (typeof id === 'object') {
    // Try common fields
    return id.provider || id.name || id._id || JSON.stringify(id);
  }
  return String(id);
}

// ── Updated buildProviderChart ─────────────────────────────────
private buildProviderChart(providers: UsageByProvider[]): void {
  const colors = ['#1a56db', '#10b981', '#f59e0b', '#ef4444'];

  // Use safe name extraction
  const labels = providers.map(p => this.getProviderName(p._id));

  this.providerChartData.set({
    labels,
    datasets: [{
      data: providers.map(p => p.totalTokens),
      backgroundColor: providers.map((_, i) => colors[i] || '#6b7280'),
      borderWidth: 2,
      borderColor: '#ffffff',
      hoverOffset: 6
    }]
  });

  this.providerChartOptions.set({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { size: 12 },
          padding: 16,
          // Safe label generation
          generateLabels: (chart: any) => {
            const data = chart.data;
            return data.labels.map((label: string, i: number) => ({
              text: String(label),    // force string
              fillStyle: data.datasets[0].backgroundColor[i],
              strokeStyle: '#ffffff',
              lineWidth: 2,
              index: i
            }));
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw as number;
            const label = String(ctx.label);
            return ` ${label}: ${val >= 1000
              ? (val / 1000).toFixed(1) + 'k' : val} tokens`;
          }
        }
      }
    }
  });
}

  // ── Open token limit dialog ───────────────────────────────────
  openTokenDialog(user: AdminUser): void {
    this.selectedUser.set(user);
    this.newTokenLimit.set(user.dailyTokenLimit);
    this.showTokenDialog.set(true);
  }

  closeTokenDialog(): void {
    this.showTokenDialog.set(false);
    this.selectedUser.set(null);
  }

  // ── Save token limit ──────────────────────────────────────────
  saveTokenLimit(): void {
    const user = this.selectedUser();
    const limit = this.newTokenLimit();

    if (!user || !limit || limit < 1000) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid',
        detail: 'Minimum token limit is 1,000'
      });
      return;
    }

    this.isUpdatingLimit.set(true);

    this.adminService.updateTokenLimit(
      user._id,
      { dailyTokenLimit: limit }
    ).subscribe({
      next: res => {
        if (res.data) {
          // Update user in list
          this.users.update(users =>
            users.map(u =>
              u._id === user._id
                ? { ...u, dailyTokenLimit: limit }
                : u
            )
          );
        }
        this.isUpdatingLimit.set(false);
        this.closeTokenDialog();
        this.messageService.add({
          severity: 'success',
          summary: 'Updated',
          detail: `Token limit updated for ${user.name}`
        });
      },
      error: err => {
        this.isUpdatingLimit.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.error || 'Update failed'
        });
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  getHealthIcon(status: SystemHealth['status']): string {
    if (status === 'ok')       return 'check_circle';
    if (status === 'error')    return 'error';
    return 'hourglass_top';
  }

  getHealthColor(status: SystemHealth['status']): string {
    if (status === 'ok')       return '#16a34a';
    if (status === 'error')    return '#dc2626';
    return '#d97706';
  }

  getHealthSeverity(
    status: SystemHealth['status']
  ): 'success' | 'danger' | 'warn' {
    if (status === 'ok')    return 'success';
    if (status === 'error') return 'danger';
    return 'warn';
  }

  getRoleSeverity(role: string): 'info' | 'secondary' {
    return role === 'admin' ? 'info' : 'secondary';
  }

  getUsagePercent(user: AdminUser): number {
    return Math.min(
      Math.round((user.tokensUsedToday / user.dailyTokenLimit) * 100),
      100
    );
  }

  getUsageColor(user: AdminUser): 'primary' | 'accent' | 'warn' {
    const pct = this.getUsagePercent(user);
    if (pct >= 90) return 'warn';
    if (pct >= 60) return 'accent';
    return 'primary';
  }

  formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000)      return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatCost(cost: number): string {
    if (cost === 0)    return '$0.00';
    if (cost < 0.001)  return '< $0.001';
    return `$${cost.toFixed(4)}`;
  }
}