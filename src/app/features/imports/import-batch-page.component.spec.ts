import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import {
  ImportBatchDetail,
  ImportReviewQueue,
  MembershipFormImportResponse,
  PaginatedImportRecordPreview,
} from '../../core/imports/import-reconciliation.types';
import { ImportBatchPageComponent } from './import-batch-page.component';

@Component({ template: '' })
class DummyRouteComponent {}

const readyForImportBatch: ImportBatchDetail = {
  id: 3,
  source_type: 'MEMBERSHIP_FORM',
  source_filename: 'members.xlsx',
  status: 'READY_FOR_IMPORT',
  created_at: '2026-09-02T09:00:00Z',
  started_at: '2026-09-02T09:00:00Z',
  completed_at: null,
  total_count: 2,
  review_required_count: 0,
  invalid_count: 0,
  resolved_count: 2,
  committed_count: 0,
  auto_match_count: 1,
  new_person_count: 1,
};

const importedResponse: MembershipFormImportResponse = {
  batch: { ...readyForImportBatch, status: 'IMPORTED', completed_at: '2026-09-02T10:00:00Z', committed_count: 2 },
  result: {
    processed_count: 2,
    people_created_count: 1,
    people_matched_count: 1,
    people_enriched_count: 0,
    memberships_created_count: 1,
    memberships_reused_count: 1,
    profiles_created_count: 1,
    profiles_enriched_count: 0,
    skipped_count: 0,
  },
};

class MockImportReconciliationService {
  batch = readyForImportBatch;
  readonly getBatch = vi.fn(() => of(this.batch));
  readonly getReviewQueue = vi.fn(() => of<ImportReviewQueue>({ count: 0, results: [] }));
  readonly getBatchRecords = vi.fn(() => of<PaginatedImportRecordPreview>({
    count: 1,
    next: null,
    previous: null,
    results: [{
      id: 9,
      source_row_identifier: 'row-1',
      status: 'RESOLVED',
      resolution_method: 'NO_MATCH',
      resolution_reason: 'NO_STRONG_CANDIDATE',
      resolved_person: null,
      source: {
        first_name: 'Source', last_name: 'Person', email: 'source@example.com', mobile: null,
        location: null, industry: null, job_title: null, linkedin_url: null,
      },
      validation_errors: [],
      reviewed_at: null,
      committed_at: null,
    }],
  }));
  readonly importMembershipFormBatch = vi.fn(() => of(importedResponse));
}

class MockAuthService {
  readonly isCrmAdmin = signal(true);
}

