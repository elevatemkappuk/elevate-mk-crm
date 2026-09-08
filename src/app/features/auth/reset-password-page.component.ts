import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthPageShellComponent } from './auth-page-shell.component';
import { AuthPasswordVisibilityComponent } from './auth-password-visibility.component';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, AuthPageShellComponent, AuthPasswordVisibilityComponent],
  template: `
    <app-auth-page-shell>
      <header class="auth-heading">
        <h1>Reset password</h1>
        @if (!success() && !invalidLink()) { <p>Choose a new password for your Elevate MK staff account.</p> }
      </header>
      @if (success()) {
        <p class="crm-banner crm-banner--success" role="status">Your password has been reset.</p>
        <a class="auth-link auth-back crm-focusable" routerLink="/login">Return to Sign in</a>
      } @else if (invalidLink()) {
        <p class="crm-banner crm-banner--error" role="alert">This password reset link is invalid or has expired.</p>
        <a class="auth-link auth-back crm-focusable" routerLink="/forgot-password">Request another reset link</a>
      } @else {
        <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" [attr.aria-busy]="submitting()">
          <div class="crm-field">
            <label class="crm-label" for="reset-password">New password</label>
            <div class="auth-password">
              <input #newPassword class="crm-control" id="reset-password" type="password" formControlName="new_password" autocomplete="new-password"
                [attr.aria-invalid]="form.controls.new_password.invalid && form.controls.new_password.touched"
                [attr.aria-describedby]="form.controls.new_password.invalid && form.controls.new_password.touched ? 'reset-password-required' : null" />
              <button [appPasswordVisibility]="newPassword" passwordLabel="new password" class="auth-password-toggle crm-focusable"></button>
            </div>
            @if (form.controls.new_password.invalid && form.controls.new_password.touched) { <p class="crm-error" id="reset-password-required">Enter a new password.</p> }
          </div>
          <div class="crm-field">
            <label class="crm-label" for="reset-confirm">Confirm new password</label>
            <div class="auth-password">
              <input #confirmPassword class="crm-control" id="reset-confirm" type="password" formControlName="confirm_password" autocomplete="new-password"
                [attr.aria-invalid]="mismatch() || (form.controls.confirm_password.invalid && form.controls.confirm_password.touched)"
                [attr.aria-describedby]="mismatch() ? 'reset-mismatch' : form.controls.confirm_password.invalid && form.controls.confirm_password.touched ? 'reset-confirm-required' : null" />
              <button [appPasswordVisibility]="confirmPassword" passwordLabel="password confirmation" class="auth-password-toggle crm-focusable"></button>
            </div>
            @if (form.controls.confirm_password.invalid && form.controls.confirm_password.touched) { <p class="crm-error" id="reset-confirm-required">Confirm your new password.</p> }
            @if (mismatch()) { <p class="crm-error" id="reset-mismatch" aria-live="polite">The passwords do not match.</p> }
          </div>
          @if (error()) { <p class="crm-banner crm-banner--error" id="reset-error" role="alert">{{ error() }}</p> }
          <button class="crm-button crm-button--primary auth-submit" type="submit" [disabled]="submitting()">{{ submitting() ? 'Resetting...' : 'Reset password' }}</button>
          @if (submitting() && !error()) { <span class="auth-sr-only" role="status">Resetting password...</span> }
        </form>
        <a class="auth-link auth-back crm-focusable" routerLink="/login">Back to Sign in</a>
      }
    </app-auth-page-shell>
`,
})
export class ResetPasswordPageComponent { private fb=inject(FormBuilder); private route=inject(ActivatedRoute); private auth=inject(AuthService); readonly submitting=signal(false);readonly success=signal(false);readonly invalidLink=signal(false);readonly error=signal<string|null>(null);readonly form=this.fb.nonNullable.group({new_password:['',Validators.required],confirm_password:['',Validators.required]}); mismatch(){const v=this.form.getRawValue();return !!v.new_password&&!!v.confirm_password&&v.new_password!==v.confirm_password;} submit(){if(this.form.invalid||this.mismatch())return;this.submitting.set(true);this.error.set(null);this.auth.confirmPasswordReset({uid:this.route.snapshot.paramMap.get('uid')??'',token:this.route.snapshot.paramMap.get('token')??'',...this.form.getRawValue()}).subscribe({next:()=>this.success.set(true),error:e=>{if(e?.error?.code==='invalid_password_reset_token')this.invalidLink.set(true);else if(e?.error&&typeof e.error==='object'){this.error.set(Object.values(e.error).flat().join(' '));}else this.error.set('We could not reset your password right now. Please try again.');},complete:()=>this.submitting.set(false)});}}
