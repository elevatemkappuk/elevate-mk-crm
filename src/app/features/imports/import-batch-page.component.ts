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
import { ImportBatchDetail, ImportRecordPreview, ImportReviewRecord, MembershipFormImportResult, PaginatedImportRecordPreview } from '../../core/imports/import-reconciliation.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

@Component({
  selector: 'app-import-batch-page',
  imports: [RouterLink, ConfirmationDialogComponent, StateMessageComponent],
  template: `
    <section class="page">
      <a routerLink="/imports">Back to Historical Imports</a>
      @if (batchLoading()) {
        <app-state-message title="Loading historical import" message="Retrieving batch summary." />
      } @else if (batchError()) {
        <app-state-message title="Historical import unavailable" [message]="batchError()!" tone="error" />
      } @else if (batch(); as currentBatch) {
        <header>
          <p class="meta">{{ currentBatch.source_type }} | {{ statusLabel(currentBatch.status) }}</p><h3>{{ currentBatch.source_filename }}</h3>
          <dl class="summary" aria-label="Batch resolution summary">
            <div><dt>Records</dt><dd>{{ currentBatch.total_count }}</dd></div><div><dt>Auto matched</dt><dd>{{ currentBatch.auto_match_count }}</dd></div><div><dt>New people</dt><dd>{{ currentBatch.new_person_count }}</dd></div><div><dt>Review required</dt><dd>{{ currentBatch.review_required_count }}</dd></div><div><dt>Invalid</dt><dd>{{ currentBatch.invalid_count }}</dd></div><div><dt>Imported</dt><dd>{{ currentBatch.committed_count }}</dd></div>
          </dl>
        </header>
        <section class="batch-message" aria-live="polite">
          <h4>{{ batchMessageTitle(currentBatch.status) }}</h4><p>{{ batchMessage(currentBatch.status) }}</p>
          @if (importError()) { <p class="import-error" role="alert">{{ importError() }}</p> }
          @if (isReviewable(currentBatch.status) && currentBatch.review_required_count > 0 && reviewRecords().length) { <a [routerLink]="['/imports', batchId, 'review', reviewRecords()[0].id]">Review records</a> }
          @if (canImport()) {
            <div class="batch-actions">
              <button type="button" class="button-primary" [disabled]="importing()" (click)="openImportConfirmation()">
                {{ importing() ? 'Adding to CRM...' : 'Add to CRM' }}
              </button>
              @if (importing()) { <span class="importing" aria-live="polite">Adding to CRM...</span> }
            </div>
          }
        </section>
        @if (importResult(); as result) {
          <section class="import-success" aria-live="polite" aria-labelledby="import-complete-title">
            <h4 id="import-complete-title">Added to CRM</h4>
            <p>The records were added to the CRM successfully.</p>
            <dl class="result-summary">
              <div><dt>Processed</dt><dd>{{ result.processed_count }} {{ countLabel(result.processed_count, 'record') }}</dd></div>
              <div><dt>People created</dt><dd>{{ result.people_created_count }} {{ countLabel(result.people_created_count, 'Person', 'People') }}</dd></div>
              <div><dt>People matched</dt><dd>{{ result.people_matched_count }} {{ countLabel(result.people_matched_count, 'Person', 'People') }}</dd></div>
              <div><dt>Memberships created</dt><dd>{{ result.memberships_created_count }} {{ countLabel(result.memberships_created_count, 'Membership') }}</dd></div>
              <div><dt>Skipped</dt><dd>{{ result.skipped_count }} {{ countLabel(result.skipped_count, 'record') }}</dd></div>
            </dl>
          </section>
        }
        <section class="preview" aria-labelledby="resolution-preview-title">
          <div class="section-heading"><h4 id="resolution-preview-title">{{ resolutionSectionHeading(currentBatch.status) }}</h4><p>{{ resolutionSectionSubtitle(currentBatch.status) }}</p></div>
          @if (recordsLoading()) {
            <app-state-message title="Loading staged records" message="Retrieving the resolution preview." />
          } @else if (recordsError()) {
            <app-state-message title="Resolution preview unavailable" message="The staged records could not be loaded." tone="error" />
          } @else if (!recordPage()?.results?.length) {
            <app-state-message title="No staged records" message="This batch does not contain previewable records." />
          } @else {
            <div class="table-wrap"><table><thead><tr><th>Source</th><th>Contact</th><th>Decision</th><th>Destination</th></tr></thead><tbody>
              @for (record of recordPage()!.results; track record.id) {
                <tr><td><strong>{{ value(record, 'first_name') }} {{ value(record, 'last_name') }}</strong><small>{{ value(record, 'location') }}</small></td><td>{{ value(record, 'email') }}<small>{{ value(record, 'mobile') }}</small></td><td><strong>{{ resolutionLabel(record).title }}</strong>@if (record.status === 'INVALID') { @if (validationMessages(record).length) { @for (message of validationMessages(record); track message) { <small class="validation-message">{{ message }}</small> } } @else { <small class="validation-message">Source record failed validation.</small> } } @else { <small>{{ resolutionLabel(record).detail }}</small> }</td><td>@if (record.resolved_person; as person) { <a [routerLink]="['/people', person.id]">{{ person.first_name }} {{ person.last_name }}</a><small>{{ person.primary_email || person.mobile }} @if (person.record_state === 'archived') { (Archived) }</small> } @else { <span>{{ destinationLabel(record) }}</span> }</td></tr>
              }
            </tbody></table></div>
            <nav class="pagination" aria-label="Resolution preview pages"><button type="button" [disabled]="!recordPage()!.previous || recordsLoading()" (click)="loadRecords(page() - 1)">Previous</button><span>Page {{ page() }}</span><button type="button" [disabled]="!recordPage()!.next || recordsLoading()" (click)="loadRecords(page() + 1)">Next</button></nav>
          }
        </section>
        @if (isReviewable(currentBatch.status) && currentBatch.review_required_count > 0 && reviewRecords().length) {
          <section class="review-links" aria-labelledby="review-required-title"><h4 id="review-required-title">Records requiring review</h4>@for (record of reviewRecords(); track record.id) { <a [routerLink]="['/imports', batchId, 'review', record.id]">Review {{ value(record, 'first_name') }} {{ value(record, 'last_name') }}</a> }</section>
        }
      }
      <app-confirmation-dialog
        [open]="importConfirmationOpen()"
        title="Add these records to the CRM?"
        message="This will add the resolved historical records to the CRM. New identities create People, matched identities use existing People, and eligible Membership and professional information is added. Existing nonblank CRM information is preserved."
        confirmLabel="Add to CRM"
        [busy]="importing()"
        (cancelled)="cancelImportConfirmation()"
        (confirmed)="confirmImport()"
      />
    </section>
  `,
  styles: `
    .page,.preview,.review-links { display:grid; gap:1rem; } header,.batch-message,.review-links,.import-success { padding:1rem; border:1px solid #dce5ea; border-radius:1rem; background:#fff; } h3,h4,p { margin:0; } h3,h4 { color:#173248; }.meta,small,.section-heading p { color:#526f81; }.meta { font-size:.78rem;font-weight:700;letter-spacing:.05em; }.summary,.result-summary { display:flex;flex-wrap:wrap;gap:1.25rem;margin:1rem 0 0; } dt { color:#607b8d;font-size:.75rem; } dd { margin:.2rem 0 0;color:#173248;font-weight:700; }.batch-message,.import-success { display:grid;gap:.45rem; }.batch-message a,a { color:#075879;font-weight:700; }.batch-actions { display:flex;align-items:center;gap:.75rem;margin-top:.45rem; }.button-primary { border:0;border-radius:999px;padding:.65rem .95rem;background:#1d6077;color:#fff;font:inherit;font-weight:700;cursor:pointer; }.button-primary:disabled { opacity:.55;cursor:not-allowed; }.importing { color:#526f81;font-weight:700; }.import-error,.validation-message { color:#8b2626; }.import-error { font-weight:700; }.import-success { border-color:#bcd5c3;background:#f3faf4; }.table-wrap { overflow-x:auto;border:1px solid #dce5ea;border-radius:1rem;background:#fff; } table { width:100%;min-width:48rem;border-collapse:collapse; } th,td { padding:.85rem 1rem;text-align:left;vertical-align:top;border-bottom:1px solid #e6edf0; } th { color:#526f81;font-size:.78rem; } td { color:#173248; } td strong,td small { display:block; } td small { margin-top:.3rem; }.pagination { display:flex;align-items:center;gap:.75rem; }.pagination button { border:0;border-radius:999px;padding:.65rem .9rem;background:#e5eef2;color:#173248;font:inherit;font-weight:700; }.pagination button:disabled { opacity:.55;cursor:not-allowed; }
  `,
})
export class ImportBatchPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ImportReconciliationService);
  readonly auth = inject(AuthService);
  readonly batchId = Number(this.route.snapshot.paramMap.get('id'));
  readonly batch = signal<ImportBatchDetail | null>(null);
  readonly reviewRecords = signal<ImportReviewRecord[]>([]);
  readonly recordPage = signal<PaginatedImportRecordPreview | null>(null);
  readonly page = signal(1);
  readonly batchLoading = signal(true);
  readonly recordsLoading = signal(true);
  readonly batchError = signal<string | null>(null);
  readonly recordsError = signal<string | null>(null);
  readonly importConfirmationOpen = signal(false);
  readonly importing = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importResult = signal<MembershipFormImportResult | null>(null);
  readonly canImport = computed(() => this.batch()?.status === 'READY_FOR_IMPORT' && this.auth.isCrmAdmin());
  readonly resolutionLabel = importResolutionLabel;
  readonly statusLabel = importBatchStatusLabel;
  readonly isReviewable = isReviewableImportBatch;

  constructor() { this.loadBatch(); this.loadReviewRecords(); this.loadRecords(1); }

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
  resolutionSectionSubtitle(status: ImportBatchStatus): string {
    return status === 'IMPORTED'
      ? 'Review how each source record was handled.'
      : 'Review how each record will be handled before adding it to the CRM.';
  }
  countLabel(count: number, singular: string, plural = `${singular}s`): string { return count === 1 ? singular : plural; }
  openImportConfirmation(): void { if (this.canImport() && !this.importing()) { this.importConfirmationOpen.set(true); this.importError.set(null); } }
  cancelImportConfirmation(): void { this.importConfirmationOpen.set(false); }
  confirmImport(): void {
    const batch = this.batch();
    if (!batch || !this.canImport() || this.importing()) return;
    this.importConfirmationOpen.set(false); this.importing.set(true); this.importError.set(null);
    this.service.importMembershipFormBatch(batch.id).pipe(finalize(() => this.importing.set(false))).subscribe({
      next: ({ batch: importedBatch, result }) => {
        this.batch.set(importedBatch); this.importResult.set(result); this.loadReviewRecords(); this.loadRecords(this.page());
      },
      error: (error: HttpErrorResponse) => {
        this.importError.set(error.status === 409
          ? 'This batch can no longer be imported in its current state. The batch status has been refreshed.'
          : 'The batch could not be imported. No imported state has been recorded locally.');
        if (error.status === 409) this.loadBatch(true);
        if (error.status === 404) this.loadBatch();
      },
    });
  }
  batchMessageTitle(status: ImportBatchStatus): string {
    if (status === 'PROCESSING') return 'Processing';
    if (status === 'READY_FOR_REVIEW') return 'Identity review required';
    if (status === 'READY_FOR_IMPORT') return 'Ready to add to CRM';
    if (status === 'IMPORTED') return 'Imported';
    return 'Failed';
  }
  batchMessage(status: ImportBatchStatus): string {
    if (status === 'PROCESSING') return 'Identity analysis is in progress. This batch is not actionable yet.';
    if (status === 'READY_FOR_REVIEW') return 'Some records need a staff identity decision before this batch can proceed.';
    if (status === 'READY_FOR_IMPORT') return 'These records are ready to be added to the CRM.';
    if (status === 'IMPORTED') return 'This batch has been imported and is now read-only.';
    return 'This batch could not be processed safely.';
  }
  private loadBatch(refresh = false): void {
    if (!refresh) this.batchLoading.set(true);
    this.service.getBatch(this.batchId).subscribe({
      next: (batch) => { this.batch.set(batch); this.batchLoading.set(false); },
      error: () => { if (!refresh) { this.batchError.set('This historical import is not available.'); this.batchLoading.set(false); } },
    });
  }
  private loadReviewRecords(): void { this.service.getReviewQueue(this.batchId).subscribe({ next: (queue) => this.reviewRecords.set(queue.results) }); }
}
