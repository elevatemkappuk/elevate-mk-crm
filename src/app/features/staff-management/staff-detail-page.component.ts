import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { StaffActivityEvent, StaffDetail, StaffPrivacyCapability, StaffRolePrivacyPreview } from '../../core/staff-management/staff-management.types';
import { AuthService } from '../../core/auth/auth.service';
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
  private readonly auth = inject(AuthService);
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
  readonly rolePreview = signal<StaffRolePrivacyPreview | null>(null);
  readonly rolePreviewState = signal<'idle' | 'loading' | 'ready' | 'error' | 'unauthorized'>('idle');
  private rolePreviewEpoch = 0;

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
    this.reason.set(''); this.selectedRole.set(currentRole === 'CRM_MANAGER' ? 'CRM_VIEWER' : 'CRM_MANAGER'); this.action.set({ kind: 'role', id: userId }); this.loadRolePreview(userId, this.selectedRole());
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
  closeRoleAction(): void { if (!this.actionBusy()) { this.rolePreviewEpoch += 1; this.rolePreview.set(null); this.rolePreviewState.set('idle'); this.action.set(null); } }
  selectRole(value: string): void {
    if (value !== 'CRM_ADMIN' && value !== 'CRM_MANAGER' && value !== 'CRM_VIEWER') return;
    this.selectedRole.set(value);
    const pending = this.action();
    if (pending?.kind === 'role') this.loadRolePreview(pending.id, value);
  }
  loadRolePreview(userId: number, roleCode: string): void {
    const requestEpoch = ++this.rolePreviewEpoch;
    this.rolePreview.set(null);
    if (!this.auth.hasPrivacyAdministration()) { this.rolePreviewState.set('unauthorized'); return; }
    this.rolePreviewState.set('loading');
    this.service.previewStaffRole(userId, roleCode, 'Role-change privacy preview').pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { if (requestEpoch === this.rolePreviewEpoch && this.rolePreviewState() === 'loading') this.rolePreviewState.set('idle'); }),
    ).subscribe({
      next: value => { if (requestEpoch !== this.rolePreviewEpoch || this.action()?.id !== userId || this.selectedRole() !== roleCode || !this.auth.hasPrivacyAdministration()) return; this.rolePreview.set(value); this.rolePreviewState.set('ready'); },
      error: error => { if (requestEpoch !== this.rolePreviewEpoch) return; this.rolePreviewState.set(error.status === 403 ? 'unauthorized' : 'error'); },
    });
  }
  privacySourceLabel(source: string): string {
    return ({ ROLE_DEFAULT: 'Role default', INDIVIDUAL_GRANT: 'Individual grant', INDIVIDUAL_RESTRICTION: 'Individual restriction', SUPERUSER_BYPASS: 'Audited superuser bypass', ACCOUNT_INELIGIBLE: 'Account ineligible', STAFF_ROLE_INELIGIBLE: 'Staff or role ineligible', SUSPENDED: 'Suspended', REVOKED: 'Revoked' } as Record<string, string>)[source] ?? source;
  }
  capabilityStateLabel(capability: StaffPrivacyCapability): string { return capability.effective ? 'Effective' : capability.suspended_grant ? 'Suspended' : capability.individual_restriction_active ? 'Restricted' : 'Not effective'; }
  privacyReadAllowed(): boolean { return this.auth.hasPrivacyAdministration(); }
  privacySources(capability: StaffPrivacyCapability): string { return capability.sources.map(source => this.privacySourceLabel(source)).join(', ') || 'None'; }
  effectiveCapabilityCodes(capabilities: readonly StaffPrivacyCapability[] | undefined): string { return (capabilities ?? []).filter(item => item.effective).map(item => item.code).join(', ') || 'None'; }
  actionTitle(kind: string): string { return ({ 'password-reset': 'Send Password Reset Email?', 'cancel-email-change': 'Cancel login-email change?', 'disable-account': 'Disable global account?', 'enable-account': 'Enable global account?', promote: 'Propose Administrator?', role: 'Change CRM role?', deactivate: 'Deactivate staff access?', reactivate: 'Reactivate staff access?', resend: 'Resend invitation?', cancel: 'Cancel invitation?' } as Record<string, string>)[kind] ?? 'Confirm action'; }
  actionConfirmLabel(kind: string): string { return this.actionTitle(kind).replace(/\?$/, ''); }
  actionVariant(kind: string): 'destructive' | 'caution' { return kind === 'disable-account' || kind === 'deactivate' || kind === 'cancel' || kind === 'cancel-email-change' ? 'destructive' : 'caution'; }
  actionMessage(kind: string): string { return ({ 'cancel-email-change': 'The pending login-email change and its verification link will be cancelled. The current login email and Person email remain unchanged.', 'password-reset': 'A password-reset email will be queued for the registered login email. You cannot choose or view the password or reset link. Existing credentials remain unchanged until the account owner completes the secure reset.', 'disable-account': 'Authentication will be blocked across the Elevate MK ecosystem. Sessions and applicable credentials will be invalidated; Person, Membership, roles and privacy grants remain recorded, with retained roles and grants ineffective while disabled. This is different from staff deactivation.', 'enable-account': 'The account will become eligible for authentication, but fresh authentication is required. Retained valid roles and grants may become effective; revoked roles, suspended grants and invalidated credentials remain unchanged.', promote: 'This submits an independent proposal. The current CRM role remains unchanged until another Administrator approves it.', role: 'The current role remains until the backend confirms this atomic replacement. Existing CRM sessions will be invalidated.', deactivate: 'Operational CRM access will be revoked, CRM sessions invalidated and individual privacy grants suspended. Membership, Community access, identity and the global account remain unchanged.', reactivate: 'A new secure invitation is required. Previously suspended individual privacy grants will remain suspended.', resend: 'The current invitation will be superseded and a new email will be queued.', cancel: 'The invitation will become unusable. Person and account identity will remain unchanged.' } as Record<string, string>)[kind] ?? 'Confirm this action.'; }
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
      next: () => { this.actionBusy.set(false); this.rolePreviewEpoch += 1; this.rolePreview.set(null); this.action.set(null); this.reason.set(''); this.reload(); },
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
