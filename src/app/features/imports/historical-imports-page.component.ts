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
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { MembershipFormUploadComponent } from './membership-form-upload.component';

@Component({
  selector: 'app-historical-imports-page',
  imports: [DatePipe, RouterLink, StateMessageComponent, MembershipFormUploadComponent, StatusBadgeComponent],
  template: `
    <section class="page">
      <div class="page-intro">
        <div><h1>Historical Imports</h1><p class="intro">Review historical records and resolve identity decisions before adding records to the CRM.</p></div>
        @if (auth.isCrmAdmin()) {
          <button type="button" class="crm-button upload-action" (click)="uploadOpen.set(true)">Upload historical records</button>
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
            <span>Identity review is complete. This import is ready for the next import step.</span>
          } @else if (batch.status === 'READY_FOR_IMPORT') {
            <span>These records are ready to be added to the CRM.</span>
          } @else if (batch.status === 'PROCESSING') {
            <span>Identity analysis is still in progress.</span>
          } @else if (batch.status === 'FAILED') {
            <span>The import could not be processed safely.</span>
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
            <button type="button" class="crm-button upload-action" (click)="uploadOpen.set(true)">Upload historical records</button>
          }
        </app-state-message>
      } @else {
        <div class="list">
          @for (batch of batches(); track batch.id) {
            <article class="import-card">
              <div>
                <div class="card-heading"><h2>{{ batch.source_filename }}</h2><app-status-badge [label]="statusLabel(batch.status)" [tone]="statusTone(batch.status)" /></div>
                <p class="meta">{{ sourceLabel(batch.source_type) }} <span aria-hidden="true">&middot;</span> <time [attr.datetime]="batch.created_at">{{ batch.created_at | date: 'mediumDate' }}</time></p>
              </div>
              <div class="card-footer"><dl class="counts">
                <div><dt>Records</dt><dd>{{ batch.total_count }}</dd></div>
                <div><dt>Review</dt><dd>{{ batch.review_required_count }}</dd></div>
                <div><dt>Invalid</dt><dd>{{ batch.invalid_count }}</dd></div>
                <div><dt>Resolved</dt><dd>{{ batch.resolved_count }}</dd></div>
                @if (batch.committed_count !== undefined) {
                  <div><dt>Imported</dt><dd>{{ batch.committed_count }}</dd></div>
                }
              </dl>
              <a class="crm-button crm-button--quiet" [routerLink]="['/imports', batch.id]" [attr.aria-label]="'View import: ' + batch.source_filename">View import <span aria-hidden="true">&rarr;</span></a></div>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display:block; min-width:0; }
    .page,.list { display:grid; gap:var(--crm-space-4); }
    .page-intro,.card-heading,.card-footer { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
    .page-intro { margin-bottom:.5rem; }
    .page-intro>div { flex:1 1 24rem; }
    h1,h2,p,dl,dd { margin:0; }
    h1 { font-size:var(--crm-font-title); margin-bottom:.5rem; }
    .intro,.meta,dt { color:var(--crm-text-secondary); }
    .intro { max-width:46rem; }
    .import-card { display:grid; gap:1.25rem; min-width:0; padding:1.25rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-lg); background:var(--crm-surface); }
    h2 { font-size:var(--crm-font-lg); overflow-wrap:anywhere; min-width:0; flex:1 1 16rem; }
    .meta { display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.5rem; font-size:var(--crm-font-sm); }
    .counts { display:flex; flex-wrap:wrap; gap:.75rem 1.75rem; }
    .counts>div { display:flex; flex-direction:column-reverse; gap:.2rem; }
    dt { font-size:var(--crm-font-sm); } dd { font-weight:700; font-variant-numeric:tabular-nums; }
    .upload-action { background:var(--crm-shell-accent); color:var(--crm-text-strong); }
    .upload-action:hover { background:#f2c94f; }
    .success { display:flex; flex-wrap:wrap; gap:.65rem 1rem; align-items:center; padding:1rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-md); background:var(--crm-success-surface); color:var(--crm-success); }
    .success a { color:inherit; }
    @media(max-width:42.5rem) { .import-card { padding:1rem; } .card-footer>a { margin-left:auto; } }
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

  statusTone(status: string): StatusBadgeTone {
    switch (status) {
      case 'READY_FOR_REVIEW': return 'warning';
      case 'READY_FOR_IMPORT': case 'IMPORTED': return 'success';
      case 'FAILED': return 'error';
      case 'PROCESSING': return 'info';
      default: return 'neutral';
    }
  }

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
