import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';
import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-staff-invitation-accept-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './staff-invitation-accept-page.component.html',
  styleUrl: './staff-invitation-accept-page.component.css',
})
export class StaffInvitationAcceptPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(StaffManagementService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly state = signal<'loading' | 'ready' | 'done' | 'error'>('loading');
  readonly message = signal('Checking invitation…');
  readonly existingAccount = signal(false);
  readonly form = this.fb.nonNullable.group({ email: ['', Validators.email], password: ['', [Validators.required, Validators.minLength(8)]], confirm_password: ['', Validators.required] });
  private readonly invitation = this.route.snapshot.queryParamMap.get('invitation') ?? '';
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  constructor() {
    this.http.inspectInvitation(this.invitation, this.token).subscribe({ next: detail => { this.existingAccount.set(detail.existing_account); this.state.set('ready'); this.message.set(detail.existing_account ? 'Sign in with the invited account, then accept this invitation.' : 'Choose a password to activate your Elevate MK staff account.'); }, error: () => { this.state.set('error'); this.message.set('This invitation is invalid, expired, cancelled or unavailable.'); } });
  }

  accept(): void {
    if (this.form.invalid || (this.existingAccount() && (!this.form.controls.email.value || !this.form.controls.password.value)) || (!this.existingAccount() && this.form.value.password !== this.form.value.confirm_password)) { this.form.markAllAsTouched(); return; }
    const accept = () => this.http.acceptInvitation(this.invitation, this.token, this.existingAccount() ? {} : this.form.getRawValue()).subscribe({ next: () => { this.state.set('done'); this.message.set('Invitation accepted. Sign in to continue.'); }, error: () => { this.state.set('error'); this.message.set('The invitation could not be accepted by this account.'); } });
    if (this.existingAccount()) {
      const current = this.auth.currentUser();
      const login = current
        ? this.auth.logout().pipe(switchMap(() => this.auth.login({ email: this.form.controls.email.value, password: this.form.controls.password.value })))
        : this.auth.login({ email: this.form.controls.email.value, password: this.form.controls.password.value });
      login.subscribe({ next: accept, error: () => { this.message.set('The existing account could not be authenticated. Use the account password or password recovery.'); } });
      return;
    }
    accept();
  }
}
