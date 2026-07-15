import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }   from '@angular/material/icon';
import { AuthService }     from '../../core/services/auth.service';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule
  ],
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.css']
})
export class NotFoundComponent implements OnInit {

  private router      = inject(Router);
  private authService = inject(AuthService);

  countdown = signal<number>(10);
  private timer: any;

  ngOnInit(): void {
    // Auto-redirect countdown
    this.timer = setInterval(() => {
      this.countdown.update(n => n - 1);
      if (this.countdown() <= 0) {
        clearInterval(this.timer);
        this.goHome();
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  goHome(): void {
    const dest = this.authService.isLoggedIn()
      ? '/dashboard' : '/login';
    this.router.navigate([dest]);
  }
}