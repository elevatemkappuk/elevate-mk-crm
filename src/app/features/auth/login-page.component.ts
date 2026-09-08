import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { RouterLink } from '@angular/router';
import { AuthPageShellComponent } from './auth-page-shell.component';
import { AuthPasswordVisibilityComponent } from './auth-password-visibility.component';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthPageShellComponent, AuthPasswordVisibilityComponent],
  template: `
    <app-auth-page-shell>
      <header class="auth-heading">
        <h1>Sign in</h1>
        <p>Sign in to your Elevate MK staff account.</p>
      </header>
      <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" [attr.aria-busy]="submitting()">
        <div class="crm-field">
          <label class="crm-label" for="login-email">Email</label>
          <input class="crm-control" id="login-email" type="email" formControlName="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com"
            [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched"
            [attr.aria-describedby]="form.controls.email.invalid && form.controls.email.touched ? 'login-email-error' : null" />
          @if (form.controls.email.invalid && form.controls.email.touched) {
            <p class="crm-error" id="login-email-error">Enter your staff email address.</p>
          }
        </div>
        <div class="crm-field">
          <label class="crm-label" for="login-password">Password</label>
          <div class="auth-password">
            <input #password class="crm-control" id="login-password" type="password" formControlName="password" autocomplete="current-password"
              [attr.aria-invalid]="form.controls.password.invalid && form.controls.password.touched"
              [attr.aria-describedby]="form.controls.password.invalid && form.controls.password.touched ? 'login-password-error' : null" />
            <button [appPasswordVisibility]="password" class="auth-password-toggle crm-focusable"></button>
          </div>
          @if (form.controls.password.invalid && form.controls.password.touched) {
            <p class="crm-error" id="login-password-error">Enter your password.</p>
          }
        </div>
        <div class="auth-forgot"><a class="auth-link crm-focusable" routerLink="/forgot-password">Forgot password?</a></div>
        @if (errorMessage()) {
          <p class="crm-banner crm-banner--error" role="alert">{{ errorMessage() }}</p>
        }
        <button class="crm-button crm-button--primary auth-submit" type="submit" [disabled]="submitting() || form.invalid">
          {{ submitting() ? 'Signing in...' : 'Sign in' }}
        </button>
        @if (submitting()) { <span class="auth-sr-only" role="status">Signing in...</span> }
      </form>
    </app-auth-page-shell>
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
            ? 'Your sign-in session could not be verified. Refresh the page and try again.'
            : 'Sign-in failed. Check your credentials and try again.',
        );
      },
      complete: () => {
        this.submitting.set(false);
      },
    });
  }
}
