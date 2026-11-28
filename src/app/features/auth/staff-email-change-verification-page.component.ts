import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthService } from '../../core/auth/auth.service';
import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { AuthPageShellComponent } from './auth-page-shell.component';
import { AuthPasswordVisibilityComponent } from './auth-password-visibility.component';

@Component({
  selector: 'app-staff-email-change-verification-page',
  imports: [CommonModule, ReactiveFormsModule, AuthPageShellComponent, AuthPasswordVisibilityComponent],
  templateUrl: './staff-email-change-verification-page.component.html',
  styleUrl: './staff-email-change-verification-page.component.css',
})
export class StaffEmailChangeVerificationPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  private readonly staffManagement = inject(StaffManagementService);
  private readonly destroyRef = inject(DestroyRef);
  readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  readonly requestedEmail = signal<string | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly complete = signal(false);
  readonly error = signal<string | null>(null);

  private readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';
  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  constructor() {
    if (!this.requestId || !this.token) {
      this.loading.set(false);
      this.error.set('This email-change link is invalid or expired.');
      return;
    }
    this.staffManagement.inspectLoginEmailChange(this.requestId, this.token).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.requestedEmail.set(response.requested_email);
        this.loading.set(false);
        if (this.auth.currentUser()) this.confirm();
      },
      error: () => { this.loading.set(false); this.error.set('This email-change link is invalid or expired.'); },
    });
  }

  signInAndConfirm(): void {
    if (this.form.invalid || this.submitting()) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set(null);
    this.auth.login(this.form.getRawValue()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.confirm(),
      error: () => { this.submitting.set(false); this.error.set('Sign-in failed. Use the existing login email and password for this staff account.'); },
    });
  }

  private confirm(): void {
    if (this.submitting() && !this.auth.currentUser()) return;
    this.submitting.set(true);
    this.staffManagement.confirmLoginEmailChange(this.requestId, this.token).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.auth.clearUserState(); this.complete.set(true); this.submitting.set(false); },
      error: () => { this.submitting.set(false); this.error.set('The signed-in account does not match this email-change request, or the link has expired.'); },
    });
  }
}
