import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PersonFormComponent, PersonFormSubmission } from './person-form.component';

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

    component.form.setValue({ first_name: ' Ama ', last_name: ' Amoah ', primary_email: 'not-email', mobile: '', location: '', age_range: '', gender: '', joined_at: '2026-08-31' });
    component.submit();
    expect(component.form.controls.primary_email.hasError('email')).toBe(true);

    component.form.patchValue({ primary_email: ' ama@example.com ', mobile: ' 991000001 ' });
    component.submit();
    expect(submissions).toEqual([{ person: { first_name: 'Ama', last_name: 'Amoah', primary_email: 'ama@example.com', mobile: '991000001', location: '', age_range: '', gender: '' }, joined_at: '2026-08-31' }]);
  });
});
