import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { StaffAccessService } from '../../core/auth/staff-access.service';
import { PrivacyAdministrationService } from './privacy-administration.service';
import { GovernanceProposal, GovernanceRoleDefaults, GovernanceStaffSummary, GovernanceTargetDetail } from './privacy-administration.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';

@Component({
  selector: 'app-privacy-administration-page',
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  templateUrl: './privacy-administration-page.component.html',
  styleUrl: './privacy-administration-page.component.css',
})
export class PrivacyAdministrationPageComponent {
  private readonly service = inject(PrivacyAdministrationService);
  private readonly auth = inject(AuthService);
  private readonly staffAccess = inject(StaffAccessService);
  private readonly router = inject(Router);
  private authorizationEpoch = 0;
  private revalidatingAuthorization = false;
  readonly target = signal<GovernanceTargetDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly pendingAction = signal<{ capability: string; operation: string; targetUserId: number; executionMode: 'DIRECT' | 'PROPOSAL' | 'DIRECT_SUPERUSER' } | null>(null);
  readonly pendingProposalAction = signal<{ proposal: GovernanceProposal; action: 'approve' | 'reject' | 'cancel' } | null>(null);
  readonly pendingRoleAction = signal<{ roleId: number; roleCode: string; capability: string; operation: string; executionMode: 'PROPOSAL' | 'DIRECT_SUPERUSER' } | null>(null);
  readonly staffDirectory = signal<readonly GovernanceStaffSummary[]>([]);
  readonly roleDefaults = signal<GovernanceRoleDefaults | null>(null);
  readonly individualHistory = signal<readonly GovernanceProposal[]>([]);
  readonly roleDefaultHistory = signal<readonly GovernanceProposal[]>([]);
  readonly decisionHistory = signal<readonly GovernanceProposal[]>([]);
  readonly loadingDirectory = signal(false);
  readonly directoryStatus = signal<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
  readonly directoryError = signal('The staff directory could not be loaded.');
  reason = '';
  proposalReason = '';
  staffSearch = '';
  targetUserId: number | null = null;

  constructor() {
    this.searchStaff();
    this.refreshGovernance();
  }

  refreshGovernance(): void {
    const requestEpoch = this.authorizationEpoch;
    this.service.roleDefaults().subscribe({ next: value => { if (requestEpoch === this.authorizationEpoch) this.roleDefaults.set(value); }, error: error => this.handleGovernanceReadError(error) });
    this.service.history('individual').subscribe({ next: value => { if (requestEpoch === this.authorizationEpoch) this.individualHistory.set(value.results); }, error: error => this.handleGovernanceReadError(error) });
    this.service.history('role-defaults').subscribe({ next: value => { if (requestEpoch === this.authorizationEpoch) this.roleDefaultHistory.set(value.results); }, error: error => this.handleGovernanceReadError(error) });
    this.service.history('decisions').subscribe({ next: value => { if (requestEpoch === this.authorizationEpoch) this.decisionHistory.set(value.results); }, error: error => this.handleGovernanceReadError(error) });
  }

  pendingProposals(): GovernanceProposal[] {
    const proposals = [...this.individualHistory(), ...this.roleDefaultHistory()];
    return proposals.filter((proposal, index, all) => proposal.status === 'PENDING' && all.findIndex(item => item.public_id === proposal.public_id) === index);
  }

  roleDefaultStatus(entry: GovernanceRoleDefaults['role_defaults'][number]): string {
    const pending = this.roleDefaultHistory().find(proposal =>
      proposal.status === 'PENDING'
      && proposal.role_id === entry.role_id
      && proposal.capability === entry.capability,
    );
    if (pending) return `Pending ${this.actionLabel(pending.operation).toLowerCase()}`;
    return entry.is_enabled ? 'Current default' : 'Disabled default';
  }

  searchStaff(): void {
    const requestEpoch = this.authorizationEpoch;
    this.directoryStatus.set('loading');
    this.directoryError.set('The staff directory could not be loaded.');
    this.loadingDirectory.set(true);
    this.service.directory(this.staffSearch.trim()).pipe(finalize(() => this.loadingDirectory.set(false))).subscribe({
      next: value => {
        if (requestEpoch !== this.authorizationEpoch) return;
        this.staffDirectory.set(value.results);
        this.directoryStatus.set(value.results.length ? 'success' : 'empty');
      },
      error: error => {
        if (requestEpoch !== this.authorizationEpoch) return;
        this.staffDirectory.set([]);
        this.directoryStatus.set('error');
        this.directoryError.set(error.error?.detail ?? 'The staff directory could not be loaded.');
        if (error.status === 403) this.handleProtectedReadDenied();
      },
    });
  }

