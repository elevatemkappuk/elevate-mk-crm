import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import {
  importBatchStatusLabel,
  isReviewableImportBatch,
} from '../../core/imports/import-batch-status';
import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportBatchSummary } from '../../core/imports/import-reconciliation.types';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { MembershipFormUploadComponent } from './membership-form-upload.component';

@Component({
  selector: 'app-historical-imports-page',
  imports: [DatePipe, RouterLink, StateMessageComponent, MembershipFormUploadComponent],
  template: `
    <section class="page">
      <div class="page-intro">
        <p class="intro">Review historical records and resolve identity decisions before adding records to the CRM.</p>
        @if (auth.isCrmAdmin()) {
          <button type="button" class="button-primary" (click)="uploadOpen.set(true)">Upload historical records</button>
        }
      </div>

      @if (uploadOpen() && auth.isCrmAdmin()) {
        <app-historical-import-upload (completed)="handleUploadComplete($event)" (cancelled)="uploadOpen.set(false)" />
      }

      @if (uploadedBatch(); as batch) {
        <section class="success" aria-live="polite">
          <strong>{{ sourceLabel(batch.source_type) }} uploaded. {{ statusLabel(batch.status) }}.</strong>
          @if (isReviewable(batch.status)) {
            <a [routerLink]="['/imports', batch.id]">Review records</a>
          } @else if (batch.status === 'STAGED') {
            <span>The file has been processed and is ready for identity analysis.</span>
          } @else if (batch.status === 'READY_FOR_IMPORT' && batch.source_type === 'EVENTBRITE') {
            <span>Identity review is complete. This batch is ready for the next import step.</span>
          } @else if (batch.status === 'READY_FOR_IMPORT') {
            <span>These records are ready to be added to the CRM.</span>
          } @else if (batch.status === 'PROCESSING') {
            <span>Identity analysis is still in progress.</span>
          } @else if (batch.status === 'FAILED') {
            <span>The batch could not be processed safely.</span>
          }
        </section>
      }

      @if (loading()) {
        <app-state-message title="Loading historical imports" message="Retrieving historical imports." />
      } @else if (error()) {
        <app-state-message title="Historical imports unavailable" [message]="error()!" tone="error" />
      } @else if (!batches().length) {
        <app-state-message title="No historical imports" message="Upload a Membership Form or Eventbrite workbook to process historical records.">
          @if (auth.isCrmAdmin()) {
            <button type="button" class="button-primary" (click)="uploadOpen.set(true)">Upload historical records</button>
          }
        </app-state-message>
      } @else {
        <div class="list">
          @for (batch of batches(); track batch.id) {
            <article class="batch-card">
              <div>
                <p class="meta">{{ sourceLabel(batch.source_type) }} | {{ statusLabel(batch.status) }}</p>
                <h3>{{ batch.source_filename }}</h3>
                <p class="created">Created {{ batch.created_at | date: 'mediumDate' }}</p>
              </div>
              <dl class="counts">
                <div><dt>Records</dt><dd>{{ batch.total_count }}</dd></div>
                <div><dt>Review</dt><dd>{{ batch.review_required_count }}</dd></div>
                <div><dt>Invalid</dt><dd>{{ batch.invalid_count }}</dd></div>
                <div><dt>Resolved</dt><dd>{{ batch.resolved_count }}</dd></div>
                @if (batch.committed_count !== undefined) {
                  <div><dt>Imported</dt><dd>{{ batch.committed_count }}</dd></div>
                }
              </dl>
              <a [routerLink]="['/imports', batch.id]">
                {{ isReviewable(batch.status) && batch.review_required_count ? 'Review ' + batch.review_required_count + ' records' : 'View batch' }}
              </a>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .page, .list { display: grid; gap: 1rem; }.page-intro { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
    .intro, .created { margin: 0; color: #526f81; }
    .batch-card { display: grid; gap: 1rem; padding: 1.1rem; border: 1px solid #dce5ea; border-radius: 1rem; background: #fff; }
    .batch-card h3 { margin: 0.2rem 0; color: #173248; }
    .meta { margin: 0; color: #607b8d; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; }
    .counts { display: flex; flex-wrap: wrap; gap: 1.25rem; margin: 0; }
    dt { color: #607b8d; font-size: 0.75rem; }
    dd { margin: 0.2rem 0 0; color: #173248; font-weight: 700; }
    a { color: #075879; font-weight: 700; }
    .button-primary { border:0; border-radius:999px; padding:.72rem 1.1rem; color:#fff; background:#1d6077; font:inherit; font-weight:700; cursor:pointer; white-space:nowrap; }
    .success { display:flex; flex-wrap:wrap; gap:.65rem 1rem; align-items:center; padding:1rem; border:1px solid #bcd5c3; border-radius:1rem; background:#f3faf4; color:#214d2b; }
    @media (max-width:600px) { .page-intro { align-items:flex-start; flex-direction:column; } }
  `,
})
export class HistoricalImportsPageComponent {
  private readonly service = inject(ImportReconciliationService);
  readonly auth = inject(AuthService);

  readonly batches = signal<ImportBatchSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly uploadOpen = signal(false);
  readonly uploadedBatch = signal<ImportBatchSummary | null>(null);
  readonly statusLabel = importBatchStatusLabel;
  readonly isReviewable = isReviewableImportBatch;
  readonly sourceLabel = (source: string) => source === 'EVENTBRITE' ? 'Eventbrite' : source === 'MEMBERSHIP_FORM' ? 'Membership Form' : source;

  constructor() {
    this.loadBatches();
  }

  handleUploadComplete(batch: ImportBatchSummary): void {
    this.uploadedBatch.set(batch);
    this.uploadOpen.set(false);
    this.loadBatches();
  }

  private loadBatches(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.listBatches().subscribe({
      next: (batches) => {
        this.batches.set(batches);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The historical imports could not be loaded right now.');
        this.loading.set(false);
      },
    });
  }
}
