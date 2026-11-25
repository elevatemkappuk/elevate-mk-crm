import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { formatForbiddenError } from '../../core/http/forbidden-error';
import { StaffAccessService } from '../../core/auth/staff-access.service';
import { AuthService } from '../../core/auth/auth.service';
import { LegalHoldsService } from '../../core/privacy/legal-holds.service';
import { LegalHold, LegalHoldReleaseRequest, LegalHoldReleaseRequestResult } from '../../core/privacy/legal-hold.types';
import { PeopleService } from '../../core/people/people.service';
import { PersonDirectoryItem } from '../../core/people/people.types';
import { StateMessageComponent } from '../../shared/ui/state-message.component';

@Component({
  selector: 'app-legal-holds-page',
  imports: [CommonModule, FormsModule, StateMessageComponent],
  templateUrl: './legal-holds-page.component.html',
  styleUrl: './legal-holds-page.component.css',
})
export class LegalHoldsPageComponent {
  private readonly service = inject(LegalHoldsService);
  private readonly peopleService = inject(PeopleService);
  private readonly staffAccess = inject(StaffAccessService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly holds = signal<readonly LegalHold[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly createValidationMessage = signal<string | null>(null);
  readonly personOptions = signal<readonly PersonDirectoryItem[]>([]);
  readonly personSearchLoading = signal(false);
  readonly personSearchError = signal<string | null>(null);
  readonly releaseHoldId = signal<string | null>(null);
  personId: number | null = null;
  personSearch = '';
  private selectedPersonName = '';
  auditEventReference = '';
  createReason = '';
  releaseReason = '';
  releaseRequestId = '';
  resolveReason = '';
  resolveAction: 'approve' | 'reject' = 'approve';
  readonly resolvingRequest = signal(false);
  private authorizationEpoch = 0;
  private revalidatingAuthorization = false;

  constructor() {
    effect(() => {
      if (!this.staffAccess.hasCapability('LEGAL_HOLD_ADMIN')) {
        this.authorizationEpoch += 1;
        this.holds.set([]);
        this.releaseHoldId.set(null);
        this.cancelResolve();
      }
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const value = Number(params.get('personId'));
      this.personId = Number.isSafeInteger(value) && value > 0 ? value : null;
      this.auditEventReference = params.get('eventReference') ?? '';
      if (this.personId !== null) this.loadSelectedPerson(this.personId);
      this.loadHolds();
    });
  }

  searchPeople(): void {
    if (!this.personSearch.trim()) {
      this.personSearchError.set('Enter a name to search.');
      this.personOptions.set([]);
      return;
    }
    this.personSearchLoading.set(true);
    this.personSearchError.set(null);
    this.peopleService.searchPeople(this.personSearch.trim()).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.personSearchLoading.set(false)),
    ).subscribe({
      next: response => this.personOptions.set(response.results),
      error: () => this.personSearchError.set('Person search could not be completed.'),
    });
  }

  selectPerson(person: PersonDirectoryItem): void {
    this.personId = person.id;
    this.auditEventReference = '';
    this.personOptions.set([]);
    this.personSearch = `${person.first_name} ${person.last_name}`;
    this.selectedPersonName = this.personSearch;
  }

  onPersonSearchChange(value: string): void {
    this.personSearch = value;
    if (this.personId !== null && value.trim() !== this.selectedPersonName) {
      this.personId = null;
      this.selectedPersonName = '';
    }
  }

  selectedPersonLabel(): string {
    return this.personId === null ? '' : this.personSearch.trim();
  }

  actorLabel(actor: { display_name: string; contact_restricted: boolean }): string {
    return actor.contact_restricted ? 'Restricted user' : actor.display_name;
  }