  selectStaff(userId: number): void {
    this.targetUserId = userId;
    this.loadTarget();
  }

  loadTarget(): void {
    if (!this.targetUserId || this.targetUserId < 1) return;
    const requestedTargetId = this.targetUserId;
    const requestEpoch = this.authorizationEpoch;
    this.loading.set(true);
    this.error.set(null);
    this.target.set(null);
    this.service.target(requestedTargetId).subscribe({
      next: value => { if (requestEpoch === this.authorizationEpoch) this.target.set(value); },
      error: error => {
        if (requestEpoch !== this.authorizationEpoch) return;
        if (error.status === 403) this.handleProtectedReadDenied();
        else this.showError(error);
      },
      complete: () => this.loading.set(false),
    });
  }

  capabilityEntries(detail: GovernanceTargetDetail): { code: string; state: GovernanceTargetDetail['capabilities'][string] }[] {
    return Object.entries(detail.capabilities).map(([code, state]) => ({ code, state }));
  }

  actionLabel(action: string): string {
    return action.replaceAll('_', ' ').toLowerCase().replace(/^./, value => value.toUpperCase());
  }

  beginApply(capability: string, operation: string): void {
    const detail = this.target();
    if (!detail || this.loading()) return;
    const state = detail.capabilities[capability];
    const executionMode = state?.permitted_action_modes[operation];
    if (!executionMode) return;
    this.reason = '';
    this.pendingAction.set({ capability, operation, targetUserId: detail.target_user_id, executionMode });
  }

  cancelApply(): void {
    if (!this.saving()) this.pendingAction.set(null);
  }

