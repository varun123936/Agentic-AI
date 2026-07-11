import {
  Component,
  signal,
  inject,
  computed
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

// ── Custom validator: password must contain at least one number ──
function hasNumber(control: AbstractControl): ValidationErrors | null {
  return /\d/.test(control.value || '')
    ? null
    : { hasNumber: true };
}

// ── Custom validator: password must contain at least one letter ──
function hasLetter(control: AbstractControl): ValidationErrors | null {
  return /[a-zA-Z]/.test(control.value || '')
    ? null
    : { hasLetter: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  errorMessage = signal<string>('');
  isSubmitting = signal<boolean>(false);
  showPassword = signal<boolean>(false);

  registerForm: FormGroup = this.fb.group({
    name: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100)
      ]
    ],
    email: [
      '',
      [Validators.required, Validators.email]
    ],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        hasNumber,
        hasLetter
      ]
    ]
  });

  // ── Password strength computed from signal ────────────────────
  // Reads password value reactively — updates UI as user types
  passwordStrength = computed(() => {
    const val: string = this.registerForm?.get('password')?.value || '';
    let score = 0;

    if (val.length >= 8)          score++;   // length ok
    if (/[A-Z]/.test(val))        score++;   // has uppercase
    if (/\d/.test(val))           score++;   // has number
    if (/[^a-zA-Z0-9]/.test(val)) score++;   // has special char

    const levels = [
      { label: 'Too short',  color: 'danger',  width: '15%'  },
      { label: 'Weak',       color: 'danger',  width: '30%'  },
      { label: 'Fair',       color: 'warning', width: '55%'  },
      { label: 'Good',       color: 'info',    width: '75%'  },
      { label: 'Strong',     color: 'success', width: '100%' },
    ];

    return val.length === 0 ? null : levels[score];
  });

  onSubmit(): void {
    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid) return;

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const msg =
          err.error?.error ||
          err.error?.errors?.join(', ') ||
          'Registration failed. Please try again.';
        this.errorMessage.set(msg);
      }
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  get name()     { return this.registerForm.get('name');     }
  get email()    { return this.registerForm.get('email');    }
  get password() { return this.registerForm.get('password'); }
}