import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { importResolutionLabel } from '../../core/imports/import-resolution-label';
import {
  importBatchStatusLabel,
  isReviewableImportBatch,
} from '../../core/imports/import-batch-status';
import type { ImportBatchStatus } from '../../core/imports/import-batch-status';
import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { AuthoritativeImportResult, ImportBatchDetail, ImportRecordPreview, ImportReviewRecord, PaginatedImportRecordPreview } from '../../core/imports/import-reconciliation.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

@Component({
  selector: 'app-import-batch-page',
  imports: [DatePipe, RouterLink, ConfirmationDialogComponent, StateMessageComponent, StatusBadgeComponent],
  template: `
    <section class="page">
      <a routerLink="/imports">Back to Historical Imports</a>
      @if (batchLoading()) {
        <app-state-message title="Loading historical import" message="Retrieving import summary." />
      } @else if (batchError()) {
        <app-state-message title="Historical import unavailable" [message]="batchError()!" tone="error" />
      } @else if (batch(); as currentBatch) {
        <header>
          <div class="header-heading"><h1>{{ currentBatch.source_filename }}</h1><app-status-badge [label]="statusLabel(currentBatch.status)" [tone]="statusTone(currentBatch.status)" /></div>
          <p class="meta">{{ sourceLabel(currentBatch.source_type) }} <span aria-hidden="true">&middot;</span> <time [attr.datetime]="currentBatch.created_at">{{ currentBatch.created_at | date: 'mediumDate' }}</time></p>
          <dl class="summary" aria-label="Import resolution summary">
            <div><dt>Records</dt><dd>{{ currentBatch.total_count }}</dd></div><div><dt>Auto matched</dt><dd>{{ currentBatch.auto_match_count }}</dd></div><div><dt>New people</dt><dd>{{ currentBatch.new_person_count }}</dd></div><div><dt>Review required</dt><dd>{{ currentBatch.review_required_count }}</dd></div><div><dt>Invalid</dt><dd>{{ currentBatch.invalid_count }}</dd></div><div><dt>Imported</dt><dd>{{ currentBatch.committed_count }}</dd></div>
          </dl>
        </header>
        <section class="batch-message" [attr.data-tone]="statusTone(currentBatch.status)" aria-live="polite">
          <h2>{{ batchMessageTitle(currentBatch) }}</h2><p>{{ batchMessage(currentBatch) }}</p>
          @if (importError()) { <p class="import-error" role="alert">{{ importError() }}</p> }
          @if (canAnalyze()) {
            <div class="batch-actions"><button type="button" class="crm-button import-primary" [disabled]="analyzing()" (click)="analyzeBuyers()">{{ analyzing() ? 'Analyzing buyers...' : 'Analyze buyers' }}</button>@if (analyzing()) { <span class="importing" aria-live="polite">Analyzing buyers...</span> }</div>
          }
          @if (canImport()) {
            <div class="batch-actions">
              <button type="button" class="crm-button import-primary" [disabled]="importing()" (click)="openImportConfirmation()">
                {{ importing() ? 'Adding to CRM...' : 'Add to CRM' }}
              </button>
              @if (importing()) { <span class="importing" aria-live="polite">Adding to CRM...</span> }
            </div>
          }
        </section>
        @if (importResult(); as result) {
          <section class="import-success" aria-live="polite" aria-labelledby="import-complete-title">
            <h2 id="import-complete-title">Added to CRM</h2>
            <p>The records were added to the CRM successfully.</p>
            <dl class="result-summary">
              <div><dt>Processed</dt><dd>{{ result.processed_count }} {{ countLabel(result.processed_count, 'record') }}</dd></div>
              <div><dt>People created</dt><dd>{{ result.people_created_count }} {{ countLabel(result.people_created_count, 'Person', 'People') }}</dd></div>
              <div><dt>People matched</dt><dd>{{ result.people_matched_count }} {{ countLabel(result.people_matched_count, 'Person', 'People') }}</dd></div>
              @if (currentBatch.source_type !== 'EVENTBRITE') {
                <div><dt>Memberships created</dt><dd>{{ result.memberships_created_count ?? 0 }} {{ countLabel(result.memberships_created_count ?? 0, 'Membership') }}</dd></div>
                <div><dt>Skipped</dt><dd>{{ result.skipped_count }} {{ countLabel(result.skipped_count, 'record') }}</dd></div>
              }
            </dl>
          </section>
        }
        <section class="preview" aria-labelledby="resolution-preview-title">
          <div class="section-heading"><h2 id="resolution-preview-title">{{ resolutionSectionHeading(currentBatch.status) }}</h2><p>{{ resolutionSectionSubtitle(currentBatch) }}</p></div>
          @if (recordsLoading()) {
            <app-state-message title="Loading staged records" message="Retrieving the resolution preview." />
          } @else if (recordsError()) {
            <app-state-message title="Resolution preview unavailable" message="The staged records could not be loaded." tone="error" />
          } @else if (!recordPage()?.results?.length) {
            <app-state-message title="No staged records" message="This import does not contain previewable records." />
          } @else {
            <div class="table-wrap" role="region" aria-labelledby="resolution-preview-title" tabindex="0"><table aria-labelledby="resolution-preview-title"><thead><tr><th scope="col">Source</th><th scope="col">Contact</th><th scope="col">Decision</th><th scope="col">Destination</th></tr></thead><tbody>
              @for (record of recordPage()!.results; track record.id) {
                <tr><td><strong>{{ value(record, 'first_name') }} {{ value(record, 'last_name') }}</strong><small>{{ value(record, 'location') }}</small></td><td>{{ value(record, 'email') }}<small>{{ value(record, 'mobile') }}</small></td><td><app-status-badge [label]="resolutionLabel(record).title" [tone]="decisionTone(record)" />@if (record.status === 'INVALID') { @if (validationMessages(record).length) { @for (message of validationMessages(record); track message) { <small class="validation-message">{{ message }}</small> } } @else { <small class="validation-message">Source record failed validation.</small> } } @else { <small>{{ resolutionLabel(record).detail }}</small> }</td><td>@if (record.resolved_person; as person) { <a [routerLink]="['/people', person.id]">{{ person.first_name }} {{ person.last_name }}</a><small>{{ person.primary_email || person.mobile }} @if (person.record_state === 'archived') { (Archived) }</small> } @else { <span>{{ destinationLabel(record) }}</span> }
                  @if (isReviewable(currentBatch.status) && record.status === 'REVIEW_REQUIRED' && auth.isCrmAdmin()) {
                    <a class="review-action crm-button crm-button--quiet" [routerLink]="['/imports', batchId, 'review', record.id]" [attr.aria-label]="'Review ' + value(record, 'first_name') + ' ' + value(record, 'last_name')">Review <span aria-hidden="true">&rarr;</span></a>
                  }</td></tr>
              }
            </tbody></table></div>
            <nav class="pagination crm-pagination" aria-label="Resolution preview pages"><button type="button" class="crm-button crm-button--secondary" [disabled]="!recordPage()!.previous || recordsLoading()" (click)="loadRecords(page() - 1)">Previous</button><span>Page {{ page() }}</span><button type="button" class="crm-button crm-button--secondary" [disabled]="!recordPage()!.next || recordsLoading()" (click)="loadRecords(page() + 1)">Next</button></nav>
          }
        </section>

      }
      <app-confirmation-dialog
        [open]="importConfirmationOpen()"
        title="Add these records to the CRM?"
        [message]="importConfirmationMessage()"
        confirmLabel="Add to CRM"
        [busy]="importing()"
        (cancelled)="cancelImportConfirmation()"
        (confirmed)="confirmImport()"
      />
    </section>
  `,
  styleUrl: './import-batch-page.component.scss',
})
export class ImportBatchPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ImportReconciliationService);
  readonly auth = inject(AuthService);
  readonly batchId = Number(this.route.snapshot.paramMap.get('id'));
  readonly batch = signal<ImportBatchDetail | null>(null);
  readonly recordPage = signal<PaginatedImportRecordPreview | null>(null);
  readonly page = signal(1);
  readonly batchLoading = signal(true);
  readonly recordsLoading = signal(true);
  readonly batchError = signal<string | null>(null);
  readonly recordsError = signal<string | null>(null);
  readonly importConfirmationOpen = signal(false);
  readonly importing = signal(false);
  readonly analyzing = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importResult = signal<AuthoritativeImportResult | null>(null);
  readonly canImport = computed(() => {
    const batch = this.batch();
    return (batch?.source_type === 'MEMBERSHIP_FORM' || batch?.source_type === 'EVENTBRITE')
      && batch.status === 'READY_FOR_IMPORT'
      && this.auth.isCrmAdmin();
  });
  readonly canAnalyze = computed(() => this.batch()?.source_type === 'EVENTBRITE' && this.batch()?.status === 'STAGED' && this.auth.isCrmAdmin());
  readonly resolutionLabel = importResolutionLabel;
  readonly statusLabel = importBatchStatusLabel;
  readonly isReviewable = isReviewableImportBatch;

  readonly sourceLabel = (source: string) => source === 'MEMBERSHIP_FORM' ? 'Membership Form' : source === 'EVENTBRITE' ? 'Eventbrite' : source;
  statusTone(status: ImportBatchStatus): StatusBadgeTone {
    if (status === 'FAILED') return 'error';
    if (status === 'READY_FOR_REVIEW') return 'warning';
    if (status === 'IMPORTED' || status === 'READY_FOR_IMPORT') return 'success';
    return status === 'PROCESSING' ? 'info' : 'neutral';
  }
  decisionTone(record: ImportRecordPreview): StatusBadgeTone {
    if (record.status === 'COMMITTED') return 'success';
    if (record.status === 'INVALID') return 'error';
    if (record.status === 'REVIEW_REQUIRED') return 'warning';
    if (record.resolution_method === 'AUTO_MATCH' || record.resolution_method === 'STAFF_MATCH') return 'info';
    return 'neutral';
  }

  constructor() { this.loadBatch(); this.loadRecords(1); }

  loadRecords(page: number): void {
    if (page < 1) return;
    this.recordsLoading.set(true); this.recordsError.set(null);
    this.service.getBatchRecords(this.batchId, { page, page_size: 25 }).subscribe({
      next: (recordPage) => { this.recordPage.set(recordPage); this.page.set(page); this.recordsLoading.set(false); },
      error: () => { this.recordsError.set('The staged records could not be loaded.'); this.recordsLoading.set(false); },
    });
  }

  value(record: { source: ImportReviewRecord['source'] }, key: keyof ImportReviewRecord['source']): string { return record.source[key] ?? 'Not provided'; }
  validationMessages(record: ImportRecordPreview): string[] {
    if (!Array.isArray(record.validation_errors)) return [];
    return record.validation_errors
      .map((error) => typeof error?.message === 'string' ? error.message.trim() : '')
      .filter(Boolean);
  }
  destinationLabel(record: ImportRecordPreview): string {
    if (record.status === 'INVALID') return 'Excluded';
    if (record.status === 'REVIEW_REQUIRED') return 'Pending review';
    if (record.resolution_method === 'NO_MATCH' || record.resolution_method === 'STAFF_CREATE_NEW') return 'New CRM Person';
    return 'Pending review';
  }
  resolutionSectionHeading(status: ImportBatchStatus): string {
    return status === 'IMPORTED' ? 'Import results' : 'Resolution preview';
  }
  resolutionSectionSubtitle(batch: ImportBatchDetail): string {
    return batch.status === 'IMPORTED'
      ? 'Review how each source record was handled.'
      : batch.source_type === 'EVENTBRITE'
        ? 'Review how each source record is currently resolved.'
      : 'Review how each record will be handled before adding it to the CRM.';
  }
  countLabel(count: number, singular: string, plural = `${singular}s`): string { return count === 1 ? singular : plural; }
  importConfirmationMessage(): string {
    return this.batch()?.source_type === 'EVENTBRITE'
      ? 'This will add resolved Eventbrite buyers, Events, and event registrations to the CRM. Existing People and Event participations are reused where applicable. Memberships will not be created or changed.'
      : 'This will add the resolved historical records to the CRM. New identities create People, matched identities use existing People, and eligible Membership and professional information is added. Existing nonblank CRM information is preserved.';
  }
  openImportConfirmation(): void { if (this.canImport() && !this.importing()) { this.importConfirmationOpen.set(true); this.importError.set(null); } }
  cancelImportConfirmation(): void { this.importConfirmationOpen.set(false); }
  confirmImport(): void {
    const batch = this.batch();
    if (!batch || !this.canImport() || this.importing()) return;
    this.importConfirmationOpen.set(false); this.importing.set(true); this.importError.set(null);
    this.service.importBatch(batch.id).pipe(finalize(() => this.importing.set(false))).subscribe({
      next: ({ batch: importedBatch, result }) => {
        this.batch.set(importedBatch); this.importResult.set(result); this.loadRecords(this.page());
      },
      error: (error: HttpErrorResponse) => {
        const detail = typeof error.error?.detail === 'string' ? error.error.detail : null;
        this.importError.set(error.status === 409
          ? detail ?? 'This import can no longer be imported in its current state. The import status has been refreshed.'
          : 'The import could not be imported. No imported state has been recorded locally.');
        if (error.status === 409) this.loadBatch(true);
        if (error.status === 404) this.loadBatch();
      },
    });
  }
  analyzeBuyers(): void {
    const batch = this.batch();
    if (!batch || !this.canAnalyze() || this.analyzing()) return;
    this.analyzing.set(true); this.importError.set(null);
    this.service.analyzeEventbriteBatch(batch.id).pipe(finalize(() => this.analyzing.set(false))).subscribe({
      next: (updatedBatch) => { this.batch.set(updatedBatch); this.loadRecords(this.page()); },
      error: (error: HttpErrorResponse) => {
        const detail = typeof error.error?.detail === 'string' ? error.error.detail : null;
        this.importError.set(error.status === 409
          ? detail ?? 'This import can no longer be analyzed in its current state. The import status has been refreshed.'
          : 'The buyers could not be analyzed right now.');
        if (error.status === 409) this.loadBatch(true);
      },
    });
  }
  batchMessageTitle(batch: ImportBatchDetail): string {
    if (batch.status === 'STAGED') return 'Staged';
    if (batch.status === 'PROCESSING') return 'Processing';
    if (batch.status === 'READY_FOR_REVIEW') return 'Identity review required';
    if (batch.status === 'READY_FOR_IMPORT') return batch.source_type === 'EVENTBRITE' ? 'Identity review complete' : 'Ready to add to CRM';
    if (batch.status === 'IMPORTED') return 'Imported';
    return 'Failed';
  }
  batchMessage(batch: ImportBatchDetail): string {
    if (batch.status === 'STAGED') return 'The file has been processed and is ready for identity analysis.';
    if (batch.status === 'PROCESSING') return 'Identity analysis is in progress. This import is not actionable yet.';
    if (batch.status === 'READY_FOR_REVIEW') return `${batch.review_required_count} ${this.countLabel(batch.review_required_count, 'record')} ${batch.review_required_count === 1 ? 'needs' : 'need'} a staff identity decision. Use Review in the table below to resolve each record.`;
    if (batch.status === 'READY_FOR_IMPORT') return batch.source_type === 'EVENTBRITE'
      ? 'All Eventbrite buyers have been matched or resolved. This import is ready to add buyers, Events, and event registrations to the CRM.'
      : 'All identity decisions have been resolved. These records can now be added to the CRM.';
    if (batch.status === 'IMPORTED') return 'This import has been completed and is now read-only.';
    return 'This import could not be processed safely.';
  }
  private loadBatch(refresh = false): void {
    if (!refresh) this.batchLoading.set(true);
    this.service.getBatch(this.batchId).subscribe({
      next: (batch) => { this.batch.set(batch); this.batchLoading.set(false); },
      error: () => { if (!refresh) { this.batchError.set('This historical import is not available.'); this.batchLoading.set(false); } },
    });
  }

}
