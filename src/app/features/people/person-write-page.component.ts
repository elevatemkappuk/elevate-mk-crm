import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { canManagePeople } from '../../core/auth/auth-access';
import { AuthService } from '../../core/auth/auth.service';
import { StaffAccessService } from '../../core/auth/staff-access.service';
import { formatForbiddenError } from '../../core/http/forbidden-error';
import { PeopleService } from '../../core/people/people.service';
import { CreateMemberRequest, DuplicatePersonConflict, IdentityOverrideRequest, PersonListItem, UpdatePersonRequest } from '../../core/people/people.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { PersonDuplicateConflictComponent } from './person-duplicate-conflict.component';
import { PersonFormComponent, PersonFormSubmission } from './person-form.component';
import { redactPersonAfterAccessLoss } from '../../core/people/person-privacy';

type WriteMode = 'contact' | 'member' | 'edit';

@Component({
  selector: 'app-person-write-page',
  imports: [CommonModule, PersonFormComponent, PersonDuplicateConflictComponent, ConfirmationDialogComponent, StateMessageComponent],
  templateUrl: './person-write-page.component.html',
  styleUrl: './person-write-page.component.css',
})
export class PersonWritePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly staffAccess = inject(StaffAccessService, { optional: true });
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);
  readonly drawer = input(false);
  readonly existingPerson = input<PersonListItem | null>(null);
  readonly cancelled = output<void>();
  readonly saved = output<PersonListItem>();
  readonly personForm = viewChild(PersonFormComponent);
  readonly mode = signal<WriteMode>((this.route.snapshot.data['mode'] as WriteMode) || 'member');
  readonly person = signal<PersonListItem | null>(null);
  readonly loading = signal(this.mode() === 'edit');
  readonly notFound = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly emailFieldError = signal<string | null>(null);
  readonly mobileFieldError = signal<string | null>(null);
  readonly duplicateConflict = signal<DuplicatePersonConflict | null>(null);
  readonly pendingSubmission = signal<PersonFormSubmission | null>(null);
  readonly identityOverrideConfirmationOpen = signal(false);
  readonly canManagePeople = computed(() => canManagePeople(this.auth.currentUser()));
  readonly contactFieldsEditable = computed(() => !this.staffAccess || this.staffAccess.hasCapability('PERSON_CONTACT_READ'));
  readonly demographicFieldsEditable = computed(() => !this.staffAccess || this.staffAccess.hasCapability('PERSON_DEMOGRAPHIC_READ'));
  readonly submitLabel = computed(() => this.mode() === 'edit' ? 'Save changes' : this.drawer() ? 'Add person' : this.mode() === 'contact' ? 'Create Contact' : 'Create Member');
  readonly intro = computed(() => this.mode() === 'member' ? 'Create a new Person and active Membership in one step.' : this.mode() === 'contact' ? 'Create a new CRM Person without a Membership.' : 'Update the Person-owned details for this CRM record.');
  readonly duplicateMessage = computed(() => {
    const conflict = this.duplicateConflict();
    if (conflict?.code === 'duplicate_person') {
      return 'Another person already uses this mobile number. Shared mobile numbers are allowed, but check that these are separate people before continuing.';
    }
    if (conflict?.code === 'IDENTITY_COLLISION' && conflict.match_reasons?.includes('EMAIL')) {
      return 'A person with this email already exists. Review the existing person before continuing.';
    }
    return this.mode() === 'edit'
      ? 'The new email or mobile number matches another existing Person. Review the existing record before saving this change.'
      : 'A Person with the same email or mobile number already exists. Review the existing record before creating another one.';
  });

  constructor() {
    effect(() => {
      const staffAccess = this.staffAccess;
      if (!staffAccess?.isReady()) return;
      const contactLost = !staffAccess.hasCapability('PERSON_CONTACT_READ');
      const demographicLost = !staffAccess.hasCapability('PERSON_DEMOGRAPHIC_READ');
      if (!contactLost && !demographicLost) return;
      const person = this.person();
      if (person) untracked(() => this.person.set(redactPersonAfterAccessLoss(person, contactLost, demographicLost)));
    });
    effect(() => {
      const person = this.existingPerson();
      if (person) { this.mode.set('edit'); this.person.set(person); this.loading.set(false); }
    });
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
    this.emailFieldError.set(null);
    this.mobileFieldError.set(null);
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
    this.emailFieldError.set(null);
    this.mobileFieldError.set(null);
  }

  hasUnsavedEdits(): boolean {
    return this.mode() === 'contact' || !!this.personForm()?.hasUnsavedEdits();
  }

  openIdentityOverrideConfirmation(): void {
    const submission = this.pendingSubmission();
    const conflict = this.duplicateConflict();
    if (this.submitting() || !submission || !conflict) return;
    if (this.mode() === 'edit' && !('collision' in conflict)) {
      this.submitCreation(submission, { allow_duplicate_mobile: true });
      return;
    }
    if (!this.submitting()) {
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
    if (!('collision' in conflict)) {
      this.submitCreation(submission, { allow_duplicate_mobile: true });
    } else {
      this.submitCreation(submission, {
        confirm_identity_override: true,
        reviewed_collision: conflict.collision,
      });
    }
  }

  identityOverrideConfirmationMessage(): string {
    const conflict = this.duplicateConflict();
    if (!conflict || !('collision' in conflict)) {
      return 'Another Person already uses this mobile number. Only continue if you are sure these records belong to different people.';
    }
    const type = conflict.collision.collision;
    const subject = conflict.candidates.length > 1 ? 'CRM People already use' : 'A CRM Person already uses';
    if (type === 'EMAIL_AND_MOBILE_COLLISION') {
      return `${subject} this email address and mobile number. Only continue if you are sure these records belong to different people.`;
    }
    if (type === 'EMAIL_COLLISION') {
      return `${subject} this email address. Only continue if you are sure these records belong to different people. The new Person may share the same email address.`;
    }
    return `${subject} this mobile number. Only continue if you are sure these records belong to different people.`;
  }

  private submitCreation(submission: PersonFormSubmission, identityOverride?: IdentityOverrideRequest | { allow_duplicate_mobile: true }): void {
    this.submitting.set(true); this.errorMessage.set(null); this.duplicateConflict.set(null);
    const request = this.mode() === 'contact'
      ? this.peopleService.createContact(identityOverride ? { ...submission.person, ...identityOverride } : submission.person)
      : this.mode() === 'member'
        ? this.peopleService.createMember(identityOverride
          ? { ...submission.person, joined_at: submission.joined_at!, membership_source: 'STAFF', ...identityOverride }
          : { ...submission.person, joined_at: submission.joined_at!, membership_source: 'STAFF' } satisfies CreateMemberRequest)
        : this.peopleService.updatePerson(this.person()!.id, {
          ...submission.person,
          ...(identityOverride && 'allow_duplicate_mobile' in identityOverride ? identityOverride : {}),
        } satisfies UpdatePersonRequest);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (person) => { this.submitting.set(false); this.saved.emit(person); if (!this.drawer() || this.mode() !== 'edit') void this.router.navigate(['/people', person.id]); },
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
    if (error.status === 400) {
      this.emailFieldError.set(getFieldError(error.error, 'primary_email'));
      this.mobileFieldError.set(getMobileFieldError(error.error));
      this.errorMessage.set('Person details need to be corrected before they can be saved.');
      return;
    }
    if (error.status === 403) {
      this.errorMessage.set(formatForbiddenError(error, 'You no longer have permission to manage People.'));
      return;
    }
    if (error.status === 404) { this.notFound.set(true); return; }
    if (error.status === 409) { this.errorMessage.set('This person state changed. Refresh the record and try again.'); return; }
    this.errorMessage.set('The person could not be saved right now. Try again.');
  }
}
function getFieldError(payload: unknown, field: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[field];
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : null;
}

function getMobileFieldError(payload: unknown): string | null {
  return getFieldError(payload, 'mobile');
}

function isDuplicatePersonConflict(value: unknown): value is DuplicatePersonConflict {
  const conflict = value as Partial<DuplicatePersonConflict> | null;
  return Boolean(conflict && typeof conflict === 'object'
    && ((conflict.code === 'duplicate_person' && Array.isArray(conflict.matches))
      || ((conflict.code === 'IDENTITY_COLLISION' || conflict.code === 'IDENTITY_COLLISION_STALE')
        && Array.isArray(conflict.candidates) && conflict.collision)));
}
