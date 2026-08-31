import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { PeopleService } from '../../core/people/people.service';
import { canManagePeople } from '../../core/auth/auth-access';
import { AuthService } from '../../core/auth/auth.service';
import {
  PaginatedResponse,
  PersonListItem,
  PeopleDirectoryQuery,
  PeopleOrdering,
  PeoplePageSize,
} from '../../core/people/people.types';
import { arePeopleDirectoryQueriesEqual, DEFAULT_PEOPLE_DIRECTORY_QUERY, parsePeopleDirectoryQuery, serializePeopleDirectoryQuery, withPeopleDirectoryQueryChange } from '../../core/people/people-directory-query';
import { PeopleDirectoryFiltersComponent } from './people-directory-filters.component';

const VALID_PAGE_SIZES: PeoplePageSize[] = [25, 50, 100];

interface OrderingOption {
  label: string;
  value: PeopleOrdering;
}

@Component({
  selector: 'app-people-page',
  imports: [CommonModule, RouterLink, PeopleDirectoryFiltersComponent],
  template: `
    <section class="page">
      @if (canManagePeople()) {
        <div class="page-actions">
          <a routerLink="/people/new/member" class="button-primary">Add Member</a>
          <a routerLink="/people/new/contact" class="button-secondary">Add Contact</a>
        </div>
      }
      <app-people-directory-filters [query]="queryState()" (changed)="changeDirectoryQuery($event)" (cleared)="clearFilters()" />
      <div class="controls" aria-label="People list display controls">
        <label>
          <span>Record state</span>
          <select [value]="queryState().record_state" (change)="changeDirectoryQuery({ record_state: $any($event.target).value })">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>

        <label>
          <span>Order by</span>
          <select [value]="queryState().ordering" (change)="changeDirectoryQuery({ ordering: $any($event.target).value })">
            @for (option of orderingOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>

        <label>
          <span>Page size</span>
          <select [value]="queryState().page_size" (change)="changeDirectoryQuery({ page_size: parsePageSize($any($event.target).value) })">
            @for (size of pageSizes; track size) {
              <option [value]="size">{{ size }}</option>
            }
          </select>
        </label>
      </div>

      @if (loading()) {
        <section class="state-card" aria-live="polite">
          <p>Loading people...</p>
        </section>
      } @else if (errorMessage()) {
        <section class="state-card state-card-error" aria-live="polite">
          <p>{{ errorMessage() }}</p>
          <button type="button" class="pagination-button" (click)="retry()">Retry</button>
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

    .page-actions { display:flex; justify-content:flex-end; gap:.7rem; flex-wrap:wrap; }
    .button-primary,.button-secondary { border-radius:999px; padding:.72rem 1.05rem; font-weight:700; text-decoration:none; }
    .button-primary { background:#1d6077; color:#fff; } .button-secondary { background:#edf3f6; color:#234257; }

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
      grid-template-columns: repeat(3, minmax(8.75rem, 0.95fr));
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderingOptions: OrderingOption[] = [
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
  readonly pageSizes: PeoplePageSize[] = VALID_PAGE_SIZES;

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly peopleResponse = signal<PaginatedResponse<PersonListItem> | null>(null);
  readonly queryState = signal<PeopleDirectoryQuery>(DEFAULT_PEOPLE_DIRECTORY_QUERY);
  readonly canManagePeople = computed(() => canManagePeople(this.auth.currentUser()));

  readonly currentPage = computed(() => this.queryState().page);
  readonly totalPages = computed(() => {
    const response = this.peopleResponse();
    if (!response) {
      return 1;
    }

    return Math.max(1, Math.ceil(response.count / this.queryState().page_size));
  });
  readonly emptyMessage = computed(() => {
    const query = this.queryState();

    if (query.q || query.relationship.length || query.location.length || query.industry.length || query.career_stage.length || query.interest.length || query.skill.length || query.tag.length) {
      return 'No people match these filters.';
    }

    if (query.record_state === 'archived') {
      return 'No archived people are available.';
    }

    return 'No people are available yet.';
  });

  constructor() {
    this.route.queryParamMap
      .pipe(
        map((params) => parsePeopleDirectoryQuery(params)),
        distinctUntilChanged(arePeopleDirectoryQueriesEqual),
        tap((state) => {
          this.queryState.set(state);
          this.loading.set(true);
          this.errorMessage.set(null);
        }),
        switchMap((state) => this.peopleService.listPeople(state).pipe(
          map((response) => ({ response, error: null as HttpErrorResponse | null })),
          catchError((error: HttpErrorResponse) => of({ response: null, error })),
        )),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ response, error }) => {
        this.loading.set(false);
        if (error) {
          this.peopleResponse.set(null);
          this.errorMessage.set(error.status >= 500 ? 'People could not be loaded right now.' : 'People could not be loaded for the current request.');
          return;
        }
        this.peopleResponse.set(response);
      });
  }

  fullName(person: PersonListItem): string {
    return `${person.first_name} ${person.last_name}`;
  }

  goToPage(page: number): void {
    if (page < 1 || page === this.queryState().page) {
      return;
    }

    this.navigateToQuery(withPeopleDirectoryQueryChange(this.queryState(), { page }, false));
  }

  parsePageSize(value: string): PeoplePageSize {
    return Number(value) as PeoplePageSize;
  }

  changeDirectoryQuery(patch: Partial<PeopleDirectoryQuery>): void {
    this.navigateToQuery(withPeopleDirectoryQueryChange(this.queryState(), patch));
  }

  clearFilters(): void {
    this.navigateToQuery({ ...DEFAULT_PEOPLE_DIRECTORY_QUERY, page_size: this.queryState().page_size });
  }

  retry(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.peopleService
      .listPeople(this.queryState())
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

  private navigateToQuery(nextState: PeopleDirectoryQuery): void {
    if (arePeopleDirectoryQueriesEqual(this.queryState(), nextState)) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializePeopleDirectoryQuery(nextState),
    });
  }
}
