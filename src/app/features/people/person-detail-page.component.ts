import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import { hasStaffRole } from '../../core/auth/auth-access';
import { PeopleService } from '../../core/people/people.service';
import {
  EndMembershipRequest,
  MakeMembershipRequest,
  PersonListItem,
  PersonMembership,
  PersonOverview,
} from '../../core/people/people.types';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { DetailListComponent, DetailListItem } from '../../shared/ui/detail-list.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-person-detail-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CrmSectionCardComponent,
    DetailListComponent,
    StateMessageComponent,
    StatusBadgeComponent,
  ],
  template: `
    <section class="detail-page">
      <a routerLink="/people" class="back-link">Back to People</a>

      @if (loading()) {
        <app-state-message
          title="Loading person"
          message="Retrieving the person record."
        />
      } @else if (notFound()) {
        <app-state-message
          title="Person not found"
          message="The requested person record is not available in the CRM People domain."
        >
          <a routerLink="/people" class="state-link">Return to People</a>
        </app-state-message>
      } @else if (errorMessage()) {
        <app-state-message
          title="Person could not be loaded"
          [message]="errorMessage()!"
          tone="error"
        >
          <a routerLink="/people" class="state-link">Return to People</a>
        </app-state-message>
      } @else if (person()) {
        <div class="detail-grid">
          <section class="identity-card">
            <div class="identity-topline">
              <div class="identity-copy">
                <h3>{{ fullName() }}</h3>
                <p>{{ primaryContactLine() }}</p>
              </div>

              <div class="identity-badges">
                <app-status-badge [label]="relationshipLabel()" />

                @if (person()!.archived_at) {
                  <app-status-badge label="Archived" tone="archived" />
                }
              </div>
            </div>

            <div class="identity-meta">
              <p><span>Mobile</span>{{ displayValue(person()!.mobile) }}</p>
              <p><span>Location</span>{{ displayValue(person()!.location) }}</p>
            </div>
          </section>

          <app-crm-section-card title="Personal details">
            <app-detail-list [items]="personalDetails()" />
          </app-crm-section-card>

          <app-crm-section-card title="Record information">
            <app-detail-list [items]="recordInformation()" />
          </app-crm-section-card>

          <app-crm-section-card title="Membership">
            @if (membershipDetails().length) {
              <app-detail-list [items]="membershipDetails()" />

              @if (canEndMembership()) {
                <div class="membership-actions">
                  @if (showEndMembershipForm()) {
                    <form class="membership-form" [formGroup]="endMembershipForm" (ngSubmit)="submitEndMembership()">
                      <label>
                        <span>End date</span>
                        <input type="date" formControlName="ended_at" [attr.min]="membership()?.joined_at ?? null" />
                      </label>

                      <p class="membership-form-note">This person will become a Former Member.</p>

                      @if (showEndMembershipRequiredError()) {
                        <p class="membership-form-error">End date is required.</p>
                      }

                      @if (showEndMembershipBeforeJoinedError()) {
                        <p class="membership-form-error">
                          End date cannot be before the membership join date.
                        </p>
                      }

                      @if (endMembershipErrorMessage()) {
                        <p class="membership-form-error">{{ endMembershipErrorMessage() }}</p>
                      }

                      <div class="membership-form-actions">
                        <button type="submit" [disabled]="endMembershipSubmitting()">
                          {{ endMembershipSubmitting() ? 'Ending membership...' : 'End Membership' }}
                        </button>
                        <button type="button" class="button-secondary" [disabled]="endMembershipSubmitting()" (click)="cancelEndMembership()">
                          Cancel
                        </button>
                      </div>
                    </form>
                  } @else {
                    <button type="button" class="button-primary" (click)="openEndMembershipForm()">End Membership</button>
                  }
                </div>
              }
            } @else {
              <div class="membership-empty-state">
                <p class="empty-section-copy">No membership record</p>

                @if (canMakeMember()) {
                  @if (showMakeMemberForm()) {
                    <form class="membership-form" [formGroup]="makeMemberForm" (ngSubmit)="submitMakeMember()">
                      <label>
                        <span>Join date</span>
                        <input type="date" formControlName="joined_at" />
                      </label>

                      @if (makeMemberForm.invalid && makeMemberForm.touched) {
                        <p class="membership-form-error">Join date is required.</p>
                      }

                      @if (makeMemberErrorMessage()) {
                        <p class="membership-form-error">{{ makeMemberErrorMessage() }}</p>
                      }

                      <div class="membership-form-actions">
                        <button type="submit" [disabled]="makeMemberSubmitting()">
                          {{ makeMemberSubmitting() ? 'Making member...' : 'Make Member' }}
                        </button>
                        <button type="button" class="button-secondary" [disabled]="makeMemberSubmitting()" (click)="cancelMakeMember()">
                          Cancel
                        </button>
                      </div>
                    </form>
                  } @else {
                    <button type="button" class="button-primary" (click)="openMakeMemberForm()">Make Member</button>
                  }
                }
              </div>
            }
          </app-crm-section-card>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .detail-page {
      display: grid;
      gap: 0.9rem;
    }

    .detail-grid {
      display: grid;
      gap: 0.9rem;
    }

    .back-link,
    .state-link {
      width: fit-content;
      color: #1b546b;
      font-weight: 700;
      text-decoration: none;
    }

    .back-link:hover,
    .back-link:focus-visible,
    .state-link:hover,
    .state-link:focus-visible {
      text-decoration: underline;
      outline: none;
    }

    .identity-card {
      display: grid;
      gap: 1rem;
      padding: 1.2rem 1.25rem;
      border-radius: 1.1rem;
      border: 1px solid rgba(22, 39, 53, 0.08);
      background: rgba(255, 255, 255, 0.88);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 10px 24px rgba(17, 29, 40, 0.04);
    }

    .identity-topline {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .identity-copy {
      display: grid;
      gap: 0.35rem;
    }

    .identity-copy h3,
    .identity-copy p,
    .identity-meta p,
    .identity-meta span {
      margin: 0;
    }

    .identity-copy h3 {
      font-size: clamp(1.45rem, 3vw, 2rem);
      line-height: 1.1;
      color: #1a3142;
    }

    .identity-copy p,
    .identity-meta p {
      color: #4f697b;
      line-height: 1.5;
    }

    .identity-badges {
      display: flex;
      flex-wrap: wrap;
      justify-content: end;
      gap: 0.45rem;
    }

    .identity-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem 1.2rem;
    }

    .identity-meta p {
      display: grid;
      gap: 0.18rem;
    }

    .identity-meta span {
      font-size: 0.8rem;
      font-weight: 700;
      color: #617b8c;
    }

    .empty-section-copy {
      margin: 0;
      color: #4f697b;
      line-height: 1.5;
    }

    .membership-empty-state {
      display: grid;
      gap: 0.9rem;
      align-items: start;
    }

    .membership-actions {
      margin-top: 0.9rem;
    }

    .membership-form {
      display: grid;
      gap: 0.85rem;
      width: min(100%, 26rem);
    }

    .membership-form label {
      display: grid;
      gap: 0.4rem;
      color: #1c3344;
      font-weight: 600;
    }

    .membership-form input,
    .membership-form select {
      width: 100%;
      border: 1px solid #b7c7d4;
      border-radius: 0.85rem;
      padding: 0.8rem 0.95rem;
      font: inherit;
      background: #fdfefe;
      color: #203a4c;
    }

    .membership-form-note {
      margin: 0;
      color: #4f697b;
      line-height: 1.5;
    }

    .membership-form-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.7rem;
    }

    .button-primary,
    .button-secondary,
    .membership-form button {
      width: fit-content;
      border-radius: 999px;
      padding: 0.75rem 1.1rem;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .button-primary,
    .membership-form button[type='submit'] {
      border: 0;
      color: #fff;
      background: linear-gradient(135deg, #16354a, #2f6f84);
    }

    .button-secondary {
      border: 1px solid #b7c7d4;
      color: #203a4c;
      background: #fff;
    }

    .button-primary:disabled,
    .button-secondary:disabled,
    .membership-form button:disabled {
      cursor: wait;
      opacity: 0.7;
    }

    .membership-form-error {
      margin: 0;
      color: #9b1c1c;
      font-weight: 600;
      line-height: 1.5;
    }

    @media (max-width: 680px) {
      .identity-badges {
        justify-content: start;
      }

      .identity-meta {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PersonDetailPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly overview = signal<PersonOverview | null>(null);
  readonly showMakeMemberForm = signal(false);
  readonly makeMemberSubmitting = signal(false);
  readonly makeMemberErrorMessage = signal<string | null>(null);
  readonly showEndMembershipForm = signal(false);
  readonly endMembershipSubmitting = signal(false);
  readonly endMembershipErrorMessage = signal<string | null>(null);
  readonly person = computed<PersonListItem | null>(() => this.overview()?.person ?? null);
  readonly membership = computed<PersonMembership | null>(() => this.overview()?.membership ?? null);
  readonly relationshipLabel = computed(() => this.overview()?.relationship.label ?? 'Contact');
  readonly canMakeMember = computed(() => {
    const overview = this.overview();
    const person = overview?.person;
    const currentUser = this.auth.currentUser();

    if (!overview || !person || person.archived_at || overview.membership !== null || overview.relationship.type !== 'CONTACT') {
      return false;
    }

    return hasStaffRole(currentUser, 'CRM_ADMIN') || hasStaffRole(currentUser, 'CRM_MANAGER');
  });
  readonly canEndMembership = computed(() => {
    const overview = this.overview();
    const person = overview?.person;
    const membership = overview?.membership ?? null;
    const currentUser = this.auth.currentUser();

    if (
      !overview ||
      !person ||
      person.archived_at ||
      overview.relationship.type !== 'ACTIVE_MEMBER' ||
      membership === null ||
      membership.status !== 'ACTIVE'
    ) {
      return false;
    }

    return hasStaffRole(currentUser, 'CRM_ADMIN') || hasStaffRole(currentUser, 'CRM_MANAGER');
  });

  readonly makeMemberForm = this.fb.nonNullable.group({
    joined_at: [getLocalTodayDateInputValue(), Validators.required],
  });
  readonly endMembershipForm = this.fb.nonNullable.group({
    ended_at: [getLocalTodayDateInputValue(), Validators.required],
  });
  readonly showEndMembershipRequiredError = computed(
    () => this.endMembershipForm.controls.ended_at.hasError('required') && this.endMembershipForm.touched,
  );
  readonly showEndMembershipBeforeJoinedError = computed(() => {
    if (!this.endMembershipForm.touched) {
      return false;
    }

    const membership = this.membership();
    const endedAt = this.endMembershipForm.controls.ended_at.value;
    return Boolean(membership && endedAt && endedAt < membership.joined_at);
  });

  readonly fullName = computed(() => {
    const person = this.person();
    return person ? `${person.first_name} ${person.last_name}` : 'Person';
  });

  readonly personalDetails = computed<DetailListItem[]>(() => {
    const person = this.person();
    if (!person) {
      return [];
    }

    return [
      { label: 'First name', value: person.first_name },
      { label: 'Last name', value: person.last_name },
      { label: 'Email', value: person.primary_email },
      { label: 'Mobile', value: person.mobile },
      { label: 'Location', value: person.location },
      { label: 'Age range', value: person.age_range },
      { label: 'Gender', value: person.gender },
    ];
  });

  readonly recordInformation = computed<DetailListItem[]>(() => {
    const person = this.person();
    if (!person) {
      return [];
    }

    return [
      { label: 'Status', value: person.archived_at ? 'Archived' : 'Active' },
      { label: 'Created', value: formatDateTime(person.created_at) },
      { label: 'Last updated', value: formatDateTime(person.updated_at) },
      { label: 'Archived on', value: person.archived_at ? formatDateTime(person.archived_at) : null },
    ];
  });

  readonly membershipDetails = computed<DetailListItem[]>(() => {
    const membership = this.membership();
    if (!membership) {
      return [];
    }

    const items: DetailListItem[] = [
      { label: 'Status', value: membership.status === 'ACTIVE' ? 'Active' : 'Former' },
      { label: 'Joined', value: formatBusinessDate(membership.joined_at) },
    ];

    if (membership.ended_at) {
      items.push({ label: 'Ended', value: formatBusinessDate(membership.ended_at) });
    }

    items.push({ label: 'Source', value: getMembershipSourceLabel(membership.membership_source) });

    return items;
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((personId) => {
        if (!Number.isInteger(personId) || personId <= 0) {
          this.showNotFound();
          return;
        }

        this.loadOverview(personId);
      });
  }

  primaryContactLine(): string {
    const person = this.person();
    if (!person) {
      return 'Not provided';
    }

    if (person.primary_email) {
      return person.primary_email;
    }

    if (person.mobile.trim()) {
      return person.mobile;
    }

    return 'Not provided';
  }

  displayValue(value: string | null | undefined): string {
    return value && value.trim() ? value : 'Not provided';
  }

  openMakeMemberForm(): void {
    this.showMakeMemberForm.set(true);
    this.makeMemberErrorMessage.set(null);
    this.showEndMembershipForm.set(false);
    this.endMembershipErrorMessage.set(null);
    this.makeMemberForm.reset({
      joined_at: getLocalTodayDateInputValue(),
    });
  }

  cancelMakeMember(): void {
    this.showMakeMemberForm.set(false);
    this.makeMemberErrorMessage.set(null);
    this.makeMemberSubmitting.set(false);
    this.makeMemberForm.reset({
      joined_at: getLocalTodayDateInputValue(),
    });
  }

  openEndMembershipForm(): void {
    this.showEndMembershipForm.set(true);
    this.endMembershipErrorMessage.set(null);
    this.showMakeMemberForm.set(false);
    this.makeMemberErrorMessage.set(null);
    this.endMembershipForm.reset({
      ended_at: getLocalTodayDateInputValue(),
    });
  }

  cancelEndMembership(): void {
    this.showEndMembershipForm.set(false);
    this.endMembershipErrorMessage.set(null);
    this.endMembershipSubmitting.set(false);
    this.endMembershipForm.reset({
      ended_at: getLocalTodayDateInputValue(),
    });
  }

  submitMakeMember(): void {
    const person = this.person();
    if (!person || !this.canMakeMember() || this.makeMemberSubmitting()) {
      return;
    }

    if (this.makeMemberForm.invalid) {
      this.makeMemberForm.markAllAsTouched();
      return;
    }

    this.makeMemberSubmitting.set(true);
    this.makeMemberErrorMessage.set(null);

    const payload: MakeMembershipRequest = {
      joined_at: this.makeMemberForm.getRawValue().joined_at,
      membership_source: 'STAFF',
    };

    this.peopleService
      .makeMember(person.id, payload)
      .pipe(switchMap(() => this.peopleService.getPersonOverview(person.id)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.showMakeMemberForm.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.makeMemberErrorMessage.set(formatMakeMemberError(error));
          this.makeMemberSubmitting.set(false);
        },
        complete: () => {
          this.makeMemberSubmitting.set(false);
        },
      });
  }

  submitEndMembership(): void {
    const person = this.person();
    const membership = this.membership();

    if (!person || !membership || !this.canEndMembership() || this.endMembershipSubmitting()) {
      return;
    }

    if (this.endMembershipForm.invalid) {
      this.endMembershipForm.markAllAsTouched();
      return;
    }

    const payload: EndMembershipRequest = {
      ended_at: this.endMembershipForm.getRawValue().ended_at,
    };

    if (payload.ended_at < membership.joined_at) {
      this.endMembershipForm.markAllAsTouched();
      this.endMembershipErrorMessage.set(null);
      return;
    }

    this.endMembershipSubmitting.set(true);
    this.endMembershipErrorMessage.set(null);

    this.peopleService
      .endMembership(person.id, payload)
      .pipe(switchMap(() => this.peopleService.getPersonOverview(person.id)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.showEndMembershipForm.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.endMembershipErrorMessage.set(formatEndMembershipError(error));
          this.endMembershipSubmitting.set(false);
        },
        complete: () => {
          this.endMembershipSubmitting.set(false);
        },
      });
  }

  private loadOverview(personId: number): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.errorMessage.set(null);
    this.overview.set(null);
    this.showMakeMemberForm.set(false);
    this.makeMemberSubmitting.set(false);
    this.makeMemberErrorMessage.set(null);
    this.showEndMembershipForm.set(false);
    this.endMembershipSubmitting.set(false);
    this.endMembershipErrorMessage.set(null);

    this.peopleService
      .getPersonOverview(personId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.overview.set(null);
          this.loading.set(false);

          if (error.status === 404) {
            this.showNotFound();
            return;
          }

          this.errorMessage.set('The person record could not be loaded right now.');
        },
      });
  }

  private showNotFound(): void {
    this.loading.set(false);
    this.overview.set(null);
    this.errorMessage.set(null);
    this.notFound.set(true);
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatBusinessDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getMembershipSourceLabel(value: PersonMembership['membership_source']): string {
  switch (value) {
    case 'WEBSITE_FORM':
      return 'Website Form';
    case 'STAFF':
      return 'Staff';
    case 'COMMUNITY_PLATFORM':
      return 'Community Platform';
    case 'OTHER':
      return 'Other';
  }
}

function getLocalTodayDateInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMakeMemberError(error: HttpErrorResponse): string {
  if (error.status === 400 && error.error && typeof error.error === 'object' && !Array.isArray(error.error)) {
    const entries = Object.entries(error.error as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([field, value]) => `${getMakeMemberFieldLabel(field)}: ${String((value as unknown[])[0])}`);

    if (entries.length > 0) {
      return entries.join(' ');
    }

    return 'Membership details need to be corrected before this person can be made a member.';
  }

  if (error.status === 403) {
    return 'You no longer have permission to make this person a member.';
  }

  if (error.status === 409) {
    return 'This membership could not be created because the person is no longer eligible for Make Member.';
  }

  return 'Membership could not be created right now. Try again.';
}

function formatEndMembershipError(error: HttpErrorResponse): string {
  if (error.status === 400 && error.error && typeof error.error === 'object' && !Array.isArray(error.error)) {
    const entries = Object.entries(error.error as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([field, value]) => `${getEndMembershipFieldLabel(field)}: ${String((value as unknown[])[0])}`);

    if (entries.length > 0) {
      return entries.join(' ');
    }

    return 'Membership end details need to be corrected before this change can be saved.';
  }

  if (error.status === 403) {
    return 'You no longer have permission to end this membership.';
  }

  if (error.status === 409) {
    return 'This membership can no longer be ended from the current person state.';
  }

  return 'Membership could not be ended right now. Try again.';
}

function getMakeMemberFieldLabel(field: string): string {
  switch (field) {
    case 'joined_at':
      return 'Join date';
    case 'membership_source':
      return 'Membership source';
    default:
      return 'Membership';
  }
}

function getEndMembershipFieldLabel(field: string): string {
  switch (field) {
    case 'ended_at':
      return 'End date';
    default:
      return 'Membership';
  }
}
