import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PeopleService } from '../../core/people/people.service';
import {
  PaginatedPersonAuditHistoryResponse,
  PersonAuditFieldChange,
  PersonAuditHistoryEvent,
} from '../../core/people/people.types';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

interface RenderedAuditChange {
  label: string;
  from?: string;
  to?: string;
}

@Component({
  selector: 'app-person-audit-history-section',
  imports: [CommonModule, CrmSectionCardComponent, StateMessageComponent],
  template: `
    <app-crm-section-card title="Audit History">
      <div class="audit-section">
        @if (loading() && !loaded()) {
          <app-state-message title="Loading audit history" message="Retrieving recorded audit history for this person." />
        } @else if (errorMessage()) {
          <app-state-message
            title="Audit history could not be loaded"
            [message]="errorMessage()!"
            tone="error"
          >
            <button type="button" class="button-secondary" (click)="retry()">Retry</button>
          </app-state-message>
        } @else {
          <div class="audit-results">
            <div class="audit-toolbar">
              <p class="audit-supporting-copy">
                {{ countLabel() }}
              </p>
            </div>

            @if (!events().length) {
              <app-state-message message="No audit history recorded." />
            } @else {
              <ol class="audit-list" aria-live="polite">
                @for (event of events(); track event.id) {
                  <li class="audit-item">
                    <article class="audit-card">
                      <div class="audit-header">
                        <div class="audit-summary">
                          <h4>{{ event.description }}</h4>
                          <p>
                            {{ formatDateTime(event.occurred_at) }} · {{ actorLabel(event) }}
                          </p>
                        </div>
                      </div>

                      @if (getRenderedChanges(event).length) {
                        <dl class="audit-changes">
                          @for (change of getRenderedChanges(event); track change.label) {
                            <div class="audit-change-row">
                              <dt>{{ change.label }}</dt>
                              <dd>
                                @if (change.from !== undefined && change.to !== undefined) {
                                  <span>{{ change.from }}</span>
                                  <span class="audit-change-arrow" aria-hidden="true">→</span>
                                  <span>{{ change.to }}</span>
                                } @else if (change.to !== undefined) {
                                  <span>{{ change.to }}</span>
                                }
                              </dd>
                            </div>
                          }
                        </dl>
                      }
                    </article>
                  </li>
                }
              </ol>
            }

            @if (loading() && loaded()) {
              <p class="audit-supporting-copy">Refreshing audit history.</p>
            }

            @if (hasPagination()) {
              <div class="audit-pagination">
                <button
                  type="button"
                  class="button-secondary"
                  [disabled]="!hasPreviousPage() || loading()"
                  (click)="goToPreviousPage()"
                >
                  Previous
                </button>
                <p>Showing newest recorded events first.</p>
                <button
                  type="button"
                  class="button-secondary"
                  [disabled]="!hasNextPage() || loading()"
                  (click)="goToNextPage()"
                >
                  Next
                </button>
              </div>
            }
          </div>
        }
      </div>
    </app-crm-section-card>
  `,
  styles: `
    :host {
      display: block;
    }

    .audit-section,
    .audit-results,
    .audit-list,
    .audit-card,
    .audit-changes {
      display: grid;
      gap: 0.9rem;
    }

    .audit-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .audit-item {
      margin: 0;
    }

    .audit-toolbar,
    .audit-pagination,
    .audit-change-row,
    .audit-header {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .audit-toolbar {
      justify-content: space-between;
      align-items: center;
    }

    .audit-card {
      padding: 1rem 1.05rem;
      border-radius: 1rem;
      border: 1px solid rgba(22, 39, 53, 0.08);
      background: rgba(247, 250, 252, 0.78);
    }

    .audit-summary,
    .audit-change-row {
      min-width: 0;
    }

    .audit-summary h4,
    .audit-summary p,
    .audit-supporting-copy,
    .audit-pagination p,
    .audit-changes dt,
    .audit-changes dd {
      margin: 0;
    }

    .audit-summary {
      display: grid;
      gap: 0.3rem;
    }

    .audit-summary h4 {
      font-size: 1rem;
      line-height: 1.4;
      color: #1a3142;
    }

    .audit-summary p,
    .audit-supporting-copy,
    .audit-pagination p,
    .audit-changes dd {
      color: #4f697b;
      line-height: 1.5;
    }

    .audit-supporting-copy {
      color: #617b8c;
    }

    .audit-changes {
      padding-top: 0.1rem;
    }

    .audit-change-row {
      align-items: start;
      justify-content: space-between;
      border-top: 1px solid rgba(79, 105, 123, 0.12);
      padding-top: 0.75rem;
    }

    .audit-change-row dt {
      flex: 0 0 11rem;
      font-size: 0.85rem;
      font-weight: 700;
      color: #617b8c;
    }

    .audit-change-row dd {
      display: inline-flex;
      gap: 0.45rem;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      text-align: right;
      min-width: 0;
    }

    .audit-change-arrow {
      color: #617b8c;
    }

    .audit-pagination {
      justify-content: space-between;
      align-items: center;
      padding-top: 0.15rem;
    }

    button {
      cursor: pointer;
    }

    button[disabled] {
      cursor: not-allowed;
    }

    @media (max-width: 720px) {
      .audit-change-row,
      .audit-pagination {
        align-items: stretch;
      }

      .audit-change-row dd {
        justify-content: flex-start;
        text-align: left;
      }
    }
  `,
})
export class PersonAuditHistorySectionComponent {
  readonly personId = input.required<number>();

  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly events = signal<PersonAuditHistoryEvent[]>([]);
  readonly count = signal(0);
  readonly currentPage = signal(1);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hasNextPage = signal(false);
  readonly hasPreviousPage = signal(false);
  readonly hasPagination = computed(() => this.hasNextPage() || this.hasPreviousPage());
  readonly countLabel = computed(() => {
    const count = this.count();
    return count === 1 ? '1 recorded visible event.' : `${count} recorded visible events.`;
  });

