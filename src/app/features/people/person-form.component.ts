import { CommonModule } from '@angular/common';
import { Component, effect, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PersonListItem, PersonWriteFields } from '../../core/people/people.types';

export interface PersonFormSubmission {
  person: PersonWriteFields;
  joined_at?: string;
}

@Component({
  selector: 'app-person-form',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <section class="field-group">
        <h3>Personal details</h3>
        <div class="fields">
          <label>First name <input formControlName="first_name" autocomplete="given-name" /> @if (invalid('first_name')) { <small>First name is required.</small> }</label>
          <label>Last name <input formControlName="last_name" autocomplete="family-name" /> @if (invalid('last_name')) { <small>Last name is required.</small> }</label>
          <label>Email <input type="email" formControlName="primary_email" autocomplete="email" /> @if (invalid('primary_email')) { <small>Enter a valid email address.</small> }</label>
          <label>Mobile <input type="tel" formControlName="mobile" autocomplete="tel" /></label>
          <label>Location <input formControlName="location" autocomplete="address-level2" /></label>
          <label>Age range <input formControlName="age_range" /></label>
          <label>Gender <input formControlName="gender" /></label>
        </div>
      </section>
      @if (member()) {
        <section class="field-group membership">
          <h3>Membership</h3>
          <label>Join date <input type="date" formControlName="joined_at" /> @if (invalid('joined_at')) { <small>Join date is required.</small> }</label>
        </section>
      }
      <div class="actions">
        <button type="submit" class="button-primary" [disabled]="pending()">{{ pending() ? 'Saving...' : submitLabel() }}</button>
        <button type="button" class="button-secondary" [disabled]="pending()" (click)="cancelled.emit()">Cancel</button>
      </div>
    </form>
  `,
  styles: `
    form,.field-group,.fields { display:grid; gap:1rem; } .field-group { padding:1.15rem; border:1px solid rgba(22,39,53,.09); border-radius:1rem; background:#fff; }
    h3 { margin:0; color:#173248; font-size:1.05rem; } .fields { grid-template-columns:repeat(2,minmax(0,1fr)); }
    label { display:grid; gap:.38rem; font-weight:650; color:#294456; } input { min-width:0; padding:.68rem .78rem; border:1px solid #b7c7d4; border-radius:.7rem; font:inherit; color:#173248; }
    input:focus-visible { outline:0; border-color:#5d88a0; box-shadow:0 0 0 3px rgba(108,154,180,.2); } small { color:#a12929; font-weight:600; }
    .membership { max-width:22rem; } .actions { display:flex; gap:.7rem; flex-wrap:wrap; } button { border:0; border-radius:999px; padding:.72rem 1.1rem; font:inherit; font-weight:700; cursor:pointer; }
    .button-primary { color:#fff; background:#1d6077; } .button-secondary { color:#244359; background:#edf3f6; } button:disabled { opacity:.6; cursor:not-allowed; }
    @media (max-width:650px) { .fields { grid-template-columns:1fr; } }
  `,
})
export class PersonFormComponent {
  readonly initialPerson = input<PersonListItem | null>(null);
  readonly member = input(false);
  readonly submitLabel = input('Save person');
  readonly pending = input(false);
  readonly submitted = output<PersonFormSubmission>();
  readonly cancelled = output<void>();
  private readonly fb = new FormBuilder();
  readonly form = this.fb.nonNullable.group({
    first_name: ['', Validators.required], last_name: ['', Validators.required],
    primary_email: ['', Validators.email], mobile: [''], location: [''], age_range: [''], gender: [''],
    joined_at: [getLocalTodayDateInputValue()],
  });

  constructor() {
    effect(() => {
      const person = this.initialPerson();
      if (person) {
        this.form.patchValue({ ...person, primary_email: person.primary_email ?? '' }, { emitEvent: false });
      }
    });
  }

  invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  submit(): void {
    if (this.form.invalid || this.pending()) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const person: PersonWriteFields = {
      first_name: value.first_name.trim(), last_name: value.last_name.trim(),
      primary_email: value.primary_email.trim() || null, mobile: value.mobile.trim(), location: value.location.trim(),
      age_range: value.age_range.trim(), gender: value.gender.trim(),
    };
    this.submitted.emit({ person, ...(this.member() ? { joined_at: value.joined_at } : {}) });
  }
}

function getLocalTodayDateInputValue(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
