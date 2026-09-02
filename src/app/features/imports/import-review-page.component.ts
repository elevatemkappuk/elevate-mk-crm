import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { importEvidenceLabel } from '../../core/imports/import-evidence';
import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportReviewDetail, ImportReviewRecord } from '../../core/imports/import-reconciliation.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

@Component({
  selector: 'app-import-review-page',
  imports: [RouterLink, ConfirmationDialogComponent, StateMessageComponent],
  template: `
    <section class="page">
      <a [routerLink]="['/imports', batchId]">Back to review queue</a>

      @if (loading()) {
        <app-state-message title="Loading review record" message="Retrieving the source record and proposed matches." />
      } @else if (error()) {
        <app-state-message title="Review record unavailable" [message]="error()!" tone="error" />
      } @else if (record()) {
        <div class="compare">
          <article>
            <h3>Source record</h3>
            <strong>{{ value('first_name') }} {{ value('last_name') }}</strong>
            <p>{{ value('email') }}<br />{{ value('mobile') }}<br />{{ value('location') }}<br />{{ value('job_title') }}</p>
            <p class="reason">{{ importEvidenceLabel(record()!.resolution_reason) }}</p>
          </article>

          <article>
            <h3>Possible CRM match</h3>
            @for (candidate of record()!.candidates; track candidate.id) {
              <label class="candidate" [class.selected]="selectedId() === candidate.id">
                <input type="radio" name="candidate" [checked]="selectedId() === candidate.id" (change)="selectedId.set(candidate.id)" />
                <span>
                  <strong>{{ candidate.first_name }} {{ candidate.last_name }}</strong>
                  @if (candidate.record_state === 'archived') { <em>Archived person</em> }
                  <br />{{ candidate.primary_email }}<br />{{ candidate.mobile }}
                  <small>
                    @for (code of candidate.matched_on; track code) { <span>Match: {{ importEvidenceLabel(code) }}</span> }
                    @for (code of candidate.contradiction_codes; track code) { <span>Conflict: {{ importEvidenceLabel(code) }}</span> }
                  </small>
                </span>
              </label>
            }
          </article>
        </div>

        @if (actionError()) { <p class="error" role="alert">{{ actionError() }}</p> }
        <div class="actions">
          <button type="button" [disabled]="!selectedId() || saving()" (click)="samePerson()">{{ saving() ? 'Saving...' : 'Same person' }}</button>
          <button type="button" class="secondary" [disabled]="saving()" (click)="differentPerson()">Different person</button>
        </div>
        <p class="hint">Different person records a future create decision. It does not create a Person now.</p>
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
  styles: `
    .page { display: grid; gap: 1rem; }
    .compare { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .compare article { padding: 1rem; border: 1px solid #dce5ea; border-radius: 1rem; background: #fff; }
    h3, p { margin: 0; } h3 { margin-bottom: 0.75rem; color: #173248; }
    .candidate { display: flex; gap: 0.7rem; padding: 0.8rem 0; cursor: pointer; }
    .candidate + .candidate { border-top: 1px solid #e6edf0; }
    .candidate.selected { background: #eef7fa; }
    .candidate input { margin-top: 0.2rem; }
    em { margin-left: 0.4rem; color: #7c491d; font-size: 0.75rem; font-style: normal; font-weight: 700; }
    small { display: grid; gap: 0.2rem; margin-top: 0.35rem; color: #4d697a; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.7rem; }
    .actions button { border: 0; border-radius: 999px; padding: 0.75rem 1rem; background: #18566f; color: #fff; font: inherit; font-weight: 700; }
    .actions .secondary { background: #e5eef2; color: #173248; }
    .actions button:disabled { cursor: not-allowed; opacity: 0.55; }
    .error { color: #9b1c1c; font-weight: 600; }.hint, .reason { color: #526f81; }
    @media (max-width: 700px) { .compare { grid-template-columns: 1fr; } }
  `,
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
  readonly selectedId = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly identityOverrideConfirmationOpen = signal(false);
  readonly importEvidenceLabel = importEvidenceLabel;

  constructor() { this.load(); }

  value(key: keyof ImportReviewRecord['source']): string {
    return this.record()?.source[key] ?? 'Not provided';
  }

  samePerson(): void {
    const personId = this.selectedId();
    if (personId === null || !this.record()) return;
    this.resolve(this.service.resolveSamePerson(this.batchId, this.recordId, personId));
  }

  differentPerson(): void {
    if (!this.record()) return;
    if (this.requiresStrongIdentityOverride()) {
      this.identityOverrideConfirmationOpen.set(true);
      return;
    }
    this.resolve(this.service.resolveDifferentPerson(this.batchId, this.recordId));
  }

  confirmDifferentPerson(): void {
    if (!this.record()) return;
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
