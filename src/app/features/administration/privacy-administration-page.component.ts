import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PrivacyAdministrationService } from './privacy-administration.service';
import { GovernanceTargetDetail } from './privacy-administration.types';

@Component({
  selector: 'app-privacy-administration-page',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="workspace" aria-labelledby="privacy-admin-title">
      <p class="eyebrow">Privacy administration</p>
      <h2 id="privacy-admin-title">Staff capability governance</h2>
      <p class="intro">Review governed staff capability state without exposing Person contact or demographic data.</p>

      <form class="lookup" (ngSubmit)="loadTarget()">
        <label for="target-user-id">Staff user ID</label>
        <div class="lookup-row">
          <input id="target-user-id" name="targetUserId" type="number" min="1" required [(ngModel)]="targetUserId" />
          <button type="submit" [disabled]="loading()">{{ loading() ? 'Loading...' : 'Load access' }}</button>
        </div>
      </form>

      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
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
                  <strong>{{ entry.code }}</strong>
                  <span>{{ entry.state.assignment_state || 'No individual assignment' }}</span>
                  @if (entry.state.restriction_active) { <span class="restricted">Restricted</span> }
                </div>
                <div class="actions">
                  @for (action of entry.state.permitted_actions; track action) {
                    <button type="button" (click)="apply(entry.code, action)" [disabled]="saving()">{{ actionLabel(action) }}</button>
                  }
                </div>
              </article>
            }
          </div>
        </section>
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
    @media (max-width: 700px) { .capability { align-items: stretch; flex-direction: column; } }
  `,
})
export class PrivacyAdministrationPageComponent {
  private readonly service = inject(PrivacyAdministrationService);
  readonly target = signal<GovernanceTargetDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  targetUserId: number | null = null;

  loadTarget(): void {
    if (!this.targetUserId || this.targetUserId < 1) return;
    this.loading.set(true);
    this.error.set(null);
    this.service.target(this.targetUserId).subscribe({
      next: value => this.target.set(value),
      error: error => this.showError(error),
      complete: () => this.loading.set(false),
    });
  }

  capabilityEntries(detail: GovernanceTargetDetail): { code: string; state: GovernanceTargetDetail['capabilities'][string] }[] {
    return Object.entries(detail.capabilities).map(([code, state]) => ({ code, state }));
  }

  actionLabel(action: string): string {
    return action.replaceAll('_', ' ').toLowerCase().replace(/^./, value => value.toUpperCase());
  }

  apply(capability: string, operation: string): void {
    if (!this.targetUserId) return;
    const reason = window.prompt('Required justification for this governed change:')?.trim() ?? '';
    if (!reason) return;
    this.saving.set(true);
    this.error.set(null);
    const request = { operation, capability, target_user_id: this.targetUserId, reason };
    const governedByProposal = ['INDIVIDUAL_GRANT', 'INDIVIDUAL_RESTORE', 'INDIVIDUAL_UNRESTRICT'].includes(operation);
    const mutation = governedByProposal
      ? this.service.createProposal(request)
      : this.service.applyIndividualChange(request);
    mutation.subscribe({
      next: () => this.loadTarget(),
      error: error => this.showError(error),
      complete: () => this.saving.set(false),
    });
  }

  private showError(error: { error?: { detail?: string }; status?: number }): void {
    this.error.set(error.error?.detail ?? (error.status === 403 ? 'This action is not permitted.' : 'The governance request could not be completed.'));
    this.loading.set(false);
    this.saving.set(false);
  }
}
