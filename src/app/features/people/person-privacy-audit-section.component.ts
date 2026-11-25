import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { formatForbiddenError } from '../../core/http/forbidden-error';
import { StaffAccessService } from '../../core/auth/staff-access.service';
import { AuthService } from '../../core/auth/auth.service';
import { PrivacyAuditService } from '../../core/privacy/privacy-audit.service';
import { PaginatedPrivacyAuditHistoryResponse, PrivacyAuditHistoryEvent } from '../../core/privacy/privacy-audit.types';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

const ACTIVITY_OPTIONS = [
  ['PERSON_CREATED', 'Person created'],
  ['PERSON_UPDATED', 'Person updated'],
  ['PERSON_ARCHIVED', 'Person archived'],
  ['PERSON_RESTORED', 'Person restored'],
  ['MEMBERSHIP_CREATED', 'Membership created'],
  ['MEMBERSHIP_ENDED', 'Membership ended'],
  ['PROFESSIONAL_PROFILE_CREATED', 'Professional profile created'],
  ['PROFESSIONAL_PROFILE_UPDATED', 'Professional profile updated'],
  ['MARKETING_PREFERENCE_OPTED_IN', 'Marketing preference opted in'],
  ['MARKETING_PREFERENCE_OPTED_OUT', 'Marketing preference opted out'],
] as const;
const OUTCOME_OPTIONS = [
  ['SUCCESS', 'Success'],
  ['DENIED', 'Denied'],
  ['REJECTED', 'Rejected'],
] as const;

@Component({
  selector: 'app-person-privacy-audit-section',
  imports: [CommonModule, FormsModule, CrmSectionCardComponent, StateMessageComponent],
  template: `
    <app-crm-section-card title="Privacy audit history">
      @if (loading() && !loaded()) {
        <app-state-message title="Loading privacy history" message="Retrieving privacy events for this person." />
      } @else if (errorMessage()) {
        <app-state-message title="Privacy history could not be loaded" [message]="errorMessage()!" tone="error">
          <button type="button" class="button-secondary" (click)="retry()">Retry</button>
        </app-state-message>
      } @else {
        <div class="privacy-results">
          <form class="privacy-filters" (ngSubmit)="applyFilters()">
            <label>From <input type="date" name="from" [(ngModel)]="occurredFrom" /></label>
            <label>To <input type="date" name="to" [(ngModel)]="occurredTo" /></label>
            <label>Activity <select name="activity" [(ngModel)]="activityType"><option value="">All activities</option>@for (option of activityOptions; track option[0]) { <option [value]="option[0]">{{ option[1] }}</option> }</select></label>
            <label>Outcome <select name="outcome" [(ngModel)]="outcome"><option value="">All outcomes</option>@for (option of outcomeOptions; track option[0]) { <option [value]="option[0]">{{ option[1] }}</option> }</select></label>
            <label class="checkbox-filter"><input type="checkbox" name="superuser" [(ngModel)]="superuserOnly" /> Superuser operations</label>
            <button type="submit" class="button-secondary" [disabled]="loading()">Filter</button>
          </form>
          <p class="supporting-copy">{{ countLabel() }}</p>
          @if (!events().length) {
            <app-state-message message="No privacy audit history recorded." />
          } @else {
            <ol class="privacy-list" aria-live="polite">
              @for (event of events(); track event.id) {
                <li>
                  <article class="privacy-event">
                    <div class="event-summary">
                      <h4>{{ event.description }}</h4>
                      <p>{{ formatDateTime(event.occurred_at) }} · {{ actorLabel(event) }}</p>
                    </div>
                    <div class="event-details">
                      <span>{{ event.outcome }}</span>
                      @if (event.capability) { <span>Capability: {{ event.capability }}</span> }
                      @if (event.superuser_operation) { <span>Audited superuser operation</span> }
                      @if (event.permitted_actions.includes('place_event_hold')) { <button type="button" class="button-secondary" (click)="placeEventHold(event.legal_hold_event_reference!)">Place event hold</button> }
                    </div>
                  </article>
                </li>
              }
            </ol>
          }

          @if (loading() && loaded()) { <p class="supporting-copy">Refreshing privacy history.</p> }
          @if (hasPagination()) {
            <div class="pagination">
              <button type="button" class="button-secondary" [disabled]="!hasPreviousPage() || loading()" (click)="goToPreviousPage()">Previous</button>
              <p>Showing newest privacy events first.</p>
              <button type="button" class="button-secondary" [disabled]="!hasNextPage() || loading()" (click)="goToNextPage()">Next</button>
            </div>
          }
        </div>
      }
    </app-crm-section-card>
  `,
  styles: `
    :host { display: block; }
    .privacy-results, .privacy-list, .privacy-event { display: grid; gap: .85rem; }
    .privacy-filters { display: flex; gap: .65rem; flex-wrap: wrap; align-items: end; }
    .privacy-filters label { display: grid; gap: .25rem; color: var(--crm-text-secondary); font-size: .88rem; }
    .privacy-filters input, .privacy-filters select { min-height: 2.2rem; }
    .privacy-filters input[type='checkbox'] { width: 1rem; min-height: 1rem; accent-color: var(--crm-accent); }
    .privacy-filters .checkbox-filter { display: flex; align-items: center; gap: .4rem; }
    .privacy-list { list-style: none; padding: 0; margin: 0; }
    .privacy-event { padding: .25rem 0 1rem 1.25rem; border-left: 2px solid var(--crm-border); background: var(--crm-surface); }
    .event-summary { display: grid; gap: .3rem; }
    .event-summary h4, .event-summary p, .event-details, .supporting-copy, .pagination p { margin: 0; }
    .event-summary h4 { color: #1a3142; font-size: 1rem; }
    .event-summary p, .event-details, .supporting-copy, .pagination p { color: #4f697b; line-height: 1.5; }
    .event-details { display: flex; gap: .65rem; flex-wrap: wrap; font-size: .88rem; }
    .event-details span { padding: .2rem .5rem; border-radius: 999px; background: rgba(79, 105, 123, .1); }
    .pagination { display: flex; justify-content: space-between; align-items: center; gap: .75rem; flex-wrap: wrap; }
    button { cursor: pointer; }
    button[disabled] { cursor: not-allowed; }
  `,
})
export class PersonPrivacyAuditSectionComponent {
  readonly personId = input.required<number>();

