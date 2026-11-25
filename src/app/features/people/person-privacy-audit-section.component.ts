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
  ['PRIVACY_PERSON_DISCLOSED', 'Protected Person data disclosed'],
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
  templateUrl: './person-privacy-audit-section.component.html',
  styleUrl: './person-privacy-audit-section.component.css',
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
