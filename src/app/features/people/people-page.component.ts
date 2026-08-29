import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

import { PeopleService } from '../../core/people/people.service';
import {
  PaginatedResponse,
  PersonListItem,
  PeopleListQueryState,
  PeopleOrdering,
  PeoplePageSize,
  PersonRecordState,
} from '../../core/people/people.types';

const DEFAULT_QUERY_STATE: PeopleListQueryState = {
  q: '',
  record_state: 'active',
  ordering: 'last_name',
  page: 1,
  page_size: 25,
};

const VALID_RECORD_STATES: PersonRecordState[] = ['active', 'archived', 'all'];
const VALID_ORDERINGS: PeopleOrdering[] = [
  'first_name',
  '-first_name',
  'last_name',
  '-last_name',
  'created_at',
  '-created_at',
  'updated_at',
  '-updated_at',
];
const VALID_PAGE_SIZES: PeoplePageSize[] = [25, 50, 100];

interface OrderingOption {
  label: string;
  value: PeopleOrdering;
}

@Component({
  selector: 'app-people-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page">
      <form class="controls" [formGroup]="filters" aria-label="People list controls">
        <label class="search-field">
          <span>Search</span>
          <input
            type="search"
            formControlName="q"
            placeholder="Search by name, email, or mobile"
          />
        </label>

        <label>
          <span>Record state</span>
          <select formControlName="record_state">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>

        <label>
          <span>Order by</span>
          <select formControlName="ordering">
            @for (option of orderingOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>

        <label>
          <span>Page size</span>
          <select formControlName="page_size">
            @for (size of pageSizes; track size) {
              <option [value]="size">{{ size }}</option>
            }
          </select>
        </label>
      </form>

      @if (loading()) {
        <section class="state-card" aria-live="polite">
          <p>Loading people...</p>
        </section>
      } @else if (errorMessage()) {
        <section class="state-card state-card-error" aria-live="polite">
          <p>{{ errorMessage() }}</p>
        </section>
      } @else if (!peopleResponse() || peopleResponse()!.results.length === 0) {
        <section class="state-card" aria-live="polite">
          <p>{{ emptyMessage() }}</p>
        </section>
      } @else {
        <section class="results-card">
          <div class="results-meta">
            <p class="results-count">{{ peopleResponse()!.count }} people</p>
            <p class="results-page">Page {{ currentPage() }} of {{ totalPages() }}</p>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Mobile</th>
                  <th scope="col">Location</th>
                </tr>
              </thead>
              <tbody>
                @for (person of peopleResponse()!.results; track person.id) {
                  <tr class="person-row">
                    <td data-label="Name">
                      <a [routerLink]="['/people', person.id]" class="row-link">
                        {{ fullName(person) }}
                      </a>
                    </td>
                    <td data-label="Email">{{ person.primary_email || '-' }}</td>
                    <td data-label="Mobile">{{ person.mobile || '-' }}</td>
                    <td data-label="Location">{{ person.location || '-' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="pagination">
            <button
              type="button"
              class="pagination-button"
              (click)="goToPage(currentPage() - 1)"
              [disabled]="!peopleResponse()!.previous"
            >
              Previous
            </button>
            <button
              type="button"
              class="pagination-button"
              (click)="goToPage(currentPage() + 1)"
              [disabled]="!peopleResponse()!.next"
            >
              Next
            </button>
          </div>
        </section>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .page {
      display: grid;
      gap: 0.9rem;
    }

    .controls,
    .results-card,
    .state-card {
      display: grid;
      gap: 0.9rem;
      padding: 1.2rem 1.25rem;
      border-radius: 1.1rem;
      border: 1px solid rgba(22, 39, 53, 0.08);
      background: rgba(255, 255, 255, 0.88);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 10px 24px rgba(17, 29, 40, 0.04);
    }

    .state-card p {
      margin: 0;
    }

    .state-card p {
      max-width: 42rem;
      color: #4f697b;
      line-height: 1.5;
    }

    .controls {
      grid-template-columns: minmax(0, 2.7fr) repeat(3, minmax(8.75rem, 0.95fr));
      align-items: end;
      gap: 0.85rem 1rem;
    }

    label {
      display: grid;
      gap: 0.4rem;
      color: #1c3344;
      font-weight: 600;
    }

    label span {
      margin: 0;
      font-size: 0.8rem;
      font-weight: 700;
      color: #5c7789;
    }

    input,
    select,
    .pagination-button {
      border: 1px solid #b7c7d4;
      border-radius: 0.8rem;
      padding: 0.72rem 0.88rem;
      font: inherit;
      background: #fdfefe;
      color: #173248;
      transition:
        border-color 120ms ease,
        box-shadow 120ms ease,
        background-color 120ms ease,
        color 120ms ease;
    }

    input::placeholder {
      color: #8097a6;
    }

    input:focus-visible,
    select:focus-visible,
    .pagination-button:focus-visible,
    .row-link:focus-visible {
      outline: none;
      border-color: #5d88a0;
      box-shadow: 0 0 0 3px rgba(108, 154, 180, 0.2);
    }

    .results-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .results-count,
    .results-page {
      margin: 0;
      font-size: 0.9rem;
      color: #5b7383;
    }

    .results-count {
      font-weight: 700;
      color: #234257;
    }

    .table-wrap {
      overflow-x: auto;
      border-radius: 0.9rem;
      border: 1px solid rgba(22, 39, 53, 0.08);
      background: rgba(251, 253, 254, 0.92);
    }

    table {
      width: 100%;
      min-width: 40rem;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 0.82rem 1rem;
      border-bottom: 1px solid rgba(22, 39, 53, 0.08);
      text-align: left;
      vertical-align: top;
    }

    th {
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #5b7383;
      background: rgba(244, 248, 250, 0.94);
    }

    td {
      color: #274356;
    }

    .person-row {
      transition: background-color 120ms ease;
    }

    .person-row:hover,
    .person-row:focus-within {
      background: rgba(240, 246, 249, 0.96);
    }

    .row-link {
      display: inline-block;
      border-radius: 0.35rem;
      color: #173248;
      font-weight: 700;
      text-decoration: none;
    }

    .row-link:hover,
    .row-link:focus-visible {
      color: #1d6077;
      text-decoration: underline;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding-top: 0.15rem;
    }

    .pagination-button {
      min-width: 7.25rem;
      font-weight: 700;
      cursor: pointer;
      background: #f8fbfc;
    }

    .pagination-button:not(:disabled):hover {
      background: #f0f6f8;
      border-color: #9db7c6;
    }

    .pagination-button:disabled {
      cursor: not-allowed;
      opacity: 1;
      color: #8aa0ae;
      border-color: #d5dfe6;
      background: #f3f6f8;
      box-shadow: none;
    }

    .state-card {
      min-height: 9.5rem;
      align-content: center;
    }

    .state-card-error {
      background: rgba(255, 250, 250, 0.94);
      border-color: rgba(184, 81, 81, 0.16);
    }

    .state-card-error p {
      color: #9b1c1c;
      font-weight: 600;
    }

    @media (max-width: 900px) {
      .controls {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }

      .search-field {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 680px) {
      .controls {
        grid-template-columns: 1fr;
      }

      .table-wrap {
        border: 0;
        background: transparent;
      }

      table,
      thead,
      tbody,
      tr,
      th,
      td {
        display: block;
      }

      table {
        min-width: 0;
      }

      thead {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }

      tr {
        padding: 0.2rem 0;
        border-bottom: 1px solid rgba(22, 39, 53, 0.08);
      }

      td {
        padding: 0.5rem 0.95rem;
        border-bottom: 0;
      }

      td::before {
        content: attr(data-label);
        display: block;
        margin-bottom: 0.15rem;
        font-size: 0.74rem;
        font-weight: 700;
        color: #617d90;
      }

      .pagination {
        justify-content: stretch;
      }

      .pagination-button {
        flex: 1 1 10rem;
      }
    }
  `,
})
export class PeoplePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderingOptions: OrderingOption[] = [
    { label: 'Name A-Z', value: 'last_name' },
    { label: 'Name Z-A', value: '-last_name' },
    { label: 'First name A-Z', value: 'first_name' },
    { label: 'First name Z-A', value: '-first_name' },
    { label: 'Recently added', value: '-created_at' },
    { label: 'Oldest added', value: 'created_at' },
    { label: 'Recently updated', value: '-updated_at' },
    { label: 'Oldest updated', value: 'updated_at' },
  ];
  readonly pageSizes: PeoplePageSize[] = VALID_PAGE_SIZES;

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly peopleResponse = signal<PaginatedResponse<PersonListItem> | null>(null);
  readonly queryState = signal<PeopleListQueryState>(DEFAULT_QUERY_STATE);

  readonly filters = this.fb.nonNullable.group({
    q: DEFAULT_QUERY_STATE.q,
    record_state: DEFAULT_QUERY_STATE.record_state,
    ordering: DEFAULT_QUERY_STATE.ordering,
    page_size: DEFAULT_QUERY_STATE.page_size,
  });

  readonly currentPage = computed(() => this.queryState().page);
  readonly totalPages = computed(() => {
    const response = this.peopleResponse();
    if (!response) {
      return 1;
    }

    return Math.max(1, Math.ceil(response.count / this.queryState().page_size));
  });
  readonly emptyMessage = computed(() => {
    const { q, record_state } = this.queryState();

    if (q) {
      return 'No people matched the current search.';
    }

    if (record_state === 'archived') {
      return 'No archived people are available.';
    }

    return 'No people are available yet.';
  });

  constructor() {
    this.route.queryParamMap
      .pipe(
        map((params) => parseQueryState(params)),
        distinctUntilChanged(areQueryStatesEqual),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => {
        this.queryState.set(state);
        this.filters.patchValue(
          {
            q: state.q,
            record_state: state.record_state,
            ordering: state.ordering,
            page_size: state.page_size,
          },
          { emitEvent: false },
        );
        this.loadPeople(state);
      });

    this.filters.controls.q.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((q) => {
        this.updateUrlState({ q: q.trim(), page: 1 });
      });

    this.filters.controls.record_state.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((recordState) => {
        this.updateUrlState({ record_state: recordState, page: 1 });
      });

    this.filters.controls.ordering.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((ordering) => {
        this.updateUrlState({ ordering, page: 1 });
      });

    this.filters.controls.page_size.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((pageSize) => {
        this.updateUrlState({ page_size: Number(pageSize) as PeoplePageSize, page: 1 });
      });
  }

  fullName(person: PersonListItem): string {
    return `${person.first_name} ${person.last_name}`;
  }

  goToPage(page: number): void {
    if (page < 1 || page === this.queryState().page) {
      return;
    }

    this.updateUrlState({ page });
  }

  private loadPeople(state: PeopleListQueryState): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.peopleService
      .listPeople(state)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.peopleResponse.set(response);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.peopleResponse.set(null);
          this.loading.set(false);
          this.errorMessage.set(
            error.status >= 500
              ? 'People could not be loaded right now.'
              : 'People could not be loaded for the current request.',
          );
        },
      });
  }

  private updateUrlState(patch: Partial<PeopleListQueryState>): void {
    const nextState = { ...this.queryState(), ...patch };

    if (areQueryStatesEqual(this.queryState(), nextState)) {
      return;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: buildQueryParams(nextState),
    });
  }
}

function parseQueryState(params: ParamMap): PeopleListQueryState {
  const q = (params.get('q') ?? '').trim();
  const recordState = params.get('record_state');
  const ordering = params.get('ordering');
  const page = Number(params.get('page'));
  const pageSize = Number(params.get('page_size'));

  return {
    q,
    record_state: isRecordState(recordState) ? recordState : DEFAULT_QUERY_STATE.record_state,
    ordering: isOrdering(ordering) ? ordering : DEFAULT_QUERY_STATE.ordering,
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_QUERY_STATE.page,
    page_size: isPageSize(pageSize) ? pageSize : DEFAULT_QUERY_STATE.page_size,
  };
}

function buildQueryParams(state: PeopleListQueryState): Record<string, string | null> {
  return {
    q: state.q || null,
    record_state:
      state.record_state === DEFAULT_QUERY_STATE.record_state ? null : state.record_state,
    ordering: state.ordering === DEFAULT_QUERY_STATE.ordering ? null : state.ordering,
    page: state.page === DEFAULT_QUERY_STATE.page ? null : String(state.page),
    page_size: state.page_size === DEFAULT_QUERY_STATE.page_size ? null : String(state.page_size),
  };
}

function areQueryStatesEqual(left: PeopleListQueryState, right: PeopleListQueryState): boolean {
  return (
    left.q === right.q &&
    left.record_state === right.record_state &&
    left.ordering === right.ordering &&
    left.page === right.page &&
    left.page_size === right.page_size
  );
}

function isRecordState(value: string | null): value is PersonRecordState {
  return value !== null && VALID_RECORD_STATES.includes(value as PersonRecordState);
}

function isOrdering(value: string | null): value is PeopleOrdering {
  return value !== null && VALID_ORDERINGS.includes(value as PeopleOrdering);
}

function isPageSize(value: number): value is PeoplePageSize {
  return VALID_PAGE_SIZES.includes(value as PeoplePageSize);
}
