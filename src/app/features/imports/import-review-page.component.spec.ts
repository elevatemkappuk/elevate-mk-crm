import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportReviewRecord } from '../../core/imports/import-reconciliation.types';
import { ImportReviewPageComponent } from './import-review-page.component';

@Component({ template: '' })
class DummyRouteComponent {}

const reviewRecord: ImportReviewRecord = {
  id: 9,
  batch_id: 3,
  normalized_data: {
    first_name: 'David', last_name: 'Mensah', email: 'david@example.com', mobile: '0712300000', location: 'Milton Keynes', job_title: 'Engineer',
  },
  resolution_reason: 'UNIQUE_EMAIL_WITH_CONTRADICTION',
  match_evidence: {},
  match_candidates: [
    {
      person_id: 44,
      matched_on: ['EXACT_EMAIL'],
      name_agreement: true,
      mobile_agreement: false,
      email_agreement: true,
      person_record_state: 'archived',
      contradiction_codes: ['MOBILE_CONFLICT'],
      person: { first_name: 'David', last_name: 'Mensah', primary_email: 'david@example.com', mobile: '0712399999', location: 'Milton Keynes' },
    },
    {
      person_id: 45,
      matched_on: ['EXACT_MOBILE'],
      name_agreement: null,
      mobile_agreement: true,
      email_agreement: null,
      person_record_state: 'active',
      contradiction_codes: [],
      person: { first_name: 'D.', last_name: 'Mensah', primary_email: null, mobile: '0712300000', location: 'Milton Keynes' },
    },
  ],
};

class MockImportReconciliationService {
  readonly getReviewRecord = vi.fn(() => of(reviewRecord));
  readonly resolveSamePerson = vi.fn(() => of(reviewRecord));
  readonly resolveDifferentPerson = vi.fn(() => of(reviewRecord));
}

describe('ImportReviewPageComponent', () => {
  let fixture: ComponentFixture<ImportReviewPageComponent>;
  let service: MockImportReconciliationService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportReviewPageComponent],
      providers: [
        provideRouter([{ path: 'imports/:id', component: DummyRouteComponent }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '3', recordId: '9' }) } } },
        { provide: ImportReconciliationService, useClass: MockImportReconciliationService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportReviewPageComponent);
    service = TestBed.inject(ImportReconciliationService) as unknown as MockImportReconciliationService;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('renders the source record, readable evidence, archived candidate state, and no commit/search UI', () => {
    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('Source record');
    expect(content).toContain('David Mensah');
    expect(content).toContain('Exact email');
    expect(content).toContain('Mobile differs');
    expect(content).toContain('Archived person');
    expect(content).not.toContain('Commit');
    expect(content).not.toContain('Search People');
  });

  it('requires a selected candidate before same-person can be submitted', () => {
    const samePersonButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button: HTMLButtonElement) => button.textContent?.includes('Same person'),
    ) as HTMLButtonElement;
    expect(samePersonButton.disabled).toBe(true);
    samePersonButton.click();
    expect(service.resolveSamePerson).not.toHaveBeenCalled();
  });

  it('sends the selected analyzer candidate for same-person resolution', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const candidates = fixture.nativeElement.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
    candidates[1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const samePersonButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button: HTMLButtonElement) => button.textContent?.includes('Same person'),
    ) as HTMLButtonElement;
    samePersonButton.click();
    expect(service.resolveSamePerson).toHaveBeenCalledWith(3, 9, 45);
    expect(navigate).toHaveBeenCalledWith(['/imports', 3]);
  });

  it('submits a different-person resolution without an arbitrary Person selection', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Different person'),
    ) as HTMLButtonElement;
    button.click();
    expect(service.resolveDifferentPerson).toHaveBeenCalledWith(3, 9);
    expect(navigate).toHaveBeenCalledWith(['/imports', 3]);
  });

  it('refreshes the queue after a stale conflict', () => {
    service.resolveDifferentPerson.mockReturnValueOnce(throwError(() => ({ status: 409 })));
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Different person'),
    ) as HTMLButtonElement;
    button.click();
    expect(navigate).toHaveBeenCalledWith(['/imports', 3]);
  });
});
