import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthPageShellComponent } from './auth-page-shell.component';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, AuthPageShellComponent],
  template: `
    <app-auth-page-shell>
      <header class="auth-heading">
        <h1>Forgot password</h1>
        <p>Enter the email address associated with your Elevate MK staff account and we'll send you a reset link.</p>
      </header>
      @if (success()) {
        <p class="crm-banner crm-banner--success" role="status">If an account exists for that email address, password reset instructions have been sent.</p>
      } @else {
        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" [attr.aria-busy]="submitting()">
          <div class="crm-field">
            <label class="crm-label" for="recovery-email">Email</label>
            <input class="crm-control" id="recovery-email" type="email" formControlName="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@example.com"
              [attr.aria-invalid]="form.controls.email.invalid && form.controls.email.touched"
              [attr.aria-describedby]="form.controls.email.invalid && form.controls.email.touched ? 'recovery-email-error' : null" />
            @if (form.controls.email.invalid && form.controls.email.touched) {
              <p class="crm-error" id="recovery-email-error">Enter your staff email address.</p>
            }
          </div>
          @if (error()) { <p class="crm-banner crm-banner--error" role="alert">We couldn't process your request right now. Please try again.</p> }
          <button class="crm-button crm-button--primary auth-submit" type="submit" [disabled]="form.invalid || submitting()">{{ submitting() ? 'Sending...' : 'Send reset link' }}</button>
          @if (submitting() && !error()) { <span class="auth-sr-only" role="status">Sending reset link...</span> }
        </form>
      }
      <a class="auth-link auth-back crm-focusable" routerLink="/login">Back to Sign in</a>
    </app-auth-page-shell>
`,
})
export class ForgotPasswordPageComponent { private fb=inject(FormBuilder); private auth=inject(AuthService); readonly submitting=signal(false); readonly success=signal(false); readonly error=signal(false); readonly form=this.fb.nonNullable.group({email:['',[Validators.required,Validators.email]]}); submit(){if(this.form.invalid)return;this.submitting.set(true);this.error.set(false);this.auth.requestPasswordReset(this.form.getRawValue()).subscribe({next:()=>this.success.set(true),error:()=>this.error.set(true),complete:()=>this.submitting.set(false)});} }
