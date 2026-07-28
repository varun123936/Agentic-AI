import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AgentService } from './core/services/agent.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.component.html',
  styleUrls:  ['./app.component.css']
})
export class AppComponent implements OnInit {

  private agentService = inject(AgentService);

  provider   = signal<string>('gemini');
  modelName  = signal<string>('gemini-2.0-flash');
  isSwitching = signal<boolean>(false);

  ngOnInit(): void {
    this.agentService.getConfig().subscribe({
      next: cfg => {
        this.provider.set(cfg.provider);
        this.modelName.set(cfg.model);
      }
    });
  }

  switchProvider(p: string): void {
    if (this.provider() === p || this.isSwitching()) return;
    this.isSwitching.set(true);
    this.agentService.switchProvider(p).subscribe({
      next: cfg => {
        this.provider.set(cfg.provider);
        this.modelName.set(cfg.model);
        this.isSwitching.set(false);
      },
      error: () => this.isSwitching.set(false)
    });
  }
}