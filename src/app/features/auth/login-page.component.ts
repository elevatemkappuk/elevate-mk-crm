import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="auth-layout">
      <div class="auth-card">
        <p class="eyebrow">Elevate MK Staff CRM</p>
        <h1>Sign in</h1>
        <p class="intro">
          Use your Elevate MK staff account. Authentication is handled by the Django session backend.
        </p>

        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()">
          <label>
            <span>Email</span>
            <input type="email" formControlName="email" autocomplete="email" />
          </label>

          <label>
            <span>Password</span>
            <input type="password" formControlName="password" autocomplete="current-password" />
          </label>

          @if (errorMessage()) {
            <p class="error">{{ errorMessage() }}</p>
          }

          <button type="submit" [disabled]="submitting() || form.invalid">
            {{ submitting() ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>
      </div>
    </section>
  `,
  styles: `
    .auth-layout {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem;
    }

    .auth-card {
      width: min(100%, 28rem);
      padding: 2rem;
      border-radius: 1.25rem;
      border: 1px solid rgba(23, 42, 58, 0.14);
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 24px 60px rgba(19, 33, 46, 0.12);
      backdrop-filter: blur(18px);
    }

    .eyebrow {
      margin: 0 0 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: 0.72rem;
      color: #476074;
    }

    h1 {
      margin: 0;
      font-size: clamp(2rem, 3vw, 2.6rem);
      color: #142433;
    }

    .intro {
      margin: 0.75rem 0 1.5rem;
      color: #466277;
      line-height: 1.6;
    }

    .auth-form {
      display: grid;
      gap: 1rem;
    }

    label {
      display: grid;
      gap: 0.45rem;
      color: #1c3344;
      font-weight: 600;
    }

    input {
      width: 100%;
      border: 1px solid #b7c7d4;
      border-radius: 0.85rem;
      padding: 0.9rem 1rem;
      font: inherit;
      background: #fdfefe;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 0.9rem 1.25rem;
      font: inherit;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, #16354a, #2f6f84);
      cursor: pointer;
    }

    button:disabled {
      cursor: wait;
      opacity: 0.7;
    }

    .error {
      margin: 0;
      color: #9b1c1c;
      font-weight: 600;
    }
  `,
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.auth.setAuthenticatedUser(user);
        const destination = this.auth.getAuthorizedRoute(user);
        void this.router.navigateByUrl(destination);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(
          error.status === 403
            ? 'A valid CSRF token is required before sign-in.'
            : 'Sign-in failed. Check your credentials and try again.',
        );
      },
      complete: () => {
        this.submitting.set(false);
      },
    });
  }
}
