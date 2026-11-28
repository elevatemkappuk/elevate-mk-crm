import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { StaffManagementService, StaffOnboardingValidationRequest } from '../../core/staff-management/staff-management.service';
import { StaffOnboardingPersonCandidate, StaffOnboardingRoleOption, StaffOnboardingValidationResponse, StaffRoleCode } from '../../core/staff-management/staff-management.types';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { PersonFormComponent, PersonFormSubmission } from '../people/person-form.component';

@Component({
  selector: 'app-staff-onboarding-drawer',
  imports: [CommonModule, ReactiveFormsModule, CrmDrawerComponent, StateMessageComponent, StatusBadgeComponent, PersonFormComponent],
  templateUrl: './staff-onboarding-drawer.component.html',
  styleUrl: './staff-onboarding-drawer.component.css',
})
export class StaffOnboardingDrawerComponent {
  private readonly service = inject(StaffManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly searches = new Subject<string>();
  readonly closed = output<void>();
  readonly mode = signal<'existing' | 'new'>('existing');
  readonly candidates = signal<StaffOnboardingPersonCandidate[]>([]);
  readonly selected = signal<StaffOnboardingPersonCandidate | null>(null);
  readonly roles = signal<StaffOnboardingRoleOption[]>([]);
  readonly result = signal<StaffOnboardingValidationResponse | null>(null);
  readonly searchLoading = signal(false);
  readonly loadingRoles = signal(true);
  readonly validating = signal(false);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);
  readonly newPerson = signal<PersonFormSubmission['person'] | null>(null);
  readonly search = this.fb.nonNullable.control('', [Validators.minLength(2)]);
  readonly form = this.fb.nonNullable.group({
    login_email: ['', [Validators.email]],
    role_code: ['CRM_VIEWER' as StaffRoleCode, Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(4000)]],
  });
  readonly busy = computed(() => this.searchLoading() || this.loadingRoles() || this.validating() || this.submitting());
  readonly dirty = computed(() => this.form.dirty || this.search.dirty || this.mode() === 'new');

  constructor() {
    this.service.onboardingRoles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => { this.roles.set(response.results); this.loadingRoles.set(false); },
      error: () => { this.error.set('Onboarding roles could not be loaded.'); this.loadingRoles.set(false); },
    });
    this.search.valueChanges.pipe(
      debounceTime(250), distinctUntilChanged(),
      tap(value => { this.searchLoading.set(value.trim().length >= 2); this.error.set(null); }),
      switchMap(value => value.trim().length < 2 ? of(null) : this.service.searchOnboardingPeople(value.trim()).pipe(catchError(() => { this.error.set('Person search could not be completed.'); return of(null); }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(response => { this.searchLoading.set(false); this.candidates.set(response?.results ?? []); });
  }

  setMode(mode: 'existing' | 'new'): void {
    if (this.busy()) return;
    this.mode.set(mode); this.selected.set(null); this.result.set(null); this.error.set(null); this.newPerson.set(null);
    if (mode === 'existing') this.search.reset('');
  }

  choose(candidate: StaffOnboardingPersonCandidate): void {
    this.selected.set(candidate); this.candidates.set([]); this.result.set(null); this.search.setValue(candidate.display_name); this.search.markAsPristine();
  }

  clearSelection(): void { this.selected.set(null); this.result.set(null); this.search.setValue(''); }

  captureNewPerson(submission: PersonFormSubmission): void { this.newPerson.set(submission.person); }

  validate(): void {
    if (this.validating() || this.form.invalid || (this.mode() === 'existing' && !this.selected()) || (this.mode() === 'new' && !this.newPerson())) {
      this.form.markAllAsTouched(); return;
    }
    const payload: StaffOnboardingValidationRequest = {
      ...this.form.getRawValue(),
      ...(this.mode() === 'existing' ? { person_id: this.selected()!.person_id } : this.newPerson()!),
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
      ...(this.mode() === 'existing' ? { person_id: this.selected()!.person_id } : this.newPerson()!),
    };
    this.submitting.set(true); this.error.set(null);
    this.service.submitOnboarding(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.submitting.set(false); this.submitted.set(true); },
      error: () => { this.submitting.set(false); this.error.set('The invitation could not be created. Revalidate the current identity and try again.'); },
    });
  }

  close(): void { if (!this.busy()) this.closed.emit(); }
}
