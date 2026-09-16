import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import {
  audienceQueryFromPeopleDirectory,
  audienceSelection,
  areAudiencePreviewQueriesEqual,
  DEFAULT_AUDIENCE_PREVIEW_QUERY,
  parseAudiencePreviewQuery,
  serializeAudiencePreviewQuery,
  withAudiencePreviewChange,
} from '../../core/marketing/audience-preview-query';
import { AudiencePreviewService } from '../../core/marketing/audience-preview.service';
import {
  AudienceExclusionReason,
  AudiencePreviewPerson,
  AudiencePreviewQuery,
  AudiencePreviewResponse,
  AudienceResultView,
} from '../../core/marketing/audience.types';
import { PeopleDirectoryQuery, PeopleOrdering, PeoplePageSize } from '../../core/people/people.types';
import { PeopleDirectoryFiltersComponent } from '../people/people-directory-filters.component';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';

const PAGE_SIZES: PeoplePageSize[] = [25, 50, 100];

const ORDERING_OPTIONS: Array<{ label: string; value: PeopleOrdering }> = [
  { label: 'Last name', value: 'last_name' },
  { label: 'Name A-Z', value: 'name' },
  { label: 'Name Z-A', value: '-name' },
  { label: 'Newest CRM record', value: '-created_at' },
  { label: 'Oldest CRM record', value: 'created_at' },
  { label: 'Recently updated', value: '-updated_at' },
  { label: 'Least recently updated', value: 'updated_at' },
  { label: 'Newest members', value: '-membership_joined_at' },
  { label: 'Oldest members', value: 'membership_joined_at' },
];

const EXCLUSION_LABELS: Record<AudienceExclusionReason, string> = {
  EXCLUDED_OPTED_OUT: 'Opted out',
  EXCLUDED_CONSENT_UNKNOWN: 'Consent unknown',
  EXCLUDED_NO_EMAIL: 'No email address',
};

const EXCLUSION_EXPLANATIONS: Record<AudienceExclusionReason, string> = {
  EXCLUDED_OPTED_OUT: 'This person has opted out of email marketing.',
  EXCLUDED_CONSENT_UNKNOWN: 'No recorded email marketing consent.',
  EXCLUDED_NO_EMAIL: 'No email address is available.',
};

