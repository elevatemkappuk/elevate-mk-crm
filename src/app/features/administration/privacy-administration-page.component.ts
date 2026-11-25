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
  template: `
    <section class="workspace" aria-labelledby="privacy-admin-title">
      <p class="eyebrow">Privacy administration</p>
      <h2 id="privacy-admin-title">Staff capability governance</h2>
      <p class="intro">Review governed staff capability state without exposing Person contact or demographic data.</p>

      <form class="lookup" (ngSubmit)="searchStaff()">
        <label for="staff-search">Find staff</label>
        <div class="lookup-row">
          <input id="staff-search" name="staffSearch" type="search" [(ngModel)]="staffSearch" placeholder="Name" />
          <button type="submit" [disabled]="loadingDirectory()">{{ loadingDirectory() ? 'Searching...' : 'Search staff' }}</button>
        </div>
        @if (loadingDirectory()) { <p class="notice" role="status">Searching...</p> }
        @if (!loadingDirectory() && directoryStatus() === 'error') {
          <p class="error" role="alert">{{ directoryError() }}</p>
          <button type="button" (click)="searchStaff()">Retry staff search</button>
        }
        <div class="directory" aria-label="Staff directory">
          @for (staff of staffDirectory(); track staff.user_id) {
            <button class="staff-result" type="button" (click)="selectStaff(staff.user_id)" [disabled]="!staff.can_manage_privacy_permissions">
              <strong>{{ staff.display_name }}</strong>
              <span>User {{ staff.user_id }} · {{ staff.role_codes.join(', ') || 'No active CRM role' }} · {{ staff.eligible ? 'Eligible' : 'Not eligible' }}</span>
            </button>
          } @empty { @if (!loadingDirectory() && directoryStatus() === 'empty') { <span class="notice">No eligible staff matches.</span> } }
        </div>
      </form>

      <form class="lookup" (ngSubmit)="loadTarget()">
        <label for="target-user-id">Staff user ID (direct lookup)</label>
        <div class="lookup-row">
          <input id="target-user-id" name="targetUserId" type="number" min="1" required [(ngModel)]="targetUserId" />
          <button type="submit" [disabled]="loading()">{{ loading() ? 'Loading...' : 'Load access' }}</button>
        </div>
      </form>

      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (feedback()) { <p class="success" role="status">{{ feedback() }}</p> }
      @if (target(); as detail) {
        <section class="card" aria-labelledby="target-title">
          <h3 id="target-title">Target {{ detail.target_user_id }}</h3>
          <p>Person {{ detail.person_id }} · {{ detail.record_type }} · {{ detail.is_active ? 'Active' : 'Inactive' }}</p>
          <div class="roles" aria-label="Staff roles">
            @for (role of detail.staff_roles; track role.id) {
              <span [class.inactive]="!role.is_active">{{ role.code }}</span>
            }
          </div>
          <div class="capabilities">
            @for (entry of capabilityEntries(detail); track entry.code) {
              <article class="capability">
                <div>
                  <strong>{{ capabilityName(entry.code) }}</strong>
                  <small>{{ capabilityDescription(entry.code) }}</small>
                  <span>{{ entry.state.effective ? 'Effective' : 'Not effective' }}</span>
                  <span>Source: {{ effectiveSources(entry.state) }}</span>
                  <small>{{ entry.state.effective_explanation.reason }}</small>
                  @if (entry.state.effective_explanation.pending_change; as pending) {
                    <span class="notice">Pending {{ actionLabel(pending.operation).toLowerCase() }}; current access is unchanged.</span>
                  }
                  @if (entry.state.assignment_state) { <span>Individual assignment: {{ entry.state.assignment_state }}</span> }
                  @if (entry.state.restriction_active) { <span class="restricted">Restricted</span> }
                </div>
                <div class="actions">
                  @for (action of entry.state.permitted_actions; track action) {
                    <button type="button" (click)="beginApply(entry.code, action)" [disabled]="saving()">{{ actionLabel(action) }}</button>
                  }
                </div>
              </article>
            }
          </div>
        </section>
      }
      <section class="card" aria-labelledby="governance-overview-title">
        <h3 id="governance-overview-title">Governance overview</h3>
        @if (roleDefaults(); as defaults) {
          <p>Policy version {{ defaults.policy_version }}</p>
          <div class="history-list" aria-label="Role defaults">
            @for (entry of defaults.role_defaults; track entry.id) {
              <article class="history-row">
                <span><strong>{{ entry.role_code }}</strong> · {{ capabilityName(entry.capability) }} · {{ entry.is_enabled ? 'Enabled' : 'Disabled' }}</span>
                <span>{{ roleDefaultStatus(entry) }}</span>
                <div class="actions">
                  @for (action of entry.permitted_actions; track action) {
                    <button type="button" (click)="beginRoleDefaultAction(entry, action)" [disabled]="saving()">{{ actionLabel(action) }}</button>
                  }
                </div>
              </article>
            } @empty { <span class="notice">No role defaults returned.</span> }
          </div>
        }
        <h4>Pending proposals</h4>
        <div class="history-list">
          @for (proposal of pendingProposals(); track proposal.public_id) {
            <article class="history-row">
              <span><strong>{{ proposal.operation }}</strong> · {{ capabilityName(proposal.capability) }} · {{ proposal.target_user_id ? 'User ' + proposal.target_user_id : 'Role ' + proposal.role_code }}</span>
              <span>Expires {{ proposal.expires_at | date:'mediumDate' }}</span>
              <div class="actions">
                @for (action of proposal.permitted_actions; track action) {
                  <button type="button" (click)="beginProposalAction(proposal, action)" [disabled]="saving()">{{ actionLabel(action) }}</button>
                }
              </div>
            </article>
          } @empty { <span class="notice">No pending proposals.</span> }
        </div>
        <h4>Governance history</h4>
        <div class="history-list">
          @for (proposal of historyItems(); track proposal.public_id) {
            <article class="history-row">
              <strong>{{ actionLabel(proposal.operation) }} · {{ capabilityName(proposal.capability) }}</strong>
              <span>{{ proposal.target_label || (proposal.target_user_id ? 'User ' + proposal.target_user_id : 'Role ' + proposal.role_code) }} · Actor {{ proposal.actor_user_id ?? proposal.proposed_by_id }}</span>
              <span>{{ (proposal.timestamp || proposal.created_at) | date:'medium' }} · {{ proposal.status }} · {{ proposal.decision?.outcome || (proposal.superuser_operation ? 'Applied by superuser' : 'Recorded') }}</span>
              @if (proposal.proposed_state) { <small>Previous/proposed state: {{ stateSummary(proposal.proposed_state) }}</small> }
              @if (proposal.resulting_state) { <small>Resulting state: {{ stateSummary(proposal.resulting_state) }}</small> }
              @if (proposal.reason || proposal.decision?.reason) { <small>Reason: {{ proposal.decision?.reason || proposal.reason }}</small> }
            </article>
          }
          @empty { <span class="notice">No completed governance history.</span> }
        </div>
      </section>
      @if (pendingAction(); as action) {
        <app-confirmation-dialog
          [open]="true"
          [title]="'Confirm ' + actionLabel(action.operation)"
          [message]="'Target staff user ' + action.targetUserId + ' · ' + capabilityName(action.capability) + '. ' + actionDescription(action.operation) + ' ' + (action.executionMode === 'PROPOSAL' ? 'This request requires approval by another authorized administrator.' : 'This change is applied immediately and is audited.')"
          [confirmLabel]="action.executionMode === 'PROPOSAL' ? 'Submit proposal' : 'Apply change'"
          [busy]="saving()"
          [requireReason]="true"
          [reason]="reason"
          (reasonChanged)="reason = $event"
          (confirmed)="confirmApply()"
          (cancelled)="cancelApply()"
        />
      }
      @if (pendingRoleAction(); as action) {
        <app-confirmation-dialog
          [open]="true"
          [title]="'Confirm ' + actionLabel(action.operation)"
          [message]="'Role ' + action.roleCode + ' · ' + capabilityName(action.capability) + '. ' + (action.executionMode === 'DIRECT_SUPERUSER' ? 'This change is applied immediately through the audited superuser path.' : 'This role-default change requires independent approval and is recorded in governance history.')"
          [confirmLabel]="action.executionMode === 'DIRECT_SUPERUSER' ? 'Apply change' : 'Submit proposal'"
          [busy]="saving()"
          [requireReason]="true"
          [reason]="reason"
          (reasonChanged)="reason = $event"
          (confirmed)="confirmRoleDefaultAction()"
          (cancelled)="pendingRoleAction.set(null)"
        />
      }
      @if (pendingProposalAction(); as action) {
        <app-confirmation-dialog
          [open]="true"
          [title]="(action.action | titlecase) + ' proposal'"
          [message]="action.proposal.operation + ' · ' + capabilityName(action.proposal.capability)"
          confirmLabel="Confirm"
          [busy]="saving()"
          [requireReason]="true"
          [reason]="proposalReason"
          (reasonChanged)="proposalReason = $event"
          (confirmed)="confirmProposalAction()"
          (cancelled)="cancelProposalAction()"
        />
      }
      <p class="notice">The API remains authoritative. Changes are audited and may require a second administrator.</p>
    </section>
  `,
  styles: `
    .workspace { display: grid; gap: 1rem; padding: 1.5rem; border-radius: 1.25rem; border: 1px solid rgba(57, 47, 18, 0.08); background: rgba(255, 250, 244, 0.9); }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .14em; font-size: .75rem; color: #8b6519; }
    h2, h3 { margin: 0; color: #443117; }
    .intro, .notice, .card p { margin: 0; color: #6f5220; line-height: 1.6; }
    .lookup, .card { display: grid; gap: .75rem; padding: 1rem; border: 1px solid rgba(57, 47, 18, .12); border-radius: .9rem; background: #fffdf9; }
    .lookup-row { display: flex; gap: .75rem; flex-wrap: wrap; }
    input, button { min-height: 2.5rem; border-radius: .5rem; border: 1px solid #b69a66; padding: .5rem .75rem; font: inherit; }
    input { max-width: 12rem; }
    button { cursor: pointer; background: #443117; color: white; }
    button:disabled { cursor: wait; opacity: .6; }
    .roles, .actions { display: flex; gap: .5rem; flex-wrap: wrap; }
    .roles span, .restricted { padding: .25rem .5rem; border-radius: 999px; background: #eee3c9; color: #443117; font-size: .85rem; }
    .roles .inactive { opacity: .55; }
    .capabilities { display: grid; gap: .75rem; }
    .capability { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: .75rem; border-top: 1px solid rgba(57, 47, 18, .1); }
    .capability > div:first-child { display: grid; gap: .25rem; }
    .capability span { color: #6f5220; font-size: .85rem; }
    .restricted { color: #743f2b !important; background: #f4d9ce; }
    .error { padding: .75rem; color: #743f2b; background: #f4d9ce; border-radius: .5rem; }
    .success { padding: .75rem; color: #245b36; background: #e1f2e5; border-radius: .5rem; }
    .directory { display: grid; gap: .5rem; }
    .staff-result { display: grid; gap: .25rem; text-align: left; background: #fffdf9; color: #443117; }
    .staff-result span, small { color: #6f5220; font-size: .85rem; }
    .history-list { display: grid; gap: .5rem; }
    .history-row { display: grid; gap: .35rem; padding: .65rem; border-top: 1px solid rgba(57, 47, 18, .1); }
    @media (max-width: 700px) { .capability { align-items: stretch; flex-direction: column; } }
  `,
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
      .join(' · ');
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
