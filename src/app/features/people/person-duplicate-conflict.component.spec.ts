import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PersonDuplicateConflictComponent } from './person-duplicate-conflict.component';

describe('PersonDuplicateConflictComponent', () => {
  it('renders backend-provided candidates, including archived records', async () => {
    await TestBed.configureTestingModule({ imports: [PersonDuplicateConflictComponent], providers: [provideRouter([])] }).compileComponents();
    const fixture: ComponentFixture<PersonDuplicateConflictComponent> = TestBed.createComponent(PersonDuplicateConflictComponent);
    fixture.componentRef.setInput('conflict', { detail: 'duplicate', code: 'IDENTITY_COLLISION', collision: { collision: 'EMAIL_COLLISION', person_ids: [4, 5] }, candidates: [
      { id: 4, first_name: 'Amina', last_name: 'Zulu', primary_email: 'amina@example.com', mobile: '991', archived_at: null },
      { id: 5, first_name: 'Brian', last_name: 'Archive', primary_email: null, mobile: '', archived_at: '2026-08-31T00:00:00Z' },
    ] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Amina Zulu');
    expect(fixture.nativeElement.textContent).toContain('Archived');
    expect(fixture.nativeElement.querySelectorAll('a')).toHaveSize(2);
    expect(fixture.nativeElement.textContent).toContain('Create separate Person');
  });
});
