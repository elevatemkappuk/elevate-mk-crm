import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { formatForbiddenError } from '../../core/http/forbidden-error';
import { StaffAccessService } from '../../core/auth/staff-access.service';
import { AuthService } from '../../core/auth/auth.service';
import { LegalHoldsService } from '../../core/privacy/legal-holds.service';
import { LegalHold, LegalHoldReleaseRequest, LegalHoldReleaseRequestResult } from '../../core/privacy/legal-hold.types';
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
        <p class="notice">Provide exactly one target: a Person ID or an audit-event reference from privacy history.</p>
        <form (ngSubmit)="createHold()">
          <div class="form-grid">
            <label for="hold-person-id">Person ID</label>
            <input id="hold-person-id" name="personId" type="number" min="1" [(ngModel)]="personId" />
            <label for="hold-event-reference">Audit-event reference</label>
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
                  <p>Placed {{ formatDateTime(hold.placed_at) }} · User {{ hold.placed_by_id }}</p>
                  @if (hold.person_id) { <p>Person {{ hold.person_id }}</p> }
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
                   <p>Requested by User {{ releaseRequest.requested_by_id }} · {{ formatDateTime(releaseRequest.requested_at) }}</p>
                   <p>Justification: {{ releaseRequest.justification }}</p>
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
    form, .form-grid { display: grid; gap: .6rem; }
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
  readonly releaseHoldId = signal<string | null>(null);
  personId: number | null = null;
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
      this.loadHolds();
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
