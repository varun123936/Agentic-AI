import {
  Component,
  signal,
  inject,
  OnInit
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import {
  Router,
  ActivatedRoute,
  RouterLink
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent implements OnInit {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Component state using Angular 18 signals
  errorMessage = signal<string>('');
  isSubmitting = signal<boolean>(false);
  sessionExpiredMessage = signal<string>('');
  showPassword = signal<boolean>(false);

  loginForm: FormGroup = this.fb.group({
    email: [
      '',
      [Validators.required, Validators.email]
    ],
    password: [
      '',
      [Validators.required, Validators.minLength(8)]
    ]
  });

  ngOnInit(): void {
    // If already logged in — skip login page
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Check if redirected here due to session expiry
    this.route.queryParams.subscribe(params => {
      if (params['reason'] === 'session_expired') {
        this.sessionExpiredMessage.set(
          'Your session has expired. Please sign in again.'
        );
      }
    });
  }

  onSubmit(): void {
    // Mark all fields touched to show validation errors
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        const returnUrl =
          this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate([returnUrl]);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err.error?.error || 'Login failed. Please check your credentials.'
        );
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  // Getters for cleaner template access
  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }
}