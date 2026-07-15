import {
  Component,
  inject,
  computed,
  signal
} from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationError
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService }       from './core/services/auth.service';
import { LoaderService }     from './core/services/loader.service';
import { GlobalLoaderComponent } from './shared/components/global-loader/global-loader.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    CommonModule,
    GlobalLoaderComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  authService   = inject(AuthService);
  loaderService = inject(LoaderService);
  private router = inject(Router);

  // Mobile menu state
  mobileMenuOpen = signal<boolean>(false);

  // Computed
  isLoggedIn = computed(() => this.authService.isLoggedIn());
  isAdmin    = computed(() => this.authService.isAdmin());
  user       = computed(() => this.authService.currentUser());

  tokenPercent = computed(() => {
    const u = this.user();
    if (!u || !u.dailyTokenLimit) return 0;
    return Math.min(
      Math.round((u.tokensUsedToday / u.dailyTokenLimit) * 100),
      100
    );
  });

  constructor() {
    // Track route navigation for loader
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.mobileMenuOpen.set(false);
      }
    });
  }

  isAuthPage(): boolean {
    const url = this.router.url;
    return url.includes('/login') ||
           url.includes('/register') ||
           url === '/';
  }

  logout(): void {
    this.authService.logout();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000)      return `${(n / 1000).toFixed(1)}k`;
    return `${n}`;
  }

  getTokenBarColor(): string {
    const p = this.tokenPercent();
    if (p >= 90) return '#dc2626';
    if (p >= 60) return '#d97706';
    return '#1a56db';
  }
}