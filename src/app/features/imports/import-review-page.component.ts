import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { importEvidenceLabel } from '../../core/imports/import-evidence';
import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportReviewDetail, ImportReviewRecord } from '../../core/imports/import-reconciliation.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

@Component({
  selector: 'app-import-review-page',
  imports: [RouterLink, ConfirmationDialogComponent, StateMessageComponent, StatusBadgeComponent],
  template: `
    <section class="page">
      <a [routerLink]="['/imports', batchId]">Back to import</a>

      @if (loading()) {
        <app-state-message title="Loading review record" message="Retrieving the source record and proposed matches." />
      } @else if (error()) {
        <app-state-message title="Review record unavailable" [message]="error()!" tone="error" />
      } @else if (record()) {
        <header><h1>Identity review</h1><p>Compare the historical record with possible CRM matches before deciding.</p></header>
        <div class="compare">
          <section class="surface" aria-labelledby="source-title">
            <h2 id="source-title">Source record</h2>
            <dl class="source-details">
              <div><dt>Name</dt><dd>{{ value('first_name') }} {{ value('last_name') }}</dd></div>
              <div><dt>Email</dt><dd>{{ value('email') }}</dd></div>
              <div><dt>Mobile</dt><dd>{{ value('mobile') }}</dd></div>
              <div><dt>Location</dt><dd>{{ value('location') }}</dd></div>
              <div><dt>Job title</dt><dd>{{ value('job_title') }}</dd></div>
              <div><dt>Industry</dt><dd>{{ value('industry') }}</dd></div>
              <div><dt>LinkedIn</dt><dd>{{ value('linkedin_url') }}</dd></div>
            </dl>
            <div class="reason"><h3>Review reason</h3><p>{{ importEvidenceLabel(record()!.resolution_reason) }}</p></div>
          </section>
          <section class="surface" aria-labelledby="candidates-title">
            <h2 id="candidates-title">Possible CRM matches</h2>
            <fieldset class="candidates" aria-labelledby="candidates-title" [disabled]="saving() || identityOverrideConfirmationOpen()">
            @for (candidate of record()!.candidates; track candidate.id) {
              <div class="candidate" [class.selected]="selectedId() === candidate.id">
                <label class="candidate-select">
                  <input class="crm-check" type="radio" name="candidate" [value]="candidate.id" [checked]="selectedId() === candidate.id" (change)="selectedId.set(candidate.id)" [attr.aria-describedby]="'evidence-' + candidate.id" />
                  <span><strong>{{ candidate.first_name }} {{ candidate.last_name }}</strong><span class="selection-state">{{ selectedId() === candidate.id ? 'Selected match' : 'Select match' }}</span></span>
                </label>
                @if (candidate.record_state === 'archived') { <app-status-badge label="Archived person" tone="muted" /> }
                <dl><div><dt>Email</dt><dd>{{ candidate.primary_email || 'Not provided' }}</dd></div><div><dt>Mobile</dt><dd>{{ candidate.mobile || 'Not provided' }}</dd></div></dl>
                <div class="evidence" [id]="'evidence-' + candidate.id">
                  @for (code of candidate.matched_on; track code) { <app-status-badge [label]="importEvidenceLabel(code)" tone="info" /> }
                  @for (code of candidate.contradiction_codes; track code) { <app-status-badge [label]="importEvidenceLabel(code)" tone="warning" /> }
                </div>
                <a [routerLink]="['/people', candidate.id]" [attr.aria-label]="'View ' + candidate.first_name + ' ' + candidate.last_name">View Person <span aria-hidden="true">&rarr;</span></a>
              </div>
            } @empty { <p>No candidate CRM People are available for this record.</p> }
            </fieldset>
          </section>
        </div>
        <section class="surface decision" aria-labelledby="decision-title" [attr.aria-busy]="saving()">
          <h2 id="decision-title">Decision</h2>
          <fieldset [disabled]="saving() || identityOverrideConfirmationOpen()" aria-describedby="decision-error">
            <legend>What should happen with this record?</legend>
            <div class="choices">
              <label class="choice" [class.selected]="decision() === 'same'">
                <input class="crm-check" type="radio" name="decision" value="same" [checked]="decision() === 'same'" (change)="decision.set('same')" />
                <span><strong>Same person</strong><small>Link this historical record to the selected CRM Person.</small></span>
              </label>
              <label class="choice" [class.selected]="decision() === 'different'">
                <input class="crm-check" type="radio" name="decision" value="different" [checked]="decision() === 'different'" (change)="decision.set('different')" />
                <span><strong>Different person</strong><small>Keep this record separate. A new CRM Person will be created later when this import is added to the CRM.</small></span>
              </label>
            </div>
          </fieldset>
          <div id="decision-error">@if (actionError()) { <p class="error" role="alert">{{ actionError() }}</p> }</div>
          <div class="decision-footer">
          <p class="decision-help" id="decision-help" aria-live="polite">{{ decision() === 'same' ? (selectedId() ? 'Confirm to link this record to the selected CRM Person.' : 'Select a possible CRM match before confirming.') : decision() === 'different' ? 'This records a future create decision. It does not create a Person now.' : 'Choose how this historical record should be resolved.' }}</p>
          <div class="actions"><button type="button" class="crm-button confirm-decision" [class.ready]="decision() === 'different' || (decision() === 'same' && selectedId() !== null)" [disabled]="!decision() || (decision() === 'same' && selectedId() === null) || saving() || identityOverrideConfirmationOpen()" aria-describedby="decision-help decision-error" (click)="confirmDecision()">{{ saving() ? 'Saving...' : decision() === 'same' ? 'Confirm same person' : decision() === 'different' ? 'Confirm different person' : 'Confirm decision' }}</button></div>
          </div>
        </section>
      }
      <app-confirmation-dialog
        [open]="identityOverrideConfirmationOpen()"
        title="Create a separate CRM Person?"
        [message]="identityOverrideConfirmationMessage()"
        confirmLabel="Create separate Person"
        [busy]="saving()"
        (cancelled)="cancelIdentityOverrideConfirmation()"
        (confirmed)="confirmDifferentPerson()"
      />
    </section>
  `,
  styleUrl: './import-review-page.component.scss',
})
export class ImportReviewPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ImportReconciliationService);

  readonly batchId = Number(this.route.snapshot.paramMap.get('id'));
  readonly recordId = Number(this.route.snapshot.paramMap.get('recordId'));
  readonly record = signal<ImportReviewDetail | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly decision = signal<'same' | 'different' | null>(null);
  readonly selectedId = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly identityOverrideConfirmationOpen = signal(false);
  readonly importEvidenceLabel = importEvidenceLabel;

  constructor() { this.load(); }

  value(key: keyof ImportReviewRecord['source']): string {
    return this.record()?.source[key] ?? 'Not provided';
  }

  confirmDecision(): void {
    if (this.saving() || this.identityOverrideConfirmationOpen()) return;
    if (this.decision() === 'same') this.samePerson();
    else if (this.decision() === 'different') this.differentPerson();
  }

  samePerson(): void {
    const personId = this.selectedId();
    if (personId === null || !this.record() || this.saving()) return;
    this.resolve(this.service.resolveSamePerson(this.batchId, this.recordId, personId));
  }

  differentPerson(): void {
    if (!this.record() || this.saving()) return;
    if (this.requiresStrongIdentityOverride()) {
      this.identityOverrideConfirmationOpen.set(true);
      return;
    }
    this.resolve(this.service.resolveDifferentPerson(this.batchId, this.recordId));
  }

  confirmDifferentPerson(): void {
    if (!this.record() || this.saving()) return;
    this.identityOverrideConfirmationOpen.set(false);
    this.resolve(this.service.resolveDifferentPerson(this.batchId, this.recordId, true));
  }

  cancelIdentityOverrideConfirmation(): void {
    this.identityOverrideConfirmationOpen.set(false);
  }

  requiresStrongIdentityOverride(): boolean {
    return this.record()?.candidates.some((candidate) => candidate.matched_on.includes('EXACT_EMAIL')) ?? false;
  }

  identityOverrideConfirmationMessage(): string {
    const includesMobile = this.record()?.candidates.some((candidate) => candidate.matched_on.includes('EXACT_MOBILE'));
    return includesMobile
      ? 'This email address and mobile number are already associated with another CRM Person. Only continue if you are sure these records belong to different people.'
      : 'This email address is already associated with another CRM Person. Only continue if you are sure these records belong to different people. The new Person may share the same email address.';
  }

  private load(): void {
    this.loading.set(true);
    this.service.getReviewRecord(this.batchId, this.recordId).subscribe({
      next: (record) => { this.record.set(record); this.loading.set(false); },
      error: () => { this.error.set('This review record is no longer available.'); this.loading.set(false); },
    });
  }

  private resolve(request: Observable<ImportReviewRecord>): void {
    this.saving.set(true);
    this.actionError.set(null);
    request.subscribe({
      next: () => void this.router.navigate(['/imports', this.batchId]),
      error: (error: { status?: number; error?: { detail?: string } }) => {
        const detail = error.error?.detail;
        if (detail) {
          this.actionError.set(detail);
        } else if (error.status === 409) {
          this.actionError.set('This record was already resolved. The review queue has been refreshed.');
          void this.router.navigate(['/imports', this.batchId]);
        } else {
          this.actionError.set('The review decision could not be saved right now.');
        }
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }
}
