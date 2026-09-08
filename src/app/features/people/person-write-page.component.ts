import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { canManagePeople } from '../../core/auth/auth-access';
import { AuthService } from '../../core/auth/auth.service';
import { PeopleService } from '../../core/people/people.service';
import { CreateMemberRequest, DuplicatePersonConflict, IdentityOverrideRequest, PersonListItem, UpdatePersonRequest } from '../../core/people/people.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { PersonDuplicateConflictComponent } from './person-duplicate-conflict.component';
import { PersonFormComponent, PersonFormSubmission } from './person-form.component';

type WriteMode = 'contact' | 'member' | 'edit';

@Component({
  selector: 'app-person-write-page',
  imports: [CommonModule, PersonFormComponent, PersonDuplicateConflictComponent, ConfirmationDialogComponent, StateMessageComponent],
  template: `
    @if (!canManagePeople()) {
      <app-state-message title="Access denied" message="You do not have permission to manage People." tone="error" />
    } @else if (loading()) {
      <app-state-message title="Loading person" message="Retrieving the person record." />
    } @else if (notFound()) {
      <app-state-message title="Person not found" message="The requested person record is not available in the CRM People domain." tone="error" />
    } @else {
      <section class="page">
        @if (drawer()) {
          <fieldset class="person-types" [disabled]="submitting()">
            <legend>Person type</legend>
            <label [class.selected]="mode() === 'member'"><input type="radio" name="person-type" value="member" [checked]="mode() === 'member'" (change)="changeType('member')" /><span><strong>Member</strong><small>Person + active Membership</small></span></label>
            <label [class.selected]="mode() === 'contact'"><input type="radio" name="person-type" value="contact" [checked]="mode() === 'contact'" (change)="changeType('contact')" /><span><strong>Contact</strong><small>Person only</small></span></label>
          </fieldset>
        } @else { <div class="intro"><p>{{ intro() }}</p></div> }
        @if (errorMessage()) { <p class="error" aria-live="assertive">{{ errorMessage() }}</p> }
        @if (duplicateConflict()) {
          <app-person-duplicate-conflict [conflict]="duplicateConflict()!" [message]="duplicateMessage()" (createSeparatePerson)="openIdentityOverrideConfirmation()" />
        }
        <app-person-form
          [initialPerson]="person()"
          [member]="mode() === 'member'"
          [submitLabel]="submitLabel()"
          [pending]="submitting()"
          [drawer]="drawer()"
          (edited)="clearCollisionReview()"
          (submitted)="submit($event)"
          (cancelled)="cancel()"
        />
      </section>
    }
    <div (keydown.escape)="$event.preventDefault(); $event.stopPropagation()">
    <app-confirmation-dialog
      [open]="identityOverrideConfirmationOpen()"
      title="Create a separate CRM Person?"
      [message]="identityOverrideConfirmationMessage()"
      confirmLabel="Create separate Person"
      [busy]="submitting()"
      (cancelled)="cancelIdentityOverrideConfirmation()"
      (confirmed)="confirmIdentityOverride()"
    />
    </div>
  `,
  styles: `
    .page { display:grid; gap:1rem; max-width:58rem; } .intro { color:#526f81; } .intro p,.error { margin:0; line-height:1.5; }
    .error { padding:.85rem 1rem; border-radius:.75rem; background:#fff5f5; color:#9b1c1c; font-weight:600; }
    .person-types { display:flex; flex-wrap:wrap; gap:.75rem; padding:0; margin:0 0 .5rem; border:0; min-width:0; }
    legend { padding:0; margin-bottom:.75rem; font-size:.75rem; font-weight:700; text-transform:uppercase; letter-spacing:.08em; }
    .person-types label { display:flex; flex:1 1 12rem; align-items:start; gap:.65rem; padding:1rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-md); cursor:pointer; }
    .person-types .selected { background:#fff9e7; border-color:#ad8422; }
    .person-types small { display:block; margin-top:.3rem; font-size:.75rem; color:var(--crm-text-secondary); }
    .person-types input { margin:.2rem 0 0; accent-color:var(--crm-shell-sidebar); }
    .person-types label:focus-within { outline:2px solid var(--crm-focus-ring); outline-offset:2px; }
  `,
})
export class PersonWritePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);
  readonly drawer = input(false);
  readonly cancelled = output<void>();
  readonly saved = output<PersonListItem>();
  readonly personForm = viewChild(PersonFormComponent);
  readonly mode = signal<WriteMode>((this.route.snapshot.data['mode'] as WriteMode) || 'member');
  readonly person = signal<PersonListItem | null>(null);
  readonly loading = signal(this.mode() === 'edit');
  readonly notFound = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly duplicateConflict = signal<DuplicatePersonConflict | null>(null);
  readonly pendingSubmission = signal<PersonFormSubmission | null>(null);
  readonly identityOverrideConfirmationOpen = signal(false);
  readonly canManagePeople = computed(() => canManagePeople(this.auth.currentUser()));
  readonly submitLabel = computed(() => this.drawer() ? 'Add person' : this.mode() === 'contact' ? 'Create Contact' : this.mode() === 'member' ? 'Create Member' : 'Save changes');
  readonly intro = computed(() => this.mode() === 'member' ? 'Create a new Person and active Membership in one step.' : this.mode() === 'contact' ? 'Create a new CRM Person without a Membership.' : 'Update the Person-owned details for this CRM record.');
  readonly duplicateMessage = computed(() => this.mode() === 'edit' ? 'The new email or mobile number matches another existing Person. Review the existing record before saving this change.' : 'A Person with the same email or mobile number already exists. Review the existing record before creating another one.');

  constructor() {
    if (this.mode() === 'edit') {
      const personId = Number(this.route.snapshot.paramMap.get('id'));
      if (!Number.isInteger(personId) || personId < 1) { this.notFound.set(true); this.loading.set(false); return; }
      this.peopleService.getPerson(personId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (person) => { this.person.set(person); this.loading.set(false); },
        error: (error: HttpErrorResponse) => { this.notFound.set(error.status === 404); this.errorMessage.set(error.status === 404 ? null : 'The person record could not be loaded right now.'); this.loading.set(false); },
      });
    }
  }

  submit(submission: PersonFormSubmission): void {
    if (this.submitting() || !this.canManagePeople()) { return; }
    this.pendingSubmission.set(submission);
    this.submitCreation(submission);
  }

  changeType(type: 'member' | 'contact'): void {
    if (this.submitting() || this.mode() === type) return;
    this.mode.set(type);
    this.clearCollisionReview();
  }

  clearCollisionReview(): void {
    this.pendingSubmission.set(null);
    this.duplicateConflict.set(null);
    this.identityOverrideConfirmationOpen.set(false);
  }

  hasUnsavedEdits(): boolean {
    return this.mode() === 'contact' || !!this.personForm()?.hasUnsavedEdits();
  }

  openIdentityOverrideConfirmation(): void {
    if (!this.submitting() && this.pendingSubmission() && this.duplicateConflict()) {
      this.identityOverrideConfirmationOpen.set(true);
    }
  }

  cancelIdentityOverrideConfirmation(): void {
    this.identityOverrideConfirmationOpen.set(false);
  }

  confirmIdentityOverride(): void {
    const submission = this.pendingSubmission();
    const conflict = this.duplicateConflict();
    if (this.submitting() || !this.canManagePeople() || !submission || !conflict) return;
    this.identityOverrideConfirmationOpen.set(false);
    this.submitCreation(submission, {
      confirm_identity_override: true,
      reviewed_collision: conflict.collision,
    });
  }

  identityOverrideConfirmationMessage(): string {
    const type = this.duplicateConflict()?.collision.collision;
    const subject = (this.duplicateConflict()?.candidates.length ?? 0) > 1 ? 'CRM People already use' : 'A CRM Person already uses';
    if (type === 'EMAIL_AND_MOBILE_COLLISION') {
      return `${subject} this email address and mobile number. Only continue if you are sure these records belong to different people.`;
    }
    if (type === 'EMAIL_COLLISION') {
      return `${subject} this email address. Only continue if you are sure these records belong to different people. The new Person may share the same email address.`;
    }
    return `${subject} this mobile number. Only continue if you are sure these records belong to different people.`;
  }

  private submitCreation(submission: PersonFormSubmission, identityOverride?: IdentityOverrideRequest): void {
    this.submitting.set(true); this.errorMessage.set(null); this.duplicateConflict.set(null);
    const request = this.mode() === 'contact'
      ? this.peopleService.createContact(identityOverride ? { ...submission.person, ...identityOverride } : submission.person)
      : this.mode() === 'member'
        ? this.peopleService.createMember(identityOverride
          ? { ...submission.person, joined_at: submission.joined_at!, membership_source: 'STAFF', ...identityOverride }
          : { ...submission.person, joined_at: submission.joined_at!, membership_source: 'STAFF' } satisfies CreateMemberRequest)
        : this.peopleService.updatePerson(this.person()!.id, submission.person satisfies UpdatePersonRequest);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (person) => { this.submitting.set(false); this.saved.emit(person); void this.router.navigate(['/people', person.id]); },
      error: (error: HttpErrorResponse) => { this.submitting.set(false); this.handleError(error); },
    });
  }

  cancel(): void {
    if (this.submitting()) return;
    if (this.drawer()) { this.cancelled.emit(); return; }
    void this.router.navigate(this.mode() === 'edit' && this.person() ? ['/people', this.person()!.id] : ['/people']);
  }

  private handleError(error: HttpErrorResponse): void {
    if (error.status === 409 && isDuplicatePersonConflict(error.error)) {
      this.duplicateConflict.set(error.error);
      if (error.error.code === 'IDENTITY_COLLISION_STALE') this.errorMessage.set(error.error.detail);
      return;
    }
    if (error.status === 400) { this.errorMessage.set('Person details need to be corrected before they can be saved.'); return; }
    if (error.status === 403) { this.errorMessage.set('You no longer have permission to manage People.'); return; }
    if (error.status === 404) { this.notFound.set(true); return; }
    if (error.status === 409) { this.errorMessage.set('This person state changed. Refresh the record and try again.'); return; }
    this.errorMessage.set('The person could not be saved right now. Try again.');
  }
}

function isDuplicatePersonConflict(value: unknown): value is DuplicatePersonConflict {
  const conflict = value as Partial<DuplicatePersonConflict> | null;
  return Boolean(conflict && typeof conflict === 'object'
    && (conflict.code === 'IDENTITY_COLLISION' || conflict.code === 'IDENTITY_COLLISION_STALE')
    && Array.isArray(conflict.candidates)
    && conflict.collision);
}
