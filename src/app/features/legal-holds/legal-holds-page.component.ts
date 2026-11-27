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
import { LegalHold, LegalHoldActor, LegalHoldReleaseRequest, LegalHoldReleaseRequestResult } from '../../core/privacy/legal-hold.types';
import { PeopleService } from '../../core/people/people.service';
import { PersonDirectoryItem } from '../../core/people/people.types';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { ToastService } from '../../shared/ui/toast.service';

type LegalHoldsTab = 'active' | 'requests' | 'history';

interface ReleaseRequestRow {
  readonly hold: LegalHold;
  readonly request: LegalHoldReleaseRequest;
}

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
  private readonly toast = inject(ToastService);

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
  readonly activeTab = signal<LegalHoldsTab>('active');
  readonly selectedHold = signal<LegalHold | null>(null);
  readonly selectedReleaseRequest = signal<ReleaseRequestRow | null>(null);
  readonly createDialogOpen = signal(false);
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

  selectTab(tab: LegalHoldsTab): void {
    this.activeTab.set(tab);
    this.selectedHold.set(null);
    this.selectedReleaseRequest.set(null);
  }

  activeHolds(): readonly LegalHold[] {
    return this.holds().filter(hold => hold.status === 'ACTIVE');
  }

  pendingReleaseRequests(): readonly ReleaseRequestRow[] {
    return this.holds().flatMap(hold => hold.release_requests
      .filter(request => request.status === 'PENDING')
      .map(request => ({ hold, request })));
  }

  historyHolds(): readonly LegalHold[] {
    return this.holds().filter(hold => hold.status === 'RELEASED' || hold.release_requests.some(request => request.status !== 'PENDING'));
  }

  historyReleaseRequests(): readonly ReleaseRequestRow[] {
    return this.holds().flatMap(hold => hold.release_requests
      .filter(request => request.status !== 'PENDING')
      .map(request => ({ hold, request })));
  }

  selectHold(hold: LegalHold): void {
    this.selectedHold.set(hold);
  }

  selectReleaseRequest(row: ReleaseRequestRow): void {
    this.selectedReleaseRequest.set(row);
  }

  backToLegalHoldList(): void {
    this.selectedHold.set(null);
    this.selectedReleaseRequest.set(null);
  }

  openCreateDialog(): void {
    this.createDialogOpen.set(true);
    this.createValidationMessage.set(null);
  }

  closeCreateDialog(): void {
    if (!this.saving()) this.createDialogOpen.set(false);
  }

  activateRow(event: KeyboardEvent, action: () => void): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  }

  holdTypeLabel(scope: LegalHold['scope']): string {
    return scope === 'PERSON' ? 'Person-wide hold' : 'Privacy audit event hold';
  }

  statusLabel(status: LegalHold['status']): string {
    return status === 'ACTIVE' ? 'Active' : 'Released';
  }

  releaseStatusLabel(status: LegalHoldReleaseRequest['status']): string {
    return status === 'PENDING' ? 'Pending approval' : status === 'APPROVED' ? 'Approved' : 'Rejected';
  }

  statusClass(status: LegalHold['status'] | LegalHoldReleaseRequest['status']): string {
    if (status === 'PENDING') return 'status-badge status-badge--warning';
    if (status === 'REJECTED') return 'status-badge status-badge--muted';
    return 'status-badge';
  }

  holdTargetLabel(hold: LegalHold): string {
    return hold.person_display_name || (hold.person_id ? `Person ${hold.person_id}` : 'Authorized audit event');
  }

  canRequestRelease(hold: LegalHold): boolean {
    return hold.status === 'ACTIVE' && (hold.permitted_actions.includes('request_release') || hold.permitted_actions.includes('direct_release'));
  }

  requestActionLabel(hold: LegalHold): string {
    return hold.permitted_actions.includes('direct_release') ? 'Release hold' : 'Request release';
  }

  historyActorLabel(actor: LegalHoldActor | null): string {
    return actor ? this.actorLabel(actor) : 'Not recorded';
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
        this.createDialogOpen.set(false);
        this.feedback.set(null);
        this.toast.success('Legal hold placed', 'The hold is now protecting the authorized target.');
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
        const pending = 'status' in response && response.status === 'PENDING';
        this.feedback.set(null);
        this.toast.success(pending ? 'Release request submitted' : 'Legal hold released', pending ? 'The hold remains active until an authorized administrator approves release.' : 'The legal hold was released and recorded.');
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
        this.feedback.set(null);
        this.toast.success(`Release request ${this.resolveAction}d`, 'The legal-hold history was updated.');
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