  constructor() {
    effect(
      () => {
        const personId = this.personId();

        untracked(() => {
          this.resetState();
          this.loadPage(personId, 1);
        });
      },
      { allowSignalWrites: true },
    );
  }

  retry(): void {
    this.loadPage(this.personId(), this.currentPage());
  }

  goToNextPage(): void {
    if (!this.hasNextPage() || this.loading()) {
      return;
    }

    this.loadPage(this.personId(), this.currentPage() + 1);
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage() || this.loading()) {
      return;
    }

    this.loadPage(this.personId(), this.currentPage() - 1);
  }

  actorLabel(event: PersonAuditHistoryEvent): string {
    return event.actor?.email ?? 'System';
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  getRenderedChanges(event: PersonAuditHistoryEvent): RenderedAuditChange[] {
    const rows: RenderedAuditChange[] = [];

    for (const [fieldName, rawValue] of Object.entries(event.changes ?? {})) {
      const change = coerceAuditFieldChange(rawValue);
      if (!change) {
        continue;
      }

      if (change.changed === true && change.from === undefined && change.to === undefined) {
        continue;
      }

      rows.push({
        label: formatAuditFieldLabel(fieldName),
        from: formatAuditValue(change.from),
        to: formatAuditValue(change.to),
      });
    }

    return rows;
  }

  private loadPage(personId: number, page: number): void {
    if (this.loading()) {
      return;
    }

    this.currentPage.set(page);
    this.loading.set(true);
    this.errorMessage.set(null);

    this.peopleService
      .getPersonAuditHistory(personId, page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.applyResponse(response, page);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.loaded.set(true);
          this.errorMessage.set(formatAuditHistoryError(error));
        },
        complete: () => {
          this.loading.set(false);
        },
      });
  }

  private applyResponse(response: PaginatedPersonAuditHistoryResponse, page: number): void {
    this.events.set(response.results);
    this.count.set(response.count);
    this.hasNextPage.set(Boolean(response.next));
    this.hasPreviousPage.set(Boolean(response.previous));
    this.loaded.set(true);
    this.errorMessage.set(null);
  }

  private resetState(): void {
    this.events.set([]);
    this.count.set(0);
    this.currentPage.set(1);
    this.loading.set(false);
    this.loaded.set(false);
    this.errorMessage.set(null);
    this.hasNextPage.set(false);
    this.hasPreviousPage.set(false);
  }
}

function coerceAuditFieldChange(value: unknown): PersonAuditFieldChange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const allowedKeys = ['from', 'to', 'changed'];

  if (!Object.keys(candidate).every((key) => allowedKeys.includes(key))) {
    return null;
  }

  const result: PersonAuditFieldChange = {};

  if ('from' in candidate && isSafeAuditPrimitive(candidate['from'])) {
    result.from = candidate['from'];
  }

  if ('to' in candidate && isSafeAuditPrimitive(candidate['to'])) {
    result.to = candidate['to'];
  }

  if ('changed' in candidate && typeof candidate['changed'] === 'boolean') {
    result.changed = candidate['changed'];
  }

  if (!('from' in result) && !('to' in result) && !('changed' in result)) {
    return null;
  }

  return result;
}

function isSafeAuditPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function formatAuditFieldLabel(fieldName: string): string {
  const normalized = fieldName.trim().replace(/_/g, ' ');
  if (!normalized) {
    return 'Change';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatAuditValue(value: string | number | boolean | null | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return 'None';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

function formatAuditHistoryError(error: HttpErrorResponse): string {
  if (error.status === 403) {
    return "We couldn't load audit history for this account.";
  }

  if (error.status === 404) {
    return "We couldn't load audit history for this person.";
  }

  return "We couldn't load audit history.";
}