@Component({
  selector: 'app-audience-preview-page',
  imports: [CommonModule, RouterLink, PeopleDirectoryFiltersComponent, CrmSectionCardComponent, StatusBadgeComponent],
  template: `
    <section class="audience-page">
      <a routerLink="/people" class="back-link">Back to People</a>

      <header class="page-heading">
        <div>
          <p class="eyebrow">Marketing</p>
          <h1>Audience Preview</h1>
          <p class="intro">Choose who you want to reach using CRM criteria. Elevate will show who is currently eligible to receive marketing email.</p>
        </div>
      </header>

      <app-crm-section-card title="Audience criteria">
        <app-people-directory-filters
          [query]="directoryQuery()"
          (changed)="selectionChanged($event)"
          (cleared)="clearFilters()"
        />
        <div class="display-controls" aria-label="Audience preview display controls">
          <label>
            <span>Order by</span>
            <select [value]="queryState().ordering" (change)="changeOrdering($any($event.target).value)">
              @for (option of orderingOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </label>
          <label>
            <span>Page size</span>
            <select [value]="queryState().page_size" (change)="changePageSize($any($event.target).value)">
              @for (size of pageSizes; track size) {
                <option [value]="size">{{ size }}</option>
              }
            </select>
          </label>
        </div>
      </app-crm-section-card>

      @if (response(); as preview) {
        <section class="summary-grid" aria-label="Audience summary">
          <article class="summary-card">
            <p class="summary-label">Selected</p>
            <p class="summary-value">{{ preview.selected_count }}</p>
            <p>People matching the current audience criteria.</p>
          </article>
          <article class="summary-card summary-card-positive">
            <p class="summary-label">Eligible</p>
            <p class="summary-value">{{ preview.eligible_count }}</p>
            <p>Can currently receive EMAIL marketing.</p>
          </article>
          <article class="summary-card summary-card-warning">
            <p class="summary-label">Excluded</p>
            <p class="summary-value">{{ preview.excluded_count }}</p>
            <p>Match the criteria but cannot currently receive EMAIL marketing.</p>
          </article>
        </section>

        @if (preview.excluded_count > 0) {
          <app-crm-section-card title="Exclusion breakdown">
            <dl class="breakdown">
              @for (reason of exclusionReasons; track reason) {
                <div>
                  <dt>{{ exclusionLabel(reason) }}</dt>
                  <dd>{{ preview.exclusion_counts[reason] }}</dd>
                </div>
              }
            </dl>
          </app-crm-section-card>
        }
      }

      <section class="results-panel" aria-label="Audience results">
        <div class="results-heading">
          <div>
            <p class="eyebrow">CRM eligibility</p>
            <h2>People results</h2>
          </div>
          @if (response(); as preview) {
            <p class="result-count">{{ preview.results.count }} {{ activeResultLabel().toLowerCase() }}</p>
          }
        </div>

        <div class="result-tabs" role="tablist" aria-label="Audience result views">
          @for (view of resultViews; track view) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="queryState().result === view"
              [class.active]="queryState().result === view"
              (click)="changeResult(view)"
            >{{ resultLabel(view) }}</button>
          }
        </div>

        @if (loading()) {
          <div class="state-card" aria-live="polite"><p>Loading audience preview...</p></div>
        } @else if (errorMessage()) {
          <div class="state-card state-card-error" role="alert">
            <p>{{ errorMessage() }}</p>
            <button type="button" class="crm-button crm-button--secondary" (click)="retry()">Retry</button>
          </div>
        } @else if (response(); as preview) {
          @if (preview.results.results.length === 0) {
            <div class="state-card" aria-live="polite"><p>{{ emptyMessage(preview) }}</p></div>
          } @else {
            <div class="table-wrap">
              <table>
                <caption class="sr-only">{{ activeResultLabel() }} audience People</caption>
                <thead>
                  <tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Marketing eligibility</th></tr>
                </thead>
                <tbody>
                  @for (person of preview.results.results; track person.id) {
                    <tr>
                      <td data-label="Name"><a [routerLink]="['/people', person.id]">{{ fullName(person) }}</a></td>
                      <td data-label="Email">{{ person.primary_email || '-' }}</td>
                      <td data-label="Marketing eligibility">
                        @if (person.classification === 'ELIGIBLE') {
                          <app-status-badge label="Eligible" tone="success" />
                        } @else {
                          <div class="excluded-status">
                            <app-status-badge [label]="exclusionLabel(person.exclusion_reasons[0])" tone="warning" />
                            <span>{{ exclusionExplanation(person.exclusion_reasons[0]) }}</span>
                          </div>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="pagination" aria-label="Audience results pagination">
              <button type="button" class="crm-button crm-button--secondary" [disabled]="preview.results.previous_page === null" (click)="goToPage(preview.results.previous_page)">Previous</button>
              <span>Page {{ preview.results.page }}</span>
              <button type="button" class="crm-button crm-button--secondary" [disabled]="preview.results.next_page === null" (click)="goToPage(preview.results.next_page)">Next</button>
            </div>
          }
        }
      </section>
    </section>
  `,
  styles: `
    :host { display: block; }
    .audience-page { display: grid; gap: var(--crm-space-4); }
    .back-link { color: var(--crm-text-secondary); font-size: var(--crm-font-sm); font-weight: 600; }
    .page-heading, .results-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: end; }
    h1, h2, p { margin: 0; }
    h1 { color: var(--crm-text-strong); font-size: clamp(1.45rem, 2.5vw, 2rem); }
    h2 { color: var(--crm-text-strong); font-size: var(--crm-font-lg); }
    .intro { max-width: 48rem; margin-top: .45rem; color: var(--crm-text-secondary); line-height: 1.55; }
    .eyebrow { margin-bottom: .25rem; color: var(--crm-text-muted); font-size: var(--crm-font-sm); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .display-controls { display: flex; flex-wrap: wrap; gap: .8rem; margin-top: 1rem; }
    .display-controls label { display: grid; gap: .3rem; min-width: 12rem; color: var(--crm-text-secondary); font-size: var(--crm-font-sm); font-weight: 600; }
    select { min-height: 2.75rem; padding: .55rem .7rem; border: 1px solid var(--crm-border); border-radius: var(--crm-radius-sm); background: var(--crm-surface); color: var(--crm-text-strong); font: inherit; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--crm-space-4); }
    .summary-card { display: grid; gap: .45rem; padding: 1.1rem 1.2rem; border: 1px solid var(--crm-border); border-radius: var(--crm-radius-lg); background: var(--crm-surface); box-shadow: var(--crm-shadow-sm); }
    .summary-card-positive { border-color: color-mix(in srgb, var(--crm-success) 25%, var(--crm-border)); }
    .summary-card-warning { border-color: color-mix(in srgb, var(--crm-warning) 30%, var(--crm-border)); }
    .summary-label { color: var(--crm-text-secondary); font-weight: 700; }
    .summary-value { color: var(--crm-text-strong); font-size: 2rem; font-weight: 700; line-height: 1; }
    .summary-card p:last-child { color: var(--crm-text-muted); font-size: var(--crm-font-sm); line-height: 1.4; }
    .breakdown { display: grid; gap: .6rem; margin: 0; max-width: 28rem; }
    .breakdown div { display: flex; justify-content: space-between; gap: 1rem; padding-bottom: .5rem; border-bottom: 1px solid var(--crm-border); }
    .breakdown dt { color: var(--crm-text-secondary); }
    .breakdown dd { margin: 0; color: var(--crm-text-strong); font-weight: 700; }
    .results-panel { display: grid; gap: var(--crm-space-4); padding: 1.2rem 1.25rem; border: 1px solid var(--crm-border); border-radius: var(--crm-radius-lg); background: var(--crm-surface); box-shadow: var(--crm-shadow-sm); }
    .result-count { color: var(--crm-text-muted); font-size: var(--crm-font-sm); }
    .result-tabs { display: flex; flex-wrap: wrap; gap: .45rem; border-bottom: 1px solid var(--crm-border); }
    .result-tabs button { min-height: 2.65rem; padding: .55rem .9rem; border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--crm-text-secondary); font: inherit; font-weight: 700; cursor: pointer; }
    .result-tabs button.active { border-bottom-color: var(--crm-shell-accent); color: var(--crm-text-strong); }
    .result-tabs button:focus-visible, a:focus-visible, button:focus-visible, select:focus-visible { outline: 2px solid var(--crm-focus-ring); outline-offset: 3px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: .85rem .7rem; border-bottom: 1px solid var(--crm-border); text-align: left; vertical-align: top; }
    th { color: var(--crm-text-muted); font-size: var(--crm-font-sm); font-weight: 700; }
    td { color: var(--crm-text-secondary); }
    td a { color: var(--crm-text-strong); font-weight: 700; }
    .excluded-status { display: grid; gap: .35rem; }
    .excluded-status span { color: var(--crm-text-muted); font-size: var(--crm-font-sm); line-height: 1.4; }
    .state-card { display: grid; gap: .8rem; justify-items: start; padding: 1.25rem; border: 1px dashed var(--crm-border); border-radius: var(--crm-radius-md); color: var(--crm-text-secondary); }
    .state-card-error { border-style: solid; color: var(--crm-error); }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; color: var(--crm-text-secondary); }
    .crm-button { min-height: 2.75rem; padding: .6rem 1rem; border: 1px solid var(--crm-border); border-radius: var(--crm-radius-sm); background: var(--crm-surface); color: var(--crm-text-strong); font: inherit; font-weight: 700; cursor: pointer; }
    .crm-button:disabled { cursor: not-allowed; opacity: .55; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 700px) { .summary-grid { grid-template-columns: 1fr; } .page-heading, .results-heading { align-items: start; flex-direction: column; } .display-controls label { width: 100%; } }
    @media (max-width: 600px) { th { display: none; } td { display: grid; grid-template-columns: 8rem minmax(0, 1fr); gap: .6rem; } td::before { content: attr(data-label); color: var(--crm-text-muted); font-size: var(--crm-font-sm); font-weight: 700; } }
  `,
})
export class AudiencePreviewPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AudiencePreviewService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSizes = PAGE_SIZES;
  readonly orderingOptions = ORDERING_OPTIONS;
  readonly resultViews: AudienceResultView[] = ['all', 'eligible', 'excluded'];
  readonly exclusionReasons: AudienceExclusionReason[] = ['EXCLUDED_CONSENT_UNKNOWN', 'EXCLUDED_OPTED_OUT', 'EXCLUDED_NO_EMAIL'];
  readonly queryState = signal<AudiencePreviewQuery>(DEFAULT_AUDIENCE_PREVIEW_QUERY);
  readonly response = signal<AudiencePreviewResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly directoryQuery = computed<PeopleDirectoryQuery>(() => ({ ...this.queryState(), record_state: 'active' }));

  constructor() {
    this.route.queryParamMap.pipe(
      map((params) => parseAudiencePreviewQuery(params)),
      distinctUntilChanged(areAudiencePreviewQueriesEqual),
      tap((query) => {
        this.queryState.set(query);
        this.loading.set(true);
        this.errorMessage.set(null);
      }),
      switchMap((query) => this.service.preview(this.requestFor(query)).pipe(
        map((response) => ({ response, error: null as HttpErrorResponse | null })),
        catchError((error: HttpErrorResponse) => of({ response: null, error })),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ response, error }) => {
      this.loading.set(false);
      if (error) {
        this.response.set(null);
        this.errorMessage.set(error.status === 403 ? 'You do not have permission to preview audiences.' : 'The audience preview could not be loaded right now. Try again.');
        return;
      }
      this.response.set(response);
    });
  }

  selectionChanged(patch: Partial<PeopleDirectoryQuery>): void {
    this.navigate(withAudiencePreviewChange(this.queryState(), patch));
  }

  clearFilters(): void {
    this.navigate({ ...DEFAULT_AUDIENCE_PREVIEW_QUERY, page_size: this.queryState().page_size });
  }

  changeResult(result: AudienceResultView): void {
    this.navigate(withAudiencePreviewChange(this.queryState(), { result }));
  }

  changeOrdering(ordering: PeopleOrdering): void {
    this.navigate(withAudiencePreviewChange(this.queryState(), { ordering }));
  }

  changePageSize(value: string): void {
    this.navigate(withAudiencePreviewChange(this.queryState(), { page_size: Number(value) as PeoplePageSize }));
  }

  goToPage(page: number | null): void {
    if (page === null || page < 1 || page === this.queryState().page) return;
    this.navigate(withAudiencePreviewChange(this.queryState(), { page }, false));
  }

  retry(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.service.preview(this.requestFor(this.queryState())).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => { this.response.set(response); this.loading.set(false); },
      error: (error: HttpErrorResponse) => { this.loading.set(false); this.errorMessage.set(error.status === 403 ? 'You do not have permission to preview audiences.' : 'The audience preview could not be loaded right now. Try again.'); },
    });
  }

  resultLabel(result: AudienceResultView): string { return result === 'all' ? 'All' : result[0].toUpperCase() + result.slice(1); }
  activeResultLabel(): string { return this.resultLabel(this.queryState().result); }
  fullName(person: AudiencePreviewPerson): string { return `${person.first_name} ${person.last_name}`.trim(); }
  exclusionLabel(reason: AudienceExclusionReason | undefined): string { return reason ? EXCLUSION_LABELS[reason] : 'Excluded'; }
  exclusionExplanation(reason: AudienceExclusionReason | undefined): string { return reason ? EXCLUSION_EXPLANATIONS[reason] : 'This person is not currently eligible for email marketing.'; }

  emptyMessage(preview: AudiencePreviewResponse): string {
    if (this.queryState().result === 'all' && preview.selected_count === 0) return 'No People match these audience criteria. Try adjusting the filters.';
    if (this.queryState().result === 'eligible') return preview.selected_count > 0 ? 'None of the selected People are currently eligible for marketing email.' : 'No eligible People match these criteria.';
    if (this.queryState().result === 'excluded') return 'All selected People are currently eligible according to CRM marketing rules.';
    return 'No People match these audience criteria. Try adjusting the filters.';
  }

  private requestFor(query: AudiencePreviewQuery) {
    return { selection: audienceSelection(query), result: query.result, ordering: query.ordering, page: query.page, page_size: query.page_size };
  }

  private navigate(query: AudiencePreviewQuery): void {
    if (areAudiencePreviewQueriesEqual(this.queryState(), query)) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: serializeAudiencePreviewQuery(query) });
  }
}
