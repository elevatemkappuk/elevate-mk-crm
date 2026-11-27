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

type PrivacyAdministrationTab = 'staff-permissions' | 'role-defaults' | 'approval-requests' | 'governance-history';

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
  readonly pendingRoleAction = signal<{ roleId: number; roleCode: string; capability: string; operation: string; executionMode: 'PROPOSAL' | 'DIRECT_SUPERUSER'; currentEnabled: boolean } | null>(null);
  readonly staffDirectory = signal<readonly GovernanceStaffSummary[]>([]);
  readonly roleDefaults = signal<GovernanceRoleDefaults | null>(null);
  readonly individualHistory = signal<readonly GovernanceProposal[]>([]);
  readonly roleDefaultHistory = signal<readonly GovernanceProposal[]>([]);
  readonly decisionHistory = signal<readonly GovernanceProposal[]>([]);
  readonly selectedProposal = signal<GovernanceProposal | null>(null);
  readonly activeTab = signal<PrivacyAdministrationTab>('staff-permissions');
  readonly openCapabilityMenu = signal<string | null>(null);
  readonly loadingDirectory = signal(false);
  readonly directoryStatus = signal<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
  readonly directoryError = signal('The staff directory could not be loaded.');
  readonly governanceLoading = signal(false);
  readonly governanceReadError = signal(false);
  private governanceResponseCount = 0;
  reason = '';
  proposalReason = '';
  staffSearch = '';
  targetUserId: number | null = null;

  selectTab(tab: PrivacyAdministrationTab): void {
    this.activeTab.set(tab);
  }

  backToStaffDirectory(): void {
    this.target.set(null);
    this.openCapabilityMenu.set(null);
    this.error.set(null);
  }

  toggleCapabilityMenu(capability: string): void {
    this.openCapabilityMenu.update(current => current === capability ? null : capability);
  }

  closeCapabilityMenu(): void {
    this.openCapabilityMenu.set(null);
  }

  constructor() {
    this.searchStaff();
    this.refreshGovernance();
  }

  refreshGovernance(): void {
    const requestEpoch = this.authorizationEpoch;
    this.governanceResponseCount = 0;
    this.governanceLoading.set(true);
    this.governanceReadError.set(false);
    const markResponse = () => {
      if (requestEpoch !== this.authorizationEpoch) return;
      this.governanceResponseCount += 1;
      if (this.governanceResponseCount === 4) this.governanceLoading.set(false);
    };
    this.service.roleDefaults().subscribe({ next: value => { if (requestEpoch === this.authorizationEpoch) this.roleDefaults.set(value); markResponse(); }, error: error => { markResponse(); this.handleGovernanceReadError(error); } });
    this.service.history('individual').subscribe({ next: value => { if (requestEpoch === this.authorizationEpoch) this.individualHistory.set(value.results); markResponse(); }, error: error => { markResponse(); this.handleGovernanceReadError(error); } });
    this.service.history('role-defaults').subscribe({ next: value => { if (requestEpoch === this.authorizationEpoch) this.roleDefaultHistory.set(value.results); markResponse(); }, error: error => { markResponse(); this.handleGovernanceReadError(error); } });
    this.service.history('decisions').subscribe({ next: value => { if (requestEpoch === this.authorizationEpoch) this.decisionHistory.set(value.results); markResponse(); }, error: error => { markResponse(); this.handleGovernanceReadError(error); } });
  }

  pendingProposals(): GovernanceProposal[] {
    const proposals = [...this.individualHistory(), ...this.roleDefaultHistory()];
    return proposals.filter((proposal, index, all) => proposal.status === 'PENDING' && all.findIndex(item => item.public_id === proposal.public_id) === index);
  }

  selectProposal(proposal: GovernanceProposal): void {
    this.selectedProposal.set(proposal);
  }

  backToApprovalRequests(): void {
    this.selectedProposal.set(null);
  }

  activateProposalRow(event: KeyboardEvent, proposal: GovernanceProposal): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.selectProposal(proposal);
  }

  proposalTargetLabel(proposal: GovernanceProposal): string {
    return proposal.target_user_id ? this.staffDisplayName(proposal.target_user_id) : this.roleName(proposal.role_code || '');
  }

  proposalTargetType(proposal: GovernanceProposal): string {
    return proposal.target_user_id ? 'Individual permission' : 'Role default';
  }

  proposalStateLabel(state: Record<string, unknown> | null | undefined): string {
    if (!state) return 'Not provided';
    const values: string[] = [];
    if (typeof state['enabled'] === 'boolean') values.push(state['enabled'] ? 'Enabled' : 'Disabled');
    if (typeof state['effective'] === 'boolean') values.push(state['effective'] ? 'Allowed' : 'Not granted');
    if (typeof state['restriction_active'] === 'boolean' && state['restriction_active']) values.push('Restricted');
    if (typeof state['assignment_state'] === 'string') values.push(this.actionLabel(state['assignment_state']));
    return values.length ? values.join(' · ') : 'Recorded state';
  }

  proposalCurrentState(proposal: GovernanceProposal): string {
    return proposal.status === 'PENDING' ? 'Current permission remains unchanged until approval.' : this.proposalStateLabel(proposal.resulting_state);
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

  readonly roleDefaultRoles = ['CRM_ADMIN', 'CRM_MANAGER', 'CRM_VIEWER'] as const;
  readonly roleDefaultPermissionOrder = [
    'PERSON_CONTACT_READ',
    'PERSON_DEMOGRAPHIC_READ',
    'PERSON_EXPORT',
    'PERSON_RESTRICTED_ACCESS',
    'PRIVACY_AUDIT_READ',
    'STAFF_CAPABILITY_ADMIN',
    'LEGAL_HOLD_ADMIN',
  ] as const;

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

  activateStaffRow(event: KeyboardEvent, staff: GovernanceStaffSummary): void {
    if (!staff.can_manage_privacy_permissions) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.selectStaff(staff.user_id);
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

  orderedCapabilityEntries(detail: GovernanceTargetDetail): { code: string; state: GovernanceTargetDetail['capabilities'][string] }[] {
    const order = [
      'PERSON_CONTACT_READ',
      'PERSON_DEMOGRAPHIC_READ',
      'PERSON_EXPORT',
      'PERSON_RESTRICTED_ACCESS',
      'PRIVACY_AUDIT_READ',
      'STAFF_CAPABILITY_ADMIN',
      'LEGAL_HOLD_ADMIN',
    ];
    const rank = new Map(order.map((code, index) => [code, index]));
    return this.capabilityEntries(detail).sort((left, right) => (rank.get(left.code) ?? order.length) - (rank.get(right.code) ?? order.length));
  }

  orderedRoleDefaults(defaults: GovernanceRoleDefaults['role_defaults']): GovernanceRoleDefaults['role_defaults'] {
    const rank = new Map<string, number>(this.roleDefaultPermissionOrder.map((code, index) => [code, index]));
    return [...defaults].sort((left, right) => (rank.get(left.capability) ?? this.roleDefaultPermissionOrder.length) - (rank.get(right.capability) ?? this.roleDefaultPermissionOrder.length));
  }

  roleDefaultEntry(defaults: GovernanceRoleDefaults, roleCode: string, capability: string): GovernanceRoleDefaults['role_defaults'][number] | null {
    return defaults.role_defaults.find(entry => entry.role_code === roleCode && entry.capability === capability) ?? null;
  }

  roleDefaultPending(roleCode: string, capability: string): GovernanceProposal | null {
    return this.roleDefaultHistory().find(proposal => proposal.status === 'PENDING' && proposal.role_code === roleCode && proposal.capability === capability) ?? null;
  }

  roleDefaultAction(entry: GovernanceRoleDefaults['role_defaults'][number] | null): string | null {
    return entry?.permitted_actions[0] ?? null;
  }

  roleDefaultIconPath(entry: GovernanceRoleDefaults['role_defaults'][number]): string {
    return entry.is_enabled ? 'M5 12.5 9.5 17 19 7.5' : 'M6 12h12';
  }

  roleDefaultCellLabel(roleCode: string, capability: string, entry: GovernanceRoleDefaults['role_defaults'][number] | null, pending: GovernanceProposal | null): string {
    const role = this.roleName(roleCode);
    const permission = this.capabilityName(capability);
    if (!entry) return `${role}, ${permission}: unavailable in the current role-default response`;
    const current = entry.is_enabled ? 'enabled by default' : 'disabled by default';
    if (pending) return `${role}, ${permission}: ${current}; pending ${this.actionLabel(pending.operation).toLowerCase()}`;
    const action = this.roleDefaultAction(entry);
    return `${role}, ${permission}: ${current}${action ? `; ${this.actionLabel(action)}` : '; read only'}`;
  }

  roleDefaultActionTitle(operation: string): string {
    return operation === 'ROLE_DEFAULT_ENABLE' ? 'Enable permission by default.' : 'Disable permission by default.';
  }

  roleDefaultActionMessage(action: { roleCode: string; capability: string; currentEnabled: boolean; operation: string; executionMode: 'PROPOSAL' | 'DIRECT_SUPERUSER' }): string {
    const current = action.currentEnabled ? 'enabled by default' : 'disabled by default';
    const proposed = action.operation === 'ROLE_DEFAULT_ENABLE' ? 'enabled by default' : 'disabled by default';
    const approval = action.executionMode === 'DIRECT_SUPERUSER'
      ? 'This change is applied immediately through the audited superuser path.'
      : 'This change requires independent approval and is recorded in governance history.';
    return `${this.roleName(action.roleCode)} / ${this.capabilityName(action.capability)} is currently ${current} and will be ${proposed}. Role defaults affect inherited permissions; individual grants and restrictions remain separate. ${approval}`;
  }

  actionLabel(action: string): string {
    const labels: Record<string, string> = {
      INDIVIDUAL_GRANT: 'Grant access',
      INDIVIDUAL_RESTRICT: 'Restrict access',
      INDIVIDUAL_REVOKE: 'Revoke access',
      INDIVIDUAL_UNRESTRICT: 'Remove restriction',
      INDIVIDUAL_SUSPEND: 'Suspend access',
      INDIVIDUAL_RESTORE: 'Restore access',
      ROLE_DEFAULT_ENABLE: 'Enable by default',
      ROLE_DEFAULT_DISABLE: 'Disable by default',
      approve: 'Approve',
      reject: 'Reject',
      cancel: 'Cancel',
    };
    return labels[action] ?? action.replaceAll('_', ' ').toLowerCase().replace(/^./, value => value.toUpperCase());
  }

  actionIconPath(action: string): string {
    if (action.includes('REVOKE')) return 'M6 7h12M9 7V4h6v3m-8 0 1 13h8l1-13';
    if (action.includes('UNRESTRICT')) return 'M7 10V8a5 5 0 0 1 9-3m1 5v2m-12-2h14v10H5V10Z';
    if (action.includes('RESTRICT')) return 'M7 10V8a5 5 0 0 1 10 0v2m-12 0h14v10H5V10Z';
    if (action.includes('SUSPEND')) return 'M8 5v14M16 5v14';
    if (action.includes('RESTORE')) return 'M5 12a7 7 0 1 0 2-5m-2 0V3m0 4h4';
    if (action.includes('GRANT') || action.includes('ENABLE') || action === 'approve') return 'M5 12h14m-6-6 6 6-6 6';
    return 'M5 12h14';
  }

  actionTone(action: string): 'positive' | 'warning' | 'destructive' | 'neutral' {
    if (action.includes('GRANT') || action.includes('RESTORE') || action.includes('UNRESTRICT') || action.includes('ENABLE') || action === 'approve') return 'positive';
    if (action.includes('SUSPEND')) return 'warning';
    if (action.includes('RESTRICT') || action.includes('REVOKE') || action === 'reject') return 'destructive';
    return 'neutral';
  }

  capabilityName(capability: string): string {
    const names: Record<string, string> = {
      PERSON_CONTACT_READ: 'View contact information',
      PERSON_DEMOGRAPHIC_READ: 'View demographic information',
      PERSON_EXPORT: 'Export People information',
      PERSON_RESTRICTED_ACCESS: 'Exceptional restricted access',
      PRIVACY_AUDIT_READ: 'View privacy audit history',
      STAFF_CAPABILITY_ADMIN: 'Manage staff permissions',
      LEGAL_HOLD_ADMIN: 'Manage legal holds',
    };
    return names[capability] ?? capability.replaceAll('_', ' ').toLowerCase().replace(/^./, value => value.toUpperCase());
  }

  roleName(roleCode: string): string {
    const names: Record<string, string> = {
      CRM_ADMIN: 'CRM Administrator',
      CRM_MANAGER: 'CRM Manager',
      CRM_VIEWER: 'CRM Viewer',
    };
    return names[roleCode] ?? roleCode.replaceAll('_', ' ');
  }

  roleNames(roleCodes: readonly string[]): string {
    return roleCodes.length ? roleCodes.map(role => this.roleName(role)).join(', ') : 'No active CRM role';
  }

  initials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? '?').toUpperCase();
  }

  staffDisplayName(userId: number): string {
    return this.staffDirectory().find(staff => staff.user_id === userId)?.display_name ?? `Staff user ${userId}`;
  }

  accessLabel(state: GovernanceTargetDetail['capabilities'][string]): string {
    if (state.restriction_active) return 'Restricted';
    if (state.assignment_state === 'SUSPENDED') return 'Suspended';
    if (state.assignment_state === 'REVOKED') return 'Revoked';
    if (state.effective) return 'Allowed';
    return 'Not granted';
  }

  pendingCapabilityAction(capability: string): GovernanceProposal | null {
    const targetUserId = this.target()?.target_user_id;
    return [...this.individualHistory(), ...this.roleDefaultHistory()].find(proposal =>
      proposal.status === 'PENDING'
      && proposal.target_user_id === targetUserId
      && proposal.capability === capability,
    ) ?? null;
  }

  pendingCapabilityLabel(capability: string): string | null {
    const pending = this.pendingCapabilityAction(capability);
    if (!pending) return null;
    return pending.operation === 'INDIVIDUAL_UNRESTRICT' ? 'Removal pending approval' : `${this.actionLabel(pending.operation)} pending approval`;
  }

  isPendingCapabilityAction(capability: string, action: string): boolean {
    return this.pendingCapabilityAction(capability)?.operation === action;
  }

  sourceLabel(source: string): string {
    const labels: Record<string, string> = {
      ROLE_DEFAULT: 'Inherited from role',
      INDIVIDUAL_GRANT: 'Individually granted',
      SUPERUSER: 'Django superuser authority',
    };
    return labels[source] ?? this.actionLabel(source);
  }

  permissionExplanation(state: GovernanceTargetDetail['capabilities'][string]): string | null {
    if (state.effective_explanation.pending_change) {
      return `Pending ${this.actionLabel(state.effective_explanation.pending_change.operation).toLowerCase()}; current access is unchanged.`;
    }
    if (state.restriction_active || state.assignment_state === 'SUSPENDED' || state.assignment_state === 'REVOKED') {
      return state.effective_explanation.reason;
    }
    return null;
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
    this.pendingRoleAction.set({ roleId: entry.role_id, roleCode: entry.role_code, capability: entry.capability, operation, executionMode: entry.execution_mode, currentEnabled: entry.is_enabled });
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
      ? state.effective_explanation.sources.map(source => this.sourceLabel(source)).join(', ')
      : '—';
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
      .join(' / ');
  }

  actionDescription(operation: string): string {
    const descriptions: Record<string, string> = {
      INDIVIDUAL_GRANT: 'Grant this permission to the staff member.',
      INDIVIDUAL_RESTORE: 'Restore a suspended permission.',
      INDIVIDUAL_SUSPEND: 'Suspend this permission.',
      INDIVIDUAL_REVOKE: 'Revoke this permission.',
      INDIVIDUAL_RESTRICT: 'Add a restriction that overrides grants and role defaults.',
      INDIVIDUAL_UNRESTRICT: 'Remove the restriction; suspended or revoked grants remain inactive.',
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
    this.governanceReadError.set(true);
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
    this.selectedProposal.set(null);
    this.saving.set(false);
    this.feedback.set(null);
  }
}
