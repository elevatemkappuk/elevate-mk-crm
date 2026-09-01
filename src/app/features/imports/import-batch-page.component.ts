import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { importEvidenceLabel } from '../../core/imports/import-evidence';
import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportBatchDetail, ImportReviewRecord } from '../../core/imports/import-reconciliation.types';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

@Component({
  selector: 'app-import-batch-page',
  imports: [RouterLink, StateMessageComponent],
  template: `
    <section class="page">
      <a routerLink="/imports">Back to Historical Imports</a>

      @if (loading()) {
        <app-state-message title="Loading review queue" message="Retrieving unresolved identity records." />
      } @else if (error()) {
        <app-state-message title="Review queue unavailable" [message]="error()!" tone="error" />
      } @else if (!batch()) {
        <app-state-message title="Import batch not found" message="This import batch is not available." tone="error" />
      } @else {
        <header>
          <p class="meta">{{ batch()!.source_type }} | {{ batch()!.status }}</p>
          <h3>{{ batch()!.source_filename }}</h3>
          <dl>
            <div><dt>Records</dt><dd>{{ batch()!.total_records }}</dd></div>
            <div><dt>Review required</dt><dd>{{ batch()!.review_required_count }}</dd></div>
            <div><dt>Invalid</dt><dd>{{ batch()!.invalid_count }}</dd></div>
            <div><dt>Resolved</dt><dd>{{ batch()!.resolved_count }}</dd></div>
          </dl>
        </header>

        @if (!records().length) {
          <app-state-message title="Identity review complete" message="This batch is ready for the next migration step." />
        } @else {
          <div class="queue" aria-label="Identity review queue">
            @for (record of records(); track record.id) {
              <a class="queue-item" [routerLink]="['/imports', batchId, 'review', record.id]">
                <strong>{{ value(record, 'first_name') }} {{ value(record, 'last_name') }}</strong>
                <span>{{ value(record, 'email') }} | {{ value(record, 'mobile') }}</span>
                <span>{{ importEvidenceLabel(record.resolution_reason) }}</span>
              </a>
            }
          </div>
        }
      }
    </section>
  `,
  styles: `
    .page { display: grid; gap: 1rem; }
    header, .queue-item { display: grid; gap: 0.5rem; padding: 1rem; border: 1px solid #dce5ea; border-radius: 1rem; background: #fff; }
    h3 { margin: 0; color: #173248; }
    .meta { margin: 0; color: #607b8d; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; }
    dl { display: flex; flex-wrap: wrap; gap: 1.25rem; margin: 0; }
    dt { color: #607b8d; font-size: 0.75rem; }
    dd { margin: 0.2rem 0 0; color: #173248; font-weight: 700; }
    .queue { display: grid; gap: 0.7rem; }
    .queue-item { color: #173248; text-decoration: none; }
    .queue-item:hover, .queue-item:focus-visible { border-color: #2f6f84; box-shadow: 0 0 0 3px rgba(47, 111, 132, 0.15); outline: none; }
    .queue-item span { color: #526f81; }
  `,
})
export class ImportBatchPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ImportReconciliationService);

  readonly batchId = Number(this.route.snapshot.paramMap.get('id'));
  readonly batch = signal<ImportBatchDetail | null>(null);
  readonly records = signal<ImportReviewRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly importEvidenceLabel = importEvidenceLabel;

  constructor() {
    forkJoin({
      batch: this.service.getBatch(this.batchId),
      queue: this.service.getReviewQueue(this.batchId),
    }).subscribe({
      next: ({ batch, queue }) => {
        this.batch.set(batch);
        this.records.set(queue.results);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The review queue could not be loaded right now.');
        this.loading.set(false);
      },
    });
  }

  value(record: ImportReviewRecord, key: string): string {
    return record.normalized_data[key] ?? 'Not provided';
  }
}
