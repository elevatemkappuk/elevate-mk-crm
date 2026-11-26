import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { PeopleService } from '../../core/people/people.service';
import { canManagePeople } from '../../core/auth/auth-access';
import { AuthService } from '../../core/auth/auth.service';
import { StaffAccessService } from '../../core/auth/staff-access.service';
import {
  PaginatedResponse,
  PersonListItem,
  PersonDirectoryItem,
  CommunityAccountStatus,
  PeopleDirectoryQuery,
  PeopleOrdering,
  PeoplePageSize,
} from '../../core/people/people.types';
import { arePeopleDirectoryQueriesEqual, DEFAULT_PEOPLE_DIRECTORY_QUERY, parsePeopleDirectoryQuery, serializePeopleDirectoryQuery, withPeopleDirectoryQueryChange } from '../../core/people/people-directory-query';
import { PeopleDirectoryFiltersComponent } from './people-directory-filters.component';
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';
import { AddPersonDrawerComponent } from './add-person-drawer.component';
import { audienceQueryFromPeopleDirectory, serializeAudiencePreviewQuery } from '../../core/marketing/audience-preview-query';
import { redactPersonAfterAccessLoss } from '../../core/people/person-privacy';

const VALID_PAGE_SIZES: PeoplePageSize[] = [25, 50, 100];

interface OrderingOption {
  label: string;
  value: PeopleOrdering;
}
@Component({
  selector: 'app-people-page',
  imports: [CommonModule, RouterLink, PeopleDirectoryFiltersComponent, StatusBadgeComponent, AddPersonDrawerComponent],
  templateUrl: './people-page.component.html',
  styleUrl: './people-page.component.css',
})
export class PeoplePageComponent {
  readonly addPersonOpen = signal(false);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly staffAccess = inject(StaffAccessService, { optional: true });
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
  readonly peopleResponse = signal<PaginatedResponse<PersonDirectoryItem> | null>(null);
  readonly relationshipLabels: Record<PersonDirectoryItem['relationship'], string> = {
    ACTIVE_MEMBER: 'Member', FORMER_MEMBER: 'Former member', CONTACT: 'Contact',
  };
  readonly relationshipTones: Record<PersonDirectoryItem['relationship'], StatusBadgeTone> = {
    ACTIVE_MEMBER: 'info', FORMER_MEMBER: 'warning', CONTACT: 'neutral',
  };
  readonly communityStatusLabels: Record<CommunityAccountStatus, string> = {
    ACTIVE: 'Active',
    SETUP_PENDING: 'Setup pending',
    NOT_SET_UP: 'Not set up',
    ACCESS_UNAVAILABLE: 'Unavailable',
  };
  readonly communityStatusTones: Record<CommunityAccountStatus, StatusBadgeTone> = {
    ACTIVE: 'success',
    SETUP_PENDING: 'warning',
    NOT_SET_UP: 'neutral',
    ACCESS_UNAVAILABLE: 'error',
  };
  readonly queryState = signal<PeopleDirectoryQuery>(DEFAULT_PEOPLE_DIRECTORY_QUERY);
  readonly canManagePeople = computed(() => canManagePeople(this.auth.currentUser()));
  readonly contactSearchAllowed = computed(() => !this.staffAccess || this.staffAccess.hasCapability('PERSON_CONTACT_READ'));
  readonly exportAllowed = computed(() => !!this.staffAccess?.hasCapability('PERSON_EXPORT'));
  readonly exportFormat = signal<'csv' | 'xlsx'>('csv');
  readonly exporting = signal(false);
  readonly exportError = signal<string | null>(null);
  recordTypeLabel(value: string | undefined): string { return value === 'STAFF' ? 'Staff' : value === 'TECHNICAL' ? 'Technical' : value === 'COMMUNITY' ? 'Community' : 'Unknown'; }

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
    effect(() => {
      const staffAccess = this.staffAccess;
      if (!staffAccess?.isReady()) return;
      const contactLost = !staffAccess.hasCapability('PERSON_CONTACT_READ');
      const demographicLost = !staffAccess.hasCapability('PERSON_DEMOGRAPHIC_READ');
      if (!contactLost && !demographicLost) return;
      const response = this.peopleResponse();
      if (response) {
        untracked(() => this.peopleResponse.set({
          ...response,
          results: response.results.map(person => redactPersonAfterAccessLoss(person, contactLost, demographicLost)),
        }));
      }
    });
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

  openPersonRow(event: MouseEvent, person: PersonListItem): void {
    const target = event.target as Element;
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    // Keep native link behavior and allow future child controls to own their interactions.
    if (target.closest('a,button,input,select,textarea,label,[role="button"],[role="link"],[contenteditable],[tabindex],[data-row-interactive]')) return;
    if (target.ownerDocument.getSelection()?.toString()) return;
    void this.router.navigate(['/people', person.id]);
  }

  activatePersonLink(event: KeyboardEvent, person: PersonListItem): void {
    if (!['Enter', ' '].includes(event.key) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat) void this.router.navigate(['/people', person.id]);
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

  previewMarketingAudience(): void {
    const audienceQuery = audienceQueryFromPeopleDirectory(this.queryState());
    void this.router.navigate(['/marketing/audience-preview'], {
      queryParams: serializeAudiencePreviewQuery(audienceQuery),
    });
  }

  exportPeople(): void {
    if (!this.exportAllowed() || this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set(null);
    this.peopleService.exportPeople(this.queryState(), this.exportFormat()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `people-export.${this.exportFormat()}`;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.exporting.set(false);
        this.exportError.set(error.status === 403 ? 'You do not have permission to export these People.' : 'The People export could not be generated right now.');
      },
    });
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
