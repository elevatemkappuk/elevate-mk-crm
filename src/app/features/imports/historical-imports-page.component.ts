import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportBatchSummary } from '../../core/imports/import-reconciliation.types';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

@Component({
  selector: 'app-historical-imports-page',
  imports: [DatePipe, RouterLink, StateMessageComponent],
  template: `
    <section class="page">
      <p class="intro">Review staged historical records that require an identity decision.</p>

      @if (loading()) {
        <app-state-message title="Loading historical imports" message="Retrieving import batches." />
      } @else if (error()) {
        <app-state-message title="Historical imports unavailable" [message]="error()!" tone="error" />
      } @else if (!batches().length) {
        <app-state-message title="No historical imports" message="No staged historical import batches are available." />
      } @else {
        <div class="list">
          @for (batch of batches(); track batch.id) {
            <article class="batch-card">
              <div>
                <p class="meta">{{ batch.source_type }} | {{ batch.status }}</p>
                <h3>{{ batch.source_filename }}</h3>
                <p class="created">Created {{ batch.created_at | date: 'mediumDate' }}</p>
              </div>
              <dl class="counts">
                <div><dt>Records</dt><dd>{{ batch.total_records }}</dd></div>
                <div><dt>Review</dt><dd>{{ batch.review_required_count }}</dd></div>
                <div><dt>Invalid</dt><dd>{{ batch.invalid_count }}</dd></div>
                <div><dt>Resolved</dt><dd>{{ batch.resolved_count }}</dd></div>
                @if (batch.committed_count !== undefined) {
                  <div><dt>Committed</dt><dd>{{ batch.committed_count }}</dd></div>
                }
              </dl>
              <a [routerLink]="['/imports', batch.id]">
                {{ batch.review_required_count ? 'Review ' + batch.review_required_count + ' records' : 'View batch' }}
              </a>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .page, .list { display: grid; gap: 1rem; }
    .intro, .created { margin: 0; color: #526f81; }
    .batch-card { display: grid; gap: 1rem; padding: 1.1rem; border: 1px solid #dce5ea; border-radius: 1rem; background: #fff; }
    .batch-card h3 { margin: 0.2rem 0; color: #173248; }
    .meta { margin: 0; color: #607b8d; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; }
    .counts { display: flex; flex-wrap: wrap; gap: 1.25rem; margin: 0; }
    dt { color: #607b8d; font-size: 0.75rem; }
    dd { margin: 0.2rem 0 0; color: #173248; font-weight: 700; }
    a { color: #075879; font-weight: 700; }
  `,
})
export class HistoricalImportsPageComponent {
  private readonly service = inject(ImportReconciliationService);

  readonly batches = signal<ImportBatchSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.service.listBatches().subscribe({
      next: (batches) => {
        this.batches.set(batches);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The import batches could not be loaded right now.');
        this.loading.set(false);
      },
    });
  }
}
