import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { importResolutionLabel } from '../../core/imports/import-resolution-label';
import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportBatchDetail, ImportReviewRecord, PaginatedImportRecordPreview } from '../../core/imports/import-reconciliation.types';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

@Component({
  selector: 'app-import-batch-page',
  imports: [RouterLink, StateMessageComponent],
  template: `
    <section class="page">
      <a routerLink="/imports">Back to Historical Imports</a>
      @if (batchLoading()) {
        <app-state-message title="Loading import batch" message="Retrieving batch summary." />
      } @else if (batchError()) {
        <app-state-message title="Import batch unavailable" [message]="batchError()!" tone="error" />
      } @else if (batch(); as currentBatch) {
        <header>
          <p class="meta">{{ currentBatch.source_type }} | {{ currentBatch.status }}</p><h3>{{ currentBatch.source_filename }}</h3>
          <dl class="summary" aria-label="Batch resolution summary">
            <div><dt>Records</dt><dd>{{ currentBatch.total_count }}</dd></div><div><dt>Auto matched</dt><dd>{{ currentBatch.auto_match_count }}</dd></div><div><dt>New people</dt><dd>{{ currentBatch.new_person_count }}</dd></div><div><dt>Review required</dt><dd>{{ currentBatch.review_required_count }}</dd></div><div><dt>Invalid</dt><dd>{{ currentBatch.invalid_count }}</dd></div><div><dt>Committed</dt><dd>{{ currentBatch.committed_count }}</dd></div>
          </dl>
        </header>
        <section class="batch-message" aria-live="polite">
          <h4>{{ batchMessageTitle(currentBatch.status) }}</h4><p>{{ batchMessage(currentBatch.status) }}</p>
          @if (currentBatch.review_required_count > 0 && reviewRecords().length) { <a [routerLink]="['/imports', batchId, 'review', reviewRecords()[0].id]">Review records</a> }
        </section>
        <section class="preview" aria-labelledby="resolution-preview-title">
          <div class="section-heading"><h4 id="resolution-preview-title">Resolution preview</h4><p>Read-only decisions before the future commit step.</p></div>
          @if (recordsLoading()) {
            <app-state-message title="Loading staged records" message="Retrieving the resolution preview." />
          } @else if (recordsError()) {
            <app-state-message title="Resolution preview unavailable" message="The staged records could not be loaded." tone="error" />
          } @else if (!recordPage()?.results?.length) {
            <app-state-message title="No staged records" message="This batch does not contain previewable records." />
          } @else {
            <div class="table-wrap"><table><thead><tr><th>Source</th><th>Contact</th><th>Decision</th><th>Destination</th></tr></thead><tbody>
              @for (record of recordPage()!.results; track record.id) {
                <tr><td><strong>{{ value(record, 'first_name') }} {{ value(record, 'last_name') }}</strong><small>{{ value(record, 'location') }}</small></td><td>{{ value(record, 'email') }}<small>{{ value(record, 'mobile') }}</small></td><td><strong>{{ resolutionLabel(record).title }}</strong><small>{{ resolutionLabel(record).detail }}</small></td><td>@if (record.resolved_person; as person) { <a [routerLink]="['/people', person.id]">{{ person.first_name }} {{ person.last_name }}</a><small>{{ person.primary_email || person.mobile }} @if (person.record_state === 'archived') { (Archived) }</small> } @else { <span>None</span> }</td></tr>
              }
            </tbody></table></div>
            <nav class="pagination" aria-label="Resolution preview pages"><button type="button" [disabled]="!recordPage()!.previous || recordsLoading()" (click)="loadRecords(page() - 1)">Previous</button><span>Page {{ page() }}</span><button type="button" [disabled]="!recordPage()!.next || recordsLoading()" (click)="loadRecords(page() + 1)">Next</button></nav>
          }
        </section>
        @if (currentBatch.review_required_count > 0 && reviewRecords().length) {
          <section class="review-links" aria-labelledby="review-required-title"><h4 id="review-required-title">Records requiring review</h4>@for (record of reviewRecords(); track record.id) { <a [routerLink]="['/imports', batchId, 'review', record.id]">Review {{ value(record, 'first_name') }} {{ value(record, 'last_name') }}</a> }</section>
        }
      }
    </section>
  `,
  styles: `
    .page,.preview,.review-links { display:grid; gap:1rem; } header,.batch-message,.review-links { padding:1rem; border:1px solid #dce5ea; border-radius:1rem; background:#fff; } h3,h4,p { margin:0; } h3,h4 { color:#173248; }.meta,small,.section-heading p { color:#526f81; }.meta { font-size:.78rem;font-weight:700;letter-spacing:.05em; }.summary { display:flex;flex-wrap:wrap;gap:1.25rem;margin:1rem 0 0; } dt { color:#607b8d;font-size:.75rem; } dd { margin:.2rem 0 0;color:#173248;font-weight:700; }.batch-message { display:grid;gap:.45rem; }.batch-message a,a { color:#075879;font-weight:700; }.table-wrap { overflow-x:auto;border:1px solid #dce5ea;border-radius:1rem;background:#fff; } table { width:100%;min-width:48rem;border-collapse:collapse; } th,td { padding:.85rem 1rem;text-align:left;vertical-align:top;border-bottom:1px solid #e6edf0; } th { color:#526f81;font-size:.78rem; } td { color:#173248; } td strong,td small { display:block; } td small { margin-top:.3rem; }.pagination { display:flex;align-items:center;gap:.75rem; }.pagination button { border:0;border-radius:999px;padding:.65rem .9rem;background:#e5eef2;color:#173248;font:inherit;font-weight:700; }.pagination button:disabled { opacity:.55;cursor:not-allowed; }
  `,
})
export class ImportBatchPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ImportReconciliationService);
  readonly batchId = Number(this.route.snapshot.paramMap.get('id'));
  readonly batch = signal<ImportBatchDetail | null>(null);
  readonly reviewRecords = signal<ImportReviewRecord[]>([]);
  readonly recordPage = signal<PaginatedImportRecordPreview | null>(null);
  readonly page = signal(1);
  readonly batchLoading = signal(true);
  readonly recordsLoading = signal(true);
  readonly batchError = signal<string | null>(null);
  readonly recordsError = signal<string | null>(null);
  readonly resolutionLabel = importResolutionLabel;

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
  batchMessageTitle(status: string): string { return status === 'READY_FOR_REVIEW' ? 'Identity review required' : status === 'READY_TO_COMMIT' ? 'Identity review complete' : 'Identity analysis complete'; }
  batchMessage(status: string): string { if (status === 'READY_FOR_REVIEW') return 'Some records need a staff identity decision before this batch can proceed.'; if (status === 'READY_TO_COMMIT') return 'All records have a final identity decision and are ready for the future commit step.'; return 'All records have an identity decision. Review the resolution preview below before the future commit step.'; }
  private loadBatch(): void { this.service.getBatch(this.batchId).subscribe({ next: (batch) => { this.batch.set(batch); this.batchLoading.set(false); }, error: () => { this.batchError.set('This import batch is not available.'); this.batchLoading.set(false); } }); }
  private loadReviewRecords(): void { this.service.getReviewQueue(this.batchId).subscribe({ next: (queue) => this.reviewRecords.set(queue.results) }); }
}