  private loadSelectedPerson(personId: number): void {
    this.peopleService.getPerson(personId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: person => {
        this.personSearch = `${person.first_name} ${person.last_name}`;
        this.selectedPersonName = this.personSearch;
      },
      error: () => {
        this.personSearch = '';
        this.selectedPersonName = '';
        this.personId = null;
      },
    });
  }

  loadHolds(): void {
    const requestEpoch = this.authorizationEpoch;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.service.list(this.personId ?? undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        if (requestEpoch === this.authorizationEpoch && this.staffAccess.hasCapability('LEGAL_HOLD_ADMIN')) {
          this.holds.set(response.results);
        }
      },
      error: (error: HttpErrorResponse) => error.status === 403
        ? this.handleProtectedReadDenied()
        : this.showError(error, 'Legal holds could not be loaded.'),
      complete: () => this.loading.set(false),
    });
  }

  createHold(): void {
    const hasPerson = this.personId !== null;
    const hasEvent = this.auditEventReference.trim().length > 0;
    if (hasPerson === hasEvent || !this.createReason.trim()) {
      this.createValidationMessage.set('Provide exactly one target and a justification.');
      return;
    }
    this.saving.set(true);
    this.createValidationMessage.set(null);
    this.feedback.set(null);
    this.service.create({
      ...(hasPerson ? { person_id: this.personId! } : { audit_event_reference: this.auditEventReference.trim() }),
      reason: this.createReason.trim(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.createReason = '';
        this.feedback.set('Legal hold placed.');
        this.loadHolds();
      },
      error: (error: HttpErrorResponse) => error.status === 403
        ? this.handleProtectedReadDenied()
        : this.showError(error, 'Legal hold could not be placed.'),
      complete: () => this.saving.set(false),
    });
  }

  beginRelease(hold: LegalHold): void {
    this.releaseHoldId.set(hold.public_id);
    this.releaseReason = '';
    this.feedback.set(null);
  }

  cancelRelease(): void {
    this.releaseHoldId.set(null);
    this.releaseReason = '';
  }

  releaseHold(hold: LegalHold): void {
    if (!this.releaseReason.trim()) return;
    this.saving.set(true);
    this.feedback.set(null);
    const request$ = (hold.permitted_actions.includes('direct_release')
      ? this.service.directRelease(hold.public_id, this.releaseReason.trim())
      : this.service.requestRelease(hold.public_id, this.releaseReason.trim())) as Observable<LegalHold | LegalHoldReleaseRequestResult>;
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.feedback.set('status' in response && response.status === 'PENDING' ? `Release request submitted: ${response.public_id}.` : 'Legal hold released.');
        this.releaseRequestId = 'public_id' in response ? response.public_id : this.releaseRequestId;
        this.cancelRelease();
        this.loadHolds();
      },
      error: (error: HttpErrorResponse) => error.status === 403
        ? this.handleProtectedReadDenied()
        : this.showError(error, 'The legal-hold release operation was not accepted.'),
      complete: () => this.saving.set(false),
    });
  }

  beginResolve(releaseRequest: LegalHoldReleaseRequest, action: 'approve' | 'reject'): void {
    this.releaseRequestId = releaseRequest.public_id;
    this.resolveAction = action;
    this.resolveReason = '';
    this.resolvingRequest.set(true);
    this.feedback.set(null);
  }

  cancelResolve(): void {
    this.releaseRequestId = '';
    this.resolveReason = '';
    this.resolvingRequest.set(false);
  }

  resolveRequest(): void {
    if (!this.releaseRequestId.trim() || !this.resolveReason.trim()) return;
    this.saving.set(true);
    this.feedback.set(null);
    const request$ = (this.resolveAction === 'approve'
      ? this.service.approveRelease(this.releaseRequestId.trim(), this.resolveReason.trim())
      : this.service.rejectRelease(this.releaseRequestId.trim(), this.resolveReason.trim())) as Observable<LegalHold | LegalHoldReleaseRequestResult>;
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.feedback.set(`Release request ${this.resolveAction}d.`);
        this.resolveReason = '';
        this.releaseRequestId = '';
        this.resolvingRequest.set(false);
        this.loadHolds();
      },
      error: (error: HttpErrorResponse) => error.status === 403
        ? this.handleProtectedReadDenied()
        : this.showError(error, `The release request could not be ${this.resolveAction}d.`),
      complete: () => this.saving.set(false),
    });
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  private showError(error: HttpErrorResponse, fallback: string): void {
    this.loading.set(false);
    this.saving.set(false);
    this.errorMessage.set(error.status === 403 ? formatForbiddenError(error, 'This account is not authorized for legal-hold administration.') : fallback);
  }

  private handleProtectedReadDenied(): void {
    if (this.revalidatingAuthorization) return;
    this.revalidatingAuthorization = true;
    this.authorizationEpoch += 1;
    this.loading.set(false);
    this.holds.set([]);
    this.releaseHoldId.set(null);
    this.cancelResolve();
    const user = this.auth.currentUser();
    if (!user) {
      this.revalidatingAuthorization = false;
      void this.router.navigateByUrl('/login');
      return;
    }
    this.staffAccess.refresh(user).subscribe({
      next: () => {
        this.revalidatingAuthorization = false;
        if (!this.staffAccess.hasCapability('LEGAL_HOLD_ADMIN')) {
          void this.router.navigateByUrl('/access-denied');
        }
      },
      error: () => {
        this.revalidatingAuthorization = false;
        void this.router.navigateByUrl('/access-denied');
      },
    });
  }
}