  confirmApply(): void {
    const action = this.pendingAction();
    const detail = this.target();
    const reason = this.reason.trim();
    if (!action || !detail || detail.target_user_id !== action.targetUserId || !reason) return;
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);
    const request = { operation: action.operation, capability: action.capability, target_user_id: action.targetUserId, reason };
    const mutation: Observable<unknown> = action.executionMode === 'DIRECT_SUPERUSER'
      ? this.service.applySuperuserAction(request)
      : action.executionMode === 'PROPOSAL'
        ? this.service.createProposal(request)
        : this.service.applyIndividualChange(request);
    mutation.subscribe({
      next: () => { this.pendingAction.set(null); this.feedback.set(action.executionMode === 'PROPOSAL' ? 'The proposal is awaiting independent approval.' : 'The capability change was applied and audited.'); this.loadTarget(); this.refreshGovernance(); },
      error: (error: { error?: { code?: string; detail?: string }; status?: number }) => this.showError(error),
      complete: () => this.saving.set(false),
    });
  }

  beginProposalAction(proposal: GovernanceProposal, action: 'approve' | 'reject' | 'cancel'): void {
    this.proposalReason = '';
    this.pendingProposalAction.set({ proposal, action });
  }

  beginRoleDefaultAction(entry: GovernanceRoleDefaults['role_defaults'][number], operation: string): void {
    if (!entry.execution_mode || !entry.permitted_actions.includes(operation) || this.saving()) return;
    this.reason = '';
    this.pendingRoleAction.set({ roleId: entry.role_id, roleCode: entry.role_code, capability: entry.capability, operation, executionMode: entry.execution_mode });
  }

  cancelProposalAction(): void {
    if (!this.saving()) this.pendingProposalAction.set(null);
  }

  confirmProposalAction(): void {
    const pending = this.pendingProposalAction();
    const reason = this.proposalReason.trim();
    if (!pending || !reason) return;
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.service.resolveProposal(pending.proposal.public_id, pending.action, reason).subscribe({
      next: value => { this.pendingProposalAction.set(null); this.feedback.set(`Proposal ${value.status.toLowerCase()}.`); this.refreshGovernance(); },
      error: error => this.showError(error),
      complete: () => this.saving.set(false),
    });
  }

  confirmRoleDefaultAction(): void {
    const action = this.pendingRoleAction();
    const reason = this.reason.trim();
    if (!action || !reason) return;
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);
    const mutation: Observable<unknown> = action.executionMode === 'DIRECT_SUPERUSER'
      ? this.service.applySuperuserAction({ operation: action.operation, capability: action.capability, role_id: action.roleId, reason })
      : this.service.createProposal({ operation: action.operation, capability: action.capability, role_id: action.roleId, reason });
    mutation.subscribe({
      next: () => {
        this.pendingRoleAction.set(null);
        this.feedback.set(action.executionMode === 'DIRECT_SUPERUSER' ? 'The role-default change was applied and audited.' : 'The role-default proposal is awaiting independent approval.');
        this.refreshGovernance();
      },
      error: (error: { error?: { code?: string; detail?: string }; status?: number }) => this.showError(error),
      complete: () => this.saving.set(false),
    });
  }

  capabilityName(capability: string): string {
    return capability.replaceAll('_', ' ').toLowerCase().replace(/^./, value => value.toUpperCase());
  }

  capabilityDescription(capability: string): string {
    const descriptions: Record<string, string> = {
      PERSON_CONTACT_READ: 'View approved contact details.',
      PERSON_DEMOGRAPHIC_READ: 'View approved demographic details.',
      PERSON_EXPORT: 'Export approved personal-data projections.',
      PERSON_RESTRICTED_ACCESS: 'Additional gate for explicitly approved exceptional workflows.',
      STAFF_CAPABILITY_ADMIN: 'Manage governed staff capability state.',
      PRIVACY_AUDIT_READ: 'Read privacy-audit projections.',
      LEGAL_HOLD_ADMIN: 'Manage legal-hold administration workflows.',
    };
    return descriptions[capability] ?? 'Governed privacy capability.';
  }

  effectiveSources(state: GovernanceTargetDetail['capabilities'][string]): string {
    return state.effective_explanation.sources.length
      ? state.effective_explanation.sources.map(source => this.actionLabel(source)).join(', ')
      : 'None';
  }

  historyItems(): GovernanceProposal[] {
    const seen = new Set<string>();
    return [...this.individualHistory(), ...this.roleDefaultHistory(), ...this.decisionHistory()]
      .filter(item => item.status !== 'PENDING')
      .filter(item => {
        if (seen.has(item.public_id)) return false;
        seen.add(item.public_id);
        return true;
      })
      .sort((left, right) => {
        const leftTimestamp = Date.parse(left.timestamp || left.created_at || '');
        const rightTimestamp = Date.parse(right.timestamp || right.created_at || '');
        return rightTimestamp - leftTimestamp;
      });
  }

  stateSummary(state: Record<string, unknown>): string {
    return Object.entries(state)
      .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
      .join(' Ã‚Â· ');
  }

  actionDescription(operation: string): string {
    const descriptions: Record<string, string> = {
      INDIVIDUAL_GRANT: 'Grant the capability to this staff member.',
      INDIVIDUAL_RESTORE: 'Restore a suspended individual capability.',
      INDIVIDUAL_SUSPEND: 'Suspend the current individual capability assignment.',
      INDIVIDUAL_REVOKE: 'Revoke the current individual capability assignment.',
      INDIVIDUAL_RESTRICT: 'Add an explicit restriction that overrides grants and role defaults.',
      INDIVIDUAL_UNRESTRICT: 'Remove the explicit restriction; suspended or revoked grants remain inactive.',
    };
    return descriptions[operation] ?? 'Change governed capability state.';
  }

  private showError(error: { error?: { code?: string; detail?: string }; status?: number }): void {
    const message = error.error?.code === 'PENDING_PROPOSAL_EXISTS'
      ? 'A pending proposal already exists for this target and capability.'
      : error.error?.detail ?? (error.status === 403 ? 'This action is not permitted.' : 'The governance request could not be completed.');
    this.error.set(message);
    this.loading.set(false);
    this.saving.set(false);
  }

  private handleGovernanceReadError(error: { status?: number; error?: { detail?: string } }): void {
    if (error.status === 403) {
      this.handleProtectedReadDenied();
      return;
    }
    this.showError(error);
  }

  private handleProtectedReadDenied(): void {
    if (this.revalidatingAuthorization) return;
    this.revalidatingAuthorization = true;
    this.clearProtectedState();

    const user = this.auth.currentUser();
    if (!user) {
      this.revalidatingAuthorization = false;
      void this.router.navigateByUrl('/login');
      return;
    }

    this.staffAccess.refresh(user).subscribe({
      next: () => {
        this.revalidatingAuthorization = false;
        if (!this.staffAccess.hasCapability('STAFF_CAPABILITY_ADMIN')) {
          void this.router.navigateByUrl('/access-denied');
        }
      },
      error: () => {
        this.revalidatingAuthorization = false;
        void this.router.navigateByUrl('/access-denied');
      },
    });
  }

  private clearProtectedState(): void {
    this.authorizationEpoch += 1;
    this.target.set(null);
    this.staffDirectory.set([]);
    this.roleDefaults.set(null);
    this.individualHistory.set([]);
    this.roleDefaultHistory.set([]);
    this.decisionHistory.set([]);
    this.pendingAction.set(null);
    this.pendingProposalAction.set(null);
    this.pendingRoleAction.set(null);
    this.saving.set(false);
    this.feedback.set(null);
  }
}
