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
  template: `
    <section class="workspace" aria-labelledby="legal-holds-title">
      <p class="eyebrow">Privacy administration</p>
      <h2 id="legal-holds-title">Legal holds</h2>
      <p class="intro">Manage retention-protection holds through the backend-governed workflow. The API remains authoritative for access, scope and release approval.</p>

      @if (errorMessage()) {
        <p class="error" role="alert">{{ errorMessage() }}</p>
        <button type="button" class="button-secondary" (click)="loadHolds()" [disabled]="loading()">Retry</button>
      }
      @if (feedback()) { <p class="success" role="status">{{ feedback() }}</p> }

      <section class="card" aria-labelledby="create-hold-title">
        <h3 id="create-hold-title">Place a legal hold</h3>
        <p class="notice">Choose a Person or use an opaque audit-event reference from an authorized privacy-audit context.</p>
        <form (ngSubmit)="createHold()">
          <div class="person-picker">
            <label for="hold-person-search">Person</label>
            <div class="picker-search">
              <input id="hold-person-search" name="personSearch" type="search" [(ngModel)]="personSearch" (ngModelChange)="onPersonSearchChange($event)" placeholder="Search by name" />
              <button type="button" class="button-secondary" (click)="searchPeople()" [disabled]="personSearchLoading()">{{ personSearchLoading() ? 'Searching...' : 'Find Person' }}</button>
            </div>
            @if (personSearchError()) { <p class="error" role="alert">{{ personSearchError() }}</p> }
            @if (personOptions().length) {
              <div class="person-options" role="listbox" aria-label="Person results">
                @for (person of personOptions(); track person.id) {
                  <button type="button" class="person-option" [class.selected]="personId === person.id" (click)="selectPerson(person)">
                    <strong>{{ person.first_name }} {{ person.last_name }}</strong><span>{{ person.record_type }} · {{ person.id }}</span>
                  </button>
                }
              </div>
            }
            @if (selectedPersonLabel()) { <p class="selected-target">Selected: <strong>{{ selectedPersonLabel() }}</strong></p> }
          </div>
          <div class="form-grid">
            <label for="hold-event-reference">Opaque audit-event reference</label>
            <input id="hold-event-reference" name="eventReference" type="text" [(ngModel)]="auditEventReference" />
          </div>
          <label for="hold-reason">Justification</label>
          <textarea id="hold-reason" name="createReason" rows="3" required [(ngModel)]="createReason"></textarea>
          @if (createValidationMessage()) { <p class="error" role="alert">{{ createValidationMessage() }}</p> }
          <button type="submit" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Place hold' }}</button>
        </form>
      </section>

      <section class="card" aria-labelledby="holds-list-title">
        <h3 id="holds-list-title">Current holds</h3>
        @if (loading()) {
          <app-state-message title="Loading legal holds" message="Retrieving backend-projected legal holds." />
        } @else {
          <div class="hold-list">
            @for (hold of holds(); track hold.public_id) {
              <article class="hold-row">
                <div>
                  <strong>{{ hold.scope }} hold · {{ hold.status }}</strong>
                  <p>Placed {{ formatDateTime(hold.placed_at) }} · {{ actorLabel(hold.placed_by) }}</p>
                  @if (hold.person_id) { <p>Person: {{ hold.person_display_name || 'Restricted Person' }}</p> }
                  @if (hold.audit_event_reference) { <p>Audit-event reference available</p> }
                  @if (hold.justification) { <p>Justification: {{ hold.justification }}</p> }
                </div>
                @if (hold.status === 'ACTIVE' && (hold.permitted_actions.includes('request_release') || hold.permitted_actions.includes('direct_release'))) {
                  <button type="button" (click)="beginRelease(hold)" [disabled]="saving()">
                    {{ hold.permitted_actions.includes('direct_release') ? 'Direct release' : 'Request release' }}
                  </button>
                }
              </article>
              @if (releaseHoldId() === hold.public_id) {
                <form class="inline-form" (ngSubmit)="releaseHold(hold)">
                  <label [for]="'release-reason-' + hold.public_id">Release reason</label>
                  <textarea [id]="'release-reason-' + hold.public_id" name="releaseReason" rows="2" required [(ngModel)]="releaseReason"></textarea>
                  <div class="actions">
                    <button type="submit" [disabled]="saving()">Confirm</button>
                    <button type="button" class="button-secondary" (click)="cancelRelease()" [disabled]="saving()">Cancel</button>
                  </div>
                </form>
              }
               @for (releaseRequest of hold.release_requests; track releaseRequest.public_id) {
                 <div class="release-request" [attr.aria-label]="'Release request ' + releaseRequest.status">
                   <strong>Release request · {{ releaseRequest.status }}</strong>
                   <p>Requested by {{ actorLabel(releaseRequest.requested_by) }} · {{ formatDateTime(releaseRequest.requested_at) }}</p>
                   <p>Justification: {{ releaseRequest.justification }}</p>
                   @if (releaseRequest.approved_by) { <p>Approved by {{ actorLabel(releaseRequest.approved_by) }} · {{ formatDateTime(releaseRequest.approved_at!) }}<br />Reason: {{ releaseRequest.approval_justification }}</p> }
                   @if (releaseRequest.rejected_by) { <p>Rejected by {{ actorLabel(releaseRequest.rejected_by) }} · {{ formatDateTime(releaseRequest.rejected_at!) }}<br />Reason: {{ releaseRequest.rejection_reason }}</p> }
                   @if (releaseRequest.rejection_reason) { <p>Rejection reason: {{ releaseRequest.rejection_reason }}</p> }
                   @if (releaseRequest.permitted_actions.includes('approve') || releaseRequest.permitted_actions.includes('reject')) {
                     <div class="actions">
                       @if (releaseRequest.permitted_actions.includes('approve')) {
                         <button type="button" (click)="beginResolve(releaseRequest, 'approve')" [disabled]="saving()">Approve request</button>
                       }
                       @if (releaseRequest.permitted_actions.includes('reject')) {
                         <button type="button" class="button-secondary" (click)="beginResolve(releaseRequest, 'reject')" [disabled]="saving()">Reject request</button>
                       }
                     </div>
                   }
                 </div>
               }
            } @empty {
              <app-state-message message="No legal holds were returned." />
            }
          </div>
        }
      </section>

      @if (resolvingRequest()) {
        <section class="card" aria-labelledby="resolve-request-title">
          <h3 id="resolve-request-title">Resolve release request</h3>
          <label for="resolve-reason">Decision reason</label>
          <textarea id="resolve-reason" name="resolveReason" rows="2" required [(ngModel)]="resolveReason"></textarea>
          <div class="actions">
            <button type="button" [disabled]="saving()" (click)="resolveRequest()">{{ resolveAction === 'approve' ? 'Approve' : 'Reject' }}</button>
            <button type="button" class="button-secondary" (click)="cancelResolve()" [disabled]="saving()">Cancel</button>
          </div>
        </section>
      }
    </section>
  `,
  styles: `
    .workspace { display: grid; gap: 1rem; padding: 1.5rem; border-radius: 1.25rem; border: 1px solid rgba(57, 47, 18, .08); background: rgba(255, 250, 244, .9); }
    .eyebrow { margin: 0; text-transform: uppercase; letter-spacing: .14em; font-size: .75rem; color: #8b6519; }
    h2, h3, p { margin: 0; }
    h2, h3 { color: #443117; }
    .intro, .notice, .hold-row p, .release-request p { color: #6f5220; line-height: 1.6; }
    .card { display: grid; gap: .75rem; padding: 1rem; border: 1px solid rgba(57, 47, 18, .12); border-radius: .9rem; background: #fffdf9; }
    form, .form-grid, .person-picker { display: grid; gap: .6rem; }
    .picker-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .5rem; }
    .person-options { display: grid; gap: .35rem; max-height: 14rem; overflow: auto; }
    .person-option { display: flex; justify-content: space-between; align-items: center; gap: .75rem; text-align: left; background: #fffdf9; color: #443117; }
    .person-option span, .selected-target { color: #6f5220; font-size: .9rem; }
    .person-option.selected { outline: 2px solid #b69a66; }
    .form-grid { grid-template-columns: minmax(8rem, 12rem) minmax(10rem, 1fr); align-items: center; }
    input, textarea, button { min-height: 2.5rem; border-radius: .5rem; border: 1px solid #b69a66; padding: .5rem .75rem; font: inherit; }
    textarea { resize: vertical; }
    button { cursor: pointer; background: #443117; color: white; }
    button:disabled { cursor: wait; opacity: .6; }
    .button-secondary { background: #fffdf9; color: #443117; }
    .hold-list { display: grid; gap: .7rem; }
    .hold-row { display: flex; justify-content: space-between; gap: 1rem; align-items: start; padding: .75rem; border-top: 1px solid rgba(57, 47, 18, .1); }
    .hold-row > div { display: grid; gap: .25rem; }
    .hold-row p { font-size: .9rem; }
    .inline-form { padding: .75rem; border: 1px solid rgba(57, 47, 18, .12); border-radius: .6rem; }
    .release-request { display: grid; gap: .35rem; margin-top: .5rem; padding: .65rem; border-left: 3px solid #b69a66; }
    .actions { display: flex; gap: .5rem; flex-wrap: wrap; }
    .error, .success { padding: .75rem; border-radius: .5rem; }
    .error { color: #743f2b; background: #f4d9ce; }
    .success { color: #245b36; background: #e1f2e5; }
    @media (max-width: 700px) { .form-grid { grid-template-columns: 1fr; } .hold-row { flex-direction: column; } }
  `,
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