  private readonly service = inject(PrivacyAuditService);
  private readonly router = inject(Router);
  private readonly staffAccess = inject(StaffAccessService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly events = signal<readonly PrivacyAuditHistoryEvent[]>([]);
  readonly count = signal(0);
  readonly currentPage = signal(1);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hasNextPage = signal(false);
  readonly hasPreviousPage = signal(false);
  readonly hasPagination = computed(() => this.hasNextPage() || this.hasPreviousPage());
  readonly countLabel = computed(() => `${this.count()} privacy audit event${this.count() === 1 ? '' : 's'}.`);
  occurredFrom = '';
  occurredTo = '';
  activityType = '';
  outcome = '';
  superuserOnly = false;
  readonly activityOptions = ACTIVITY_OPTIONS;
  readonly outcomeOptions = OUTCOME_OPTIONS;
  private requestEpoch = 0;
  private revalidatingAuthorization = false;

  constructor() {
    effect(() => {
      if (!this.staffAccess.hasCapability('PRIVACY_AUDIT_READ')) {
        untracked(() => this.resetState());
      }
    });
    effect(() => {
      const personId = this.personId();
      untracked(() => {
        this.resetState();
        this.loadPage(personId, 1);
      });
    }, { allowSignalWrites: true });
  }

  retry(): void {
    this.loadPage(this.personId(), this.currentPage());
  }

  applyFilters(): void {
    this.loadPage(this.personId(), 1);
  }

  goToNextPage(): void {
    if (this.hasNextPage() && !this.loading()) this.loadPage(this.personId(), this.currentPage() + 1);
  }

  goToPreviousPage(): void {
    if (this.hasPreviousPage() && !this.loading()) this.loadPage(this.personId(), this.currentPage() - 1);
  }

  placeEventHold(reference: string): void {
    if (reference) void this.router.navigate(['/legal-holds'], { queryParams: { eventReference: reference } });
  }

  actorLabel(event: PrivacyAuditHistoryEvent): string {
    if (event.actor.kind === 'SYSTEM') return 'System';
    if (event.actor.contact_restricted) return 'Restricted user';
    return event.actor.email ?? event.actor.display_name;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  private loadPage(personId: number, page: number): void {
    if (this.loading()) return;
    this.currentPage.set(page);
    this.loading.set(true);
    this.errorMessage.set(null);
    const epoch = this.requestEpoch;
    this.service.getPersonHistory(personId, {
      ...(page > 1 ? { page } : {}),
      ...(this.occurredFrom ? { occurred_from: this.occurredFrom } : {}),
      ...(this.occurredTo ? { occurred_to: this.occurredTo } : {}),
      ...(this.activityType.trim() ? { activity_type: this.activityType.trim() } : {}),
      ...(this.outcome.trim() ? { outcome: this.outcome.trim() } : {}),
      ...(this.superuserOnly ? { superuser_operation: true } : {}),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { if (epoch === this.requestEpoch) this.applyResponse(response); },
      error: (error: HttpErrorResponse) => {
        if (epoch !== this.requestEpoch) return;
        if (error.status === 403) {
          this.handleProtectedReadDenied();
          return;
        }
        this.loading.set(false);
        this.loaded.set(true);
        this.errorMessage.set(formatPrivacyHistoryError(error));
      },
      complete: () => { if (epoch === this.requestEpoch) this.loading.set(false); },
    });
  }

  private applyResponse(response: PaginatedPrivacyAuditHistoryResponse): void {
    this.events.set(response.results);
    this.count.set(response.count);
    this.hasNextPage.set(Boolean(response.next));
    this.hasPreviousPage.set(Boolean(response.previous));
    this.loaded.set(true);
    this.errorMessage.set(null);
  }

  private resetState(): void {
    this.requestEpoch += 1;
    this.events.set([]);
    this.count.set(0);
    this.currentPage.set(1);
    this.loading.set(false);
    this.loaded.set(false);
    this.errorMessage.set(null);
    this.hasNextPage.set(false);
    this.hasPreviousPage.set(false);
  }

  private handleProtectedReadDenied(): void {
    if (this.revalidatingAuthorization) return;
    this.revalidatingAuthorization = true;
    this.resetState();
    const user = this.auth.currentUser();
    if (!user) {
      this.revalidatingAuthorization = false;
      return;
    }
    this.staffAccess.refresh(user).subscribe({
      next: () => { this.revalidatingAuthorization = false; },
      error: () => { this.revalidatingAuthorization = false; this.resetState(); },
    });
  }
}

function formatPrivacyHistoryError(error: HttpErrorResponse): string {
  if (error.status === 403) return formatForbiddenError(error, 'This account is not authorized to view privacy audit history.');
  if (error.status === 404) return "We couldn't load privacy history for this person.";
  return "We couldn't load privacy audit history.";
}
