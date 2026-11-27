import { CommonModule } from '@angular/common';
import { Component, effect, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { PersonListItem, PersonWriteFields } from '../../core/people/people.types';
import {
  AGE_RANGE_OPTIONS,
  GENDER_OPTIONS,
  toAgeRange,
  toGender,
} from '../../core/people/person-demographics';

export interface PersonFormSubmission {
  person: PersonWriteFields;
  joined_at?: string;
}
@Component({
  selector: 'app-person-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './person-form.component.html',
  styleUrl: './person-form.component.css',
})
export class PersonFormComponent {
  readonly initialPerson = input<PersonListItem | null>(null);
  readonly member = input(false);
  readonly submitLabel = input('Save person');
  readonly pending = input(false);
  readonly emailError = input<string | null>(null);
  readonly mobileError = input<string | null>(null);
  readonly drawer = input(false);
  readonly contactFieldsEditable = input(true);
  readonly demographicFieldsEditable = input(true);
  readonly edited = output<void>();
  readonly submitted = output<PersonFormSubmission>();
  readonly cancelled = output<void>();
  readonly ageRangeOptions = AGE_RANGE_OPTIONS;
  readonly genderOptions = GENDER_OPTIONS;
  private readonly fb = new FormBuilder();
  readonly form = this.fb.nonNullable.group({
    first_name: ['', Validators.required], last_name: ['', Validators.required],
    primary_email: ['', trimmedEmailValidator], mobile: [''], location: [''], age_range: [''], gender: [''],
    joined_at: [getLocalTodayDateInputValue()],
  });
  private initialValues = this.form.getRawValue();

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.edited.emit());
    effect(() => {
      const person = this.initialPerson();
      if (person) {
        this.form.patchValue({
          ...person,
          primary_email: person.primary_email ?? '',
          age_range: toAgeRange(person.age_range),
          gender: toGender(person.gender),
        }, { emitEvent: false });
        this.initialValues = this.form.getRawValue();
      }
    });
    effect(() => {
      const joinedAt = this.form.controls.joined_at;
      joinedAt.setValidators(this.member() ? [Validators.required] : []);
      joinedAt.updateValueAndValidity({ emitEvent: false });
    });
  }

  hasUnsavedEdits(): boolean {
    const values = this.form.getRawValue();
    return (Object.keys(values) as (keyof typeof values)[]).some(key => values[key].trim() !== this.initialValues[key]);
  }

  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  submit(): void {
    if (this.form.invalid || this.pending()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const person: PersonWriteFields = {
      first_name: value.first_name.trim(), last_name: value.last_name.trim(), location: value.location.trim(),
    };
    if (this.contactFieldsEditable()) {
      person.primary_email = value.primary_email.trim() || null;
      person.mobile = value.mobile.trim();
    }
    if (this.demographicFieldsEditable()) {
      person.age_range = toAgeRange(value.age_range);
      person.gender = toGender(value.gender);
    }
    this.submitted.emit({ person, ...(this.member() ? { joined_at: value.joined_at } : {}) });
  }
}
function trimmedEmailValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value.trim() : control.value;
  return Validators.email(new FormControl(value));
}

function getLocalTodayDateInputValue(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
