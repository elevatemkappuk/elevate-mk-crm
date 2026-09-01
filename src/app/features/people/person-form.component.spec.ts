import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PersonListItem } from '../../core/people/people.types';
import { PersonFormComponent, PersonFormSubmission } from './person-form.component';

const canonicalPerson: PersonListItem = {
  id: 1,
  first_name: 'Ama',
  last_name: 'Amoah',
  primary_email: 'ama@example.com',
  mobile: '991000001',
  location: 'Lilongwe',
  age_range: '25_29',
  gender: 'NON_BINARY',
  archived_at: null,
  created_at: '2026-09-01T12:00:00Z',
  updated_at: '2026-09-01T12:00:00Z',
};

describe('PersonFormComponent', () => {
  let fixture: ComponentFixture<PersonFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PersonFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(PersonFormComponent);
    fixture.componentRef.setInput('member', true);
    fixture.detectChanges();
  });

  it('requires names, validates email, and emits a canonical member payload', () => {
    const component = fixture.componentInstance;
    const submissions: PersonFormSubmission[] = [];
    component.submitted.subscribe((value) => submissions.push(value));
    component.submit();
    expect(component.form.controls.first_name.hasError('required')).toBe(true);
    expect(component.form.controls.last_name.hasError('required')).toBe(true);

    component.form.setValue({ first_name: ' Ama ', last_name: ' Amoah ', primary_email: 'not-email', mobile: '', location: '', age_range: '25_29', gender: 'NON_BINARY', joined_at: '2026-08-31' });
    component.submit();
    expect(component.form.controls.primary_email.hasError('email')).toBe(true);

    component.form.patchValue({ primary_email: ' ama@example.com ', mobile: ' 991000001 ' });
    component.submit();
    expect(submissions).toEqual([{ person: { first_name: 'Ama', last_name: 'Amoah', primary_email: 'ama@example.com', mobile: '991000001', location: '', age_range: '25_29', gender: 'NON_BINARY' }, joined_at: '2026-08-31' }]);
  });

  it('renders shared canonical options and preselects canonical demographic values', () => {
    fixture.componentRef.setInput('initialPerson', canonicalPerson);
    fixture.detectChanges();

    const ageSelect = fixture.nativeElement.querySelector('select[formControlName="age_range"]') as HTMLSelectElement;
    const genderSelect = fixture.nativeElement.querySelector('select[formControlName="gender"]') as HTMLSelectElement;
    const ageLabels = Array.from(ageSelect.options).map((option) => option.text);
    const genderLabels = Array.from(genderSelect.options).map((option) => option.text);

    expect(ageLabels).toEqual(['Not specified', 'Under 25', '25 - 29', '30 - 34', '35 - 39', '40 - 45', 'Over 45']);
    expect(genderLabels).toEqual(['Not specified', 'Male', 'Female', 'Non-Binary', 'Transgender', 'Other']);
    expect(ageSelect.value).toBe('25_29');
    expect(genderSelect.value).toBe('NON_BINARY');
  });
});
