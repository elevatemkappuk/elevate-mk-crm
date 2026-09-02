import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportReviewDetail } from '../../core/imports/import-reconciliation.types';
import { ImportReviewPageComponent } from './import-review-page.component';

@Component({ template: '' })
class DummyRouteComponent {}

const reviewRecord: ImportReviewDetail = {
  id: 9,
  batch_id: 3,
  source_row_identifier: 'row-9',
  status: 'REVIEW_REQUIRED',
  source: {
    first_name: 'David', last_name: 'Mensah', email: 'david@example.com', mobile: '0712300000', location: 'Milton Keynes', job_title: 'Engineer',
    industry: 'Technology', linkedin_url: 'https://www.linkedin.com/in/david',
  },
  resolution_reason: 'UNIQUE_EMAIL_WITH_CONTRADICTION',
  match_evidence: {},
  validation_errors: [],
  batch: { id: 3, source_type: 'MEMBERSHIP_FORM', source_filename: 'members.xlsx', status: 'READY_FOR_REVIEW' },
  candidates: [
    {
      id: 44,
      first_name: 'David',
      last_name: 'Mensah',
      primary_email: 'david@example.com',
      mobile: '0712399999',
      record_state: 'archived',
      matched_on: ['EXACT_EMAIL'],
      name_agreement: true,
      mobile_agreement: false,
      email_agreement: true,
      contradiction_codes: ['MOBILE_CONFLICT'],
    },
    {
      id: 45,
      first_name: 'D.',
      last_name: 'Mensah',
      primary_email: null,
      mobile: '0712300000',
      record_state: 'active',
      matched_on: ['EXACT_MOBILE'],
      name_agreement: null,
      mobile_agreement: true,
      email_agreement: null,
      contradiction_codes: [],
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

  it('renders backend source and candidates with readable evidence, archived state, and no commit/search UI', () => {
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

  it('requires strong confirmation before submitting an email-involved different-person decision', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Different person'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Create a separate CRM Person?');
    expect(service.resolveDifferentPerson).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('app-confirmation-dialog .button-primary') as HTMLButtonElement).click();
    expect(service.resolveDifferentPerson).toHaveBeenCalledWith(3, 9, true);
    expect(navigate).toHaveBeenCalledWith(['/imports', 3]);
  });

  it('cancels an email override confirmation without submitting a resolution', () => {
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Different person'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('app-confirmation-dialog .button-secondary') as HTMLButtonElement).click();
    expect(service.resolveDifferentPerson).not.toHaveBeenCalled();
  });

  it('keeps a mobile-only different-person decision as the lighter flow', () => {
    fixture.componentInstance.record.set({
      ...reviewRecord,
      candidates: [{ ...reviewRecord.candidates[1] }],
    });
    fixture.detectChanges();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Different person'),
    ) as HTMLButtonElement;
    button.click();
    expect(service.resolveDifferentPerson).toHaveBeenCalledWith(3, 9);
  });

  it('displays a safe backend confirmation-required error', () => {
    service.resolveDifferentPerson.mockReturnValueOnce(throwError(() => ({
      status: 400,
      error: { detail: 'This record uses contact details already associated with another CRM Person. Confirm that these are different people before creating a separate Person.' },
    })));
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Different person'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('app-confirmation-dialog .button-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Confirm that these are different people before creating a separate Person.');
  });

  it('displays a safe stale-review conflict without hiding the review record', () => {
    service.resolveDifferentPerson.mockReturnValueOnce(throwError(() => ({
      status: 409,
      error: { detail: 'The possible CRM matches have changed since this identity decision was made. Review the record again before adding it to the CRM.' },
    })));
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (candidate: HTMLButtonElement) => candidate.textContent?.includes('Different person'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('app-confirmation-dialog .button-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('The possible CRM matches have changed since this identity decision was made.');
  });
});
