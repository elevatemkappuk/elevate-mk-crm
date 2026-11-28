import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { StaffActivityEvent, StaffDetail } from '../../core/staff-management/staff-management.types';
import { DetailListComponent } from '../../shared/ui/detail-list.component';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';

@Component({
  selector: 'app-staff-detail-page',
  imports: [CommonModule, RouterLink, DetailListComponent, CrmSectionCardComponent, StateMessageComponent, StatusBadgeComponent, ConfirmationDialogComponent, CrmDrawerComponent],
  templateUrl: './staff-detail-page.component.html',
  styleUrl: './staff-detail-page.component.css',
})
export class StaffDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(StaffManagementService);
  private readonly destroyRef = inject(DestroyRef);
  readonly detail = signal<StaffDetail | null>(null);
  readonly activity = signal<StaffActivityEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly action = signal<{ kind: 'resend' | 'cancel'; id: string } | { kind: 'cancel-email-change'; id: number } | { kind: 'promote' | 'role' | 'deactivate' | 'reactivate' | 'disable-account' | 'enable-account' | 'password-reset'; id: number } | null>(null);
  readonly reason = signal('');
  readonly selectedRole = signal<'CRM_ADMIN' | 'CRM_MANAGER' | 'CRM_VIEWER'>('CRM_VIEWER');
  readonly actionBusy = signal(false);
  readonly emailChangeOpen = signal(false);
  readonly requestedEmail = signal('');

  constructor() {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = Number(params.get('id'));
        return this.service.get(id).pipe(
          tap(detail => {
            this.detail.set(detail);
            this.loading.set(false);
            this.service.activity(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(response => this.activity.set(response.results));
          }),
          catchError(() => { this.error.set('Staff details could not be loaded.'); this.loading.set(false); return of(null); }),
        );
      }), takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  openInvitationAction(kind: 'resend' | 'cancel', id: string): void { this.reason.set(''); this.action.set({ kind, id }); }
  openPromotionAction(userId: number | null): void {
    if (userId === null) return;
    this.reason.set(''); this.action.set({ kind: 'promote', id: userId });
  }
  openRoleAction(userId: number | null, currentRole: StaffDetail['crm_role']): void {
    if (userId === null) return;
    this.reason.set(''); this.selectedRole.set(currentRole === 'CRM_MANAGER' ? 'CRM_VIEWER' : 'CRM_MANAGER'); this.action.set({ kind: 'role', id: userId });
  }
  openLifecycleAction(kind: 'deactivate' | 'reactivate', userId: number | null): void {
    if (userId === null) return;
    this.reason.set(''); this.selectedRole.set(kind === 'reactivate' ? 'CRM_VIEWER' : 'CRM_MANAGER'); this.action.set({ kind, id: userId });
  }
  openAccountAction(kind: 'disable-account' | 'enable-account' | 'password-reset', userId: number | null): void {
    if (userId === null) return;
    this.reason.set(''); this.action.set({ kind, id: userId });
  }
  openEmailChange(): void { this.requestedEmail.set(''); this.reason.set(''); this.emailChangeOpen.set(true); }
  closeEmailChange(): void { if (!this.actionBusy()) this.emailChangeOpen.set(false); }
  confirmEmailChange(): void {
    const staff = this.detail();
    if (!staff || !staff.user_id || !this.requestedEmail().trim() || !this.reason().trim() || this.actionBusy()) return;
    this.actionBusy.set(true); this.error.set(null);
    this.service.requestLoginEmailChange(staff.user_id, this.requestedEmail().trim(), this.reason().trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.actionBusy.set(false); this.emailChangeOpen.set(false); this.reason.set(''); this.requestedEmail.set(''); this.reload(); },
      error: () => { this.actionBusy.set(false); this.error.set('The login-email change could not be queued.'); },
    });
  }
  openEmailChangeCancellation(requestId: number): void { this.reason.set(''); this.action.set({ kind: 'cancel-email-change', id: requestId }); }
  invitationStatus(invitation: StaffDetail['invitations'][number]): string {
    if (invitation.accepted_at) return 'Accepted';
    if (invitation.revoked_at) return 'Cancelled';
    if (invitation.superseded_at) return 'Superseded';
    return new Date(invitation.expires_at).getTime() <= Date.now() ? 'Expired' : 'Pending';
  }
  closeInvitationAction(): void { if (!this.actionBusy()) this.action.set(null); }
  confirmInvitationAction(): void {
    const action = this.action();
    if (!action || !this.reason().trim() || this.actionBusy()) return;
    this.actionBusy.set(true); this.error.set(null);
    const request: Observable<Record<string, unknown>> = action.kind === 'promote'
      ? this.service.createAdministratorProposal('PROMOTE_EXISTING', action.id, this.reason().trim())
      : action.kind === 'role'
        ? this.service.changeStaffRole(action.id, this.selectedRole(), this.reason().trim())
      : action.kind === 'disable-account'
          ? this.service.disableAccount(action.id, this.reason().trim())
          : action.kind === 'enable-account'
            ? this.service.enableAccount(action.id, this.reason().trim())
          : action.kind === 'password-reset'
            ? this.service.sendAdministrativePasswordReset(action.id, this.reason().trim())
      : action.kind === 'cancel-email-change'
          ? this.service.cancelLoginEmailChange(action.id, this.reason().trim())
      : action.kind === 'deactivate'
          ? this.service.deactivateStaff(action.id, this.reason().trim())
          : action.kind === 'reactivate'
            ? this.service.reactivateStaff(action.id, this.selectedRole(), this.reason().trim())
            : action.kind === 'resend'
              ? this.service.resendInvitation(String(action.id), this.reason().trim())
              : this.service.cancelInvitation(String(action.id), this.reason().trim());
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.actionBusy.set(false); this.action.set(null); this.reason.set(''); this.reload(); },
      error: () => { this.actionBusy.set(false); this.error.set(action.kind === 'password-reset' ? 'The password-reset email could not be queued.' : action.kind === 'cancel-email-change' ? 'The login-email change could not be cancelled.' : action.kind === 'disable-account' ? 'The global account could not be disabled.' : action.kind === 'enable-account' ? 'The global account could not be enabled.' : action.kind === 'promote' ? 'The Administrator proposal could not be created.' : action.kind === 'role' ? 'The CRM role could not be changed.' : action.kind === 'deactivate' ? 'Staff access could not be deactivated.' : action.kind === 'reactivate' ? 'Staff reactivation could not be started.' : `Invitation ${action.kind} could not be completed.`); },
    });
  }
  private reload(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.service.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => { this.detail.set(value); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Staff details could not be refreshed.'); },
    });
  }
}
