import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { StaffManagementService, StaffOnboardingValidationRequest } from '../../core/staff-management/staff-management.service';
import { StaffOnboardingRoleOption, StaffOnboardingValidationResponse, StaffRoleCode } from '../../core/staff-management/staff-management.types';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { PersonFormComponent, PersonFormSubmission } from '../people/person-form.component';

@Component({
  selector: 'app-staff-onboarding-drawer',
  imports: [CommonModule, ReactiveFormsModule, CrmDrawerComponent, StateMessageComponent, PersonFormComponent],
  templateUrl: './staff-onboarding-drawer.component.html',
  styleUrl: './staff-onboarding-drawer.component.css',
})
export class StaffOnboardingDrawerComponent {
  private readonly service = inject(StaffManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  readonly closed = output<void>();
  readonly roles = signal<StaffOnboardingRoleOption[]>([]);
  readonly result = signal<StaffOnboardingValidationResponse | null>(null);
  readonly loadingRoles = signal(true);
  readonly validating = signal(false);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);
  readonly newPerson = signal<PersonFormSubmission['person'] | null>(null);
  readonly form = this.fb.nonNullable.group({
    login_email: ['', [Validators.email]],
    role_code: ['CRM_VIEWER' as StaffRoleCode, Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(4000)]],
  });
  readonly busy = computed(() => this.loadingRoles() || this.validating() || this.submitting());
  readonly dirty = computed(() => this.form.dirty || !!this.newPerson());

  constructor() {
    this.service.onboardingRoles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.roles.set(response.results); this.loadingRoles.set(false); },
      error: () => { this.error.set('Onboarding roles could not be loaded.'); this.loadingRoles.set(false); },
    });
  }

  captureNewPerson(submission: PersonFormSubmission): void { this.newPerson.set(submission.person); }

  validate(): void {
    if (this.validating() || this.form.invalid || !this.newPerson()) {
      this.form.markAllAsTouched(); return;
    }
    const payload: StaffOnboardingValidationRequest = {
      ...this.form.getRawValue(),
      ...this.newPerson()!,
    };
    this.validating.set(true); this.error.set(null); this.result.set(null);
    this.service.validateOnboarding(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.result.set(response); this.validating.set(false); },
      error: () => { this.error.set('Onboarding validation could not be completed.'); this.validating.set(false); },
    });
  }

  roleLabel(code: string | null | undefined): string {
    return this.roles().find(role => role.code === code)?.name ?? code ?? 'Not selected';
  }

  submit(): void {
    const validation = this.result();
    if (!validation?.eligible || this.submitting()) return;
    const payload: StaffOnboardingValidationRequest = {
      ...this.form.getRawValue(),
      ...this.newPerson()!,
    };
    this.submitting.set(true); this.error.set(null);
    this.service.submitOnboarding(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.submitting.set(false); this.submitted.set(true); },
      error: () => { this.submitting.set(false); this.error.set('The invitation could not be created. Revalidate the current identity and try again.'); },
    });
  }

  close(): void { if (!this.busy()) this.closed.emit(); }
}