describe('ImportBatchPageComponent', () => {
  let fixture: ComponentFixture<ImportBatchPageComponent>;
  let service: MockImportReconciliationService;
  let auth: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportBatchPageComponent],
      providers: [
        provideRouter([{ path: 'imports', component: DummyRouteComponent }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '3' }) } } },
        { provide: ImportReconciliationService, useClass: MockImportReconciliationService },
        { provide: AuthService, useClass: MockAuthService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportBatchPageComponent);
    service = TestBed.inject(ImportReconciliationService) as unknown as MockImportReconciliationService;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    fixture.detectChanges();
  });

  function button(label: string): HTMLButtonElement {
    return (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (element: HTMLButtonElement) => element.textContent?.trim() === label,
    ) as HTMLButtonElement;
  }

  function confirmationButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('app-confirmation-dialog .button-primary') as HTMLButtonElement;
  }

  it('shows Add to CRM only for a CRM_ADMIN-ready batch', () => {
    expect(button('Add to CRM')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Ready to add to CRM');
    expect(fixture.nativeElement.textContent).not.toMatch(/commit/i);
    auth.isCrmAdmin.set(false);
    fixture.detectChanges();
    expect(button('Add to CRM')).toBeFalsy();
  });

  it('does not show Import for non-ready or terminal statuses', () => {
    for (const status of ['PROCESSING', 'READY_FOR_REVIEW', 'FAILED', 'IMPORTED'] as const) {
      fixture.componentInstance.batch.set({ ...readyForImportBatch, status });
      fixture.detectChanges();
      expect(button('Add to CRM')).toBeFalsy();
    }
  });

  it('requires confirmation and cancel does not call the API', () => {
    button('Add to CRM').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Add these records to the CRM?');
    button('Cancel').click();
    fixture.detectChanges();

    expect(service.importMembershipFormBatch).not.toHaveBeenCalled();
  });

  it('submits once, disables the action while importing, and renders the server result', () => {
    const pending = new Subject<MembershipFormImportResponse>();
    service.importMembershipFormBatch.mockReturnValueOnce(pending);
    button('Add to CRM').click();
    fixture.detectChanges();
    confirmationButton().click();
    fixture.detectChanges();
    button('Adding to CRM...').click();

    expect(service.importMembershipFormBatch).toHaveBeenCalledOnce();
    expect(service.importMembershipFormBatch).toHaveBeenCalledWith(3);
    expect(button('Adding to CRM...').disabled).toBe(true);

    pending.next(importedResponse);
    pending.complete();
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('Added to CRM');
    expect(content).toContain('2 records');
    expect(content).toContain('1 Person');
    expect(content).toContain('1 Membership');
    expect(content).toContain('1 Professional Profile');
    expect(content).toContain('Source Person');
    expect(content).not.toContain('Import batch');
  });

  it('keeps the batch unimported locally and refreshes it after a safe conflict', () => {
    service.importMembershipFormBatch.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })));
    button('Add to CRM').click();
    fixture.detectChanges();
    confirmationButton().click();
    fixture.detectChanges();

    expect(fixture.componentInstance.batch()?.status).toBe('READY_FOR_IMPORT');
    expect(fixture.nativeElement.textContent).toContain('can no longer be imported');
    expect(service.getBatch).toHaveBeenCalledTimes(2);
  });

  it('keeps imported batches terminal and read-only', () => {
    const component = fixture.componentInstance;
    component.batch.set(importedResponse.batch);
    fixture.detectChanges();

    expect(component.batchMessageTitle('IMPORTED')).toBe('Imported');
    expect(component.batchMessage('IMPORTED')).toContain('read-only');
    expect(button('Add to CRM')).toBeFalsy();
  });

  it('presents destination outcomes instead of None', () => {
    const component = fixture.componentInstance;
    const record = fixture.componentInstance.recordPage()!.results[0];

    expect(component.destinationLabel(record)).toBe('New CRM Person');
    expect(component.destinationLabel({ ...record, status: 'INVALID' })).toBe('Not added');
    expect(component.destinationLabel({ ...record, status: 'REVIEW_REQUIRED', resolution_method: null })).toBe('Pending review');

    component.recordPage.set({
      count: 1,
      next: null,
      previous: null,
      results: [{
        ...record,
        status: 'COMMITTED',
        resolved_person: { id: 77, first_name: 'Created', last_name: 'Person', primary_email: null, mobile: '', record_state: 'active' },
      }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Created Person');
    expect(fixture.nativeElement.textContent).not.toContain('None');
  });

  it('renders safe backend validation reasons for invalid records and keeps the destination not added', () => {
    const record = fixture.componentInstance.recordPage()!.results[0];
    fixture.componentInstance.recordPage.set({
      count: 1,
      next: null,
      previous: null,
      results: [{
        ...record,
        status: 'INVALID',
        resolution_method: null,
        validation_errors: [
          { field: 'age_range', code: 'unsupported_age_range', message: 'Age range is not supported.' },
          { field: 'gender', code: 'unsupported_gender', message: 'Gender is not supported.' },
          { field: 'email', code: 'invalid_email', message: 'Email address is not valid.' },
          { field: 'linkedin_url', code: 'invalid_url', message: 'LinkedIn URL is not valid.' },
        ],
      }],
    });
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('Invalid');
    expect(content).toContain('Age range is not supported.');
    expect(content).toContain('Gender is not supported.');
    expect(content).toContain('Email address is not valid.');
    expect(content).toContain('LinkedIn URL is not valid.');
    expect(content).toContain('Not added');
    expect(content).not.toContain('Will not be added to the CRM.');
  });

  it('uses a safe invalid-record fallback and leaves non-invalid decision copy unchanged', () => {
    const component = fixture.componentInstance;
    const record = component.recordPage()!.results[0];
    component.recordPage.set({
      count: 1,
      next: null,
      previous: null,
      results: [{ ...record, status: 'INVALID', resolution_method: null, validation_errors: [] }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Source record failed validation.');
    expect(component.resolutionLabel(record).detail).toBe('A new CRM Person will be created.');
  });
});
