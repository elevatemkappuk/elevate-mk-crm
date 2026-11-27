import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
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
import { CampaignService } from '../../core/marketing/campaign.service';
import {
  AudienceExclusionReason,
  AudiencePreviewPerson,
  AudiencePreviewQuery,
  AudiencePreviewResponse,
  AudienceResultView,
} from '../../core/marketing/audience.types';
import { PeopleDirectoryQuery, PeopleOrdering, PeoplePageSize } from '../../core/people/people.types';
import { PeopleDirectoryFiltersComponent } from '../people/people-directory-filters.component';
import { AuthService } from '../../core/auth/auth.service';
import { StaffAccessService } from '../../core/auth/staff-access.service';
import { canManagePeople } from '../../core/auth/auth-access';
import { CampaignCreateDialogComponent } from './campaign-create-dialog.component';
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
  imports: [CommonModule, RouterLink, PeopleDirectoryFiltersComponent, CrmSectionCardComponent, StatusBadgeComponent, CampaignCreateDialogComponent],
  templateUrl: './audience-preview-page.component.html',
  styleUrl: './audience-preview-page.component.css',
})
export class AudiencePreviewPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(AudiencePreviewService);
  private readonly campaignService = inject(CampaignService);
  private readonly auth = inject(AuthService);
  private readonly staffAccess = inject(StaffAccessService);
  private readonly destroyRef = inject(DestroyRef);
  private requestEpoch = 0;

  readonly pageSizes = PAGE_SIZES;
  readonly orderingOptions = ORDERING_OPTIONS;
  readonly resultViews: AudienceResultView[] = ['eligible', 'excluded', 'all'];
  readonly exclusionReasons: AudienceExclusionReason[] = ['EXCLUDED_CONSENT_UNKNOWN', 'EXCLUDED_OPTED_OUT', 'EXCLUDED_NO_EMAIL'];
  readonly queryState = signal<AudiencePreviewQuery>(DEFAULT_AUDIENCE_PREVIEW_QUERY);
  readonly response = signal<AudiencePreviewResponse | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly directoryQuery = computed<PeopleDirectoryQuery>(() => ({ ...this.queryState(), record_state: 'active' }));
  readonly createDialogOpen = signal(false);
  readonly campaignSubmitting = signal(false);
  readonly campaignError = signal<string | null>(null);
  readonly currentSelection = computed(() => audienceSelection(this.queryState()));
  readonly contactSearchAllowed = computed(() => this.staffAccess.hasCapability('PERSON_CONTACT_READ'));

  constructor() {
    effect(() => {
      const accessReady = this.staffAccess.isReady();
      const contactRead = this.staffAccess.hasCapability('PERSON_CONTACT_READ');
      if (accessReady && contactRead) return;

      // Audience rows may contain an authorized raw email projection. Clear it
      // immediately when that capability is lost; late responses from the old
      // authorization epoch must not repopulate the protected state.
      this.requestEpoch += 1;
      this.response.set(null);
      this.createDialogOpen.set(false);
      this.campaignError.set(null);
    });
    this.route.queryParamMap.pipe(
      map((params) => parseAudiencePreviewQuery(params)),
      distinctUntilChanged(areAudiencePreviewQueriesEqual),
      tap((query) => {
        this.queryState.set(query);
        this.loading.set(true);
        this.errorMessage.set(null);
      }),
      switchMap((query) => {
        const requestEpoch = this.requestEpoch;
        return this.service.preview(this.requestFor(query)).pipe(
        map((response) => ({ response, error: null as HttpErrorResponse | null })),
        catchError((error: HttpErrorResponse) => of({ response: null, error })),
        map((result) => requestEpoch === this.requestEpoch ? result : { response: null, error: null }),
      );
      }),
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
    const requestEpoch = this.requestEpoch;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.service.preview(this.requestFor(this.queryState())).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (requestEpoch !== this.requestEpoch) return;
        this.response.set(response); this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        if (requestEpoch !== this.requestEpoch) return;
        this.loading.set(false);
        this.errorMessage.set(error.status === 403 ? 'You do not have permission to preview audiences.' : 'The audience preview could not be loaded right now. Try again.');
      },
    });
  }

  canCreateCampaign(): boolean {
    return canManagePeople(this.auth.currentUser()) && (this.response()?.eligible_count ?? 0) > 0;
  }

  createCampaign(name: string): void {
    if (this.campaignSubmitting() || !name.trim()) return;
    this.campaignSubmitting.set(true);
    this.campaignError.set(null);
    this.campaignService.create({ name: name.trim(), audience_selection: this.currentSelection(), audience_ordering: this.queryState().ordering }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (campaign) => { this.campaignSubmitting.set(false); this.createDialogOpen.set(false); void this.router.navigate(['/marketing/campaigns', campaign.id]); },
      error: (error: HttpErrorResponse) => { this.campaignSubmitting.set(false); this.campaignError.set(error.status === 400 ? 'Enter a valid campaign name and audience.' : 'The campaign could not be created right now. Try again.'); },
    });
  }

  resultLabel(result: AudienceResultView, preview: AudiencePreviewResponse | null = this.response()): string {
    if (result === 'eligible') return `Eligible${preview ? ` (${preview.eligible_count})` : ''}`;
    if (result === 'excluded') return `Excluded${preview ? ` (${preview.excluded_count})` : ''}`;
    return `All selected${preview ? ` (${preview.selected_count})` : ''}`;
  }
  activeResultLabel(): string { return this.resultLabel(this.queryState().result); }
  selectionSummary(preview: AudiencePreviewResponse): string { return `${preview.selected_count} ${preview.selected_count === 1 ? 'person' : 'people'} selected \u00b7 ${preview.eligible_count} eligible \u00b7 ${preview.excluded_count} excluded`; }
  activeExclusionReasons(preview: AudiencePreviewResponse): AudienceExclusionReason[] { return this.exclusionReasons.filter((reason) => preview.exclusion_counts[reason] > 0); }
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
