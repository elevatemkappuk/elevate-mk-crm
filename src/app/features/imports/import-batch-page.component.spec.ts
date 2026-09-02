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
  AuthoritativeImportResponse,
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

const importedResponse: AuthoritativeImportResponse = {
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

const eventbriteImportedResponse: AuthoritativeImportResponse = {
  batch: {
    ...readyForImportBatch,
    source_type: 'EVENTBRITE',
    status: 'IMPORTED',
    completed_at: '2026-09-02T10:00:00Z',
    committed_count: 2,
  },
  result: {
    processed_count: 2,
    people_created_count: 1,
    people_matched_count: 1,
    events_created_count: 1,
    events_reused_count: 1,
    participations_created_count: 2,
    participations_reused_count: 1,
    participations_preserved_count: 0,
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
  readonly importBatch = vi.fn(() => of(importedResponse));
  readonly analyzeEventbriteBatch = vi.fn(() => of({ ...readyForImportBatch, source_type: 'EVENTBRITE', status: 'READY_FOR_IMPORT' as const }));
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
    expect(fixture.nativeElement.textContent).toContain('Resolution preview');
    expect(fixture.nativeElement.textContent).toContain('Review how each record will be handled before adding it to the CRM.');
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

    expect(service.importBatch).not.toHaveBeenCalled();
  });

  it('submits once, disables the action while importing, and renders the server result', () => {
    const pending = new Subject<AuthoritativeImportResponse>();
    service.importBatch.mockReturnValueOnce(pending);
    button('Add to CRM').click();
    fixture.detectChanges();
    confirmationButton().click();
    fixture.detectChanges();
    button('Adding to CRM...').click();

    expect(service.importBatch).toHaveBeenCalledOnce();
    expect(service.importBatch).toHaveBeenCalledWith(3);
    expect(button('Adding to CRM...').disabled).toBe(true);

    pending.next(importedResponse);
    pending.complete();
    fixture.detectChanges();

    const summary = fixture.nativeElement.querySelector('.import-success').textContent as string;
    expect(summary).toContain('Added to CRM');
    expect(summary).toContain('The records were added to the CRM successfully.');
    expect(summary).toContain('2 records');
    expect(summary).toContain('1 Person');
    expect(summary).toContain('1 Membership');
    expect(summary).toContain('0 records');
    expect(summary).not.toContain('People enriched');
    expect(summary).not.toContain('Memberships reused');
    expect(summary).not.toContain('Profiles created');
    expect(summary).not.toContain('Profiles enriched');
    expect(fixture.nativeElement.textContent).toContain('Source Person');
    expect(fixture.nativeElement.textContent).not.toContain('Import batch');
    expect(fixture.componentInstance.countLabel(1, 'Person', 'People')).toBe('Person');
    expect(fixture.componentInstance.countLabel(2, 'Person', 'People')).toBe('People');
    expect(fixture.componentInstance.countLabel(1, 'Membership')).toBe('Membership');
    expect(fixture.componentInstance.countLabel(2, 'Membership')).toBe('Memberships');
    expect(fixture.componentInstance.countLabel(1, 'record')).toBe('record');
    expect(fixture.componentInstance.countLabel(2, 'record')).toBe('records');
  });

  it('keeps the batch unimported locally and refreshes it after a safe conflict', () => {
    service.importBatch.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })));
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

    expect(component.batchMessageTitle(importedResponse.batch)).toBe('Imported');
    expect(component.batchMessage(importedResponse.batch)).toContain('read-only');
    expect(button('Add to CRM')).toBeFalsy();
  });

  it('analyzes Eventbrite STAGED batches once before exposing Add to CRM', () => {
    const staged = { ...readyForImportBatch, source_type: 'EVENTBRITE', status: 'STAGED' as const };
    fixture.componentInstance.batch.set(staged);
    fixture.detectChanges();

    expect(button('Analyze buyers')).toBeTruthy();
    expect(button('Add to CRM')).toBeFalsy();
    button('Analyze buyers').click();
    button('Analyze buyers').click();
    expect(service.analyzeEventbriteBatch).toHaveBeenCalledOnce();
    expect(service.analyzeEventbriteBatch).toHaveBeenCalledWith(3);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Identity review complete');
    expect(fixture.nativeElement.textContent).toContain('ready to add buyers, Events, and event registrations');
    expect(button('Add to CRM')).toBeTruthy();
  });

  it('imports a ready Eventbrite batch through the shared confirmation and displays backend Eventbrite counts', () => {
    fixture.componentInstance.batch.set({ ...readyForImportBatch, source_type: 'EVENTBRITE' });
    service.importBatch.mockReturnValueOnce(of(eventbriteImportedResponse));
    fixture.detectChanges();

    button('Add to CRM').click();
    fixture.detectChanges();

    const confirmation = fixture.nativeElement.textContent as string;
    expect(confirmation).toContain('buyers, Events, and event registrations');
    expect(confirmation).toContain('Memberships will not be created or changed.');
    confirmationButton().click();
    fixture.detectChanges();

    expect(service.importBatch).toHaveBeenCalledOnce();
    expect(service.importBatch).toHaveBeenCalledWith(3);
    const summary = fixture.nativeElement.querySelector('.import-success').textContent as string;
    expect(summary).toContain('Events created');
    expect(summary).toContain('Events reused');
    expect(summary).toContain('Participations created');
    expect(summary).toContain('Participations reused');
    expect(summary).toContain('1 Event');
    expect(summary).toContain('2 participations');
    expect(summary).not.toContain('Memberships created');
    expect(button('Add to CRM')).toBeFalsy();
  });

  it('presents imported records as historical results while preserving their outcomes', () => {
    const component = fixture.componentInstance;
    const record = component.recordPage()!.results[0];
    component.batch.set(importedResponse.batch);
    component.recordPage.set({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          ...record,
          status: 'COMMITTED',
          resolution_method: 'STAFF_MATCH',
          resolved_person: { id: 77, first_name: 'Existing', last_name: 'Person', primary_email: 'existing@example.com', mobile: '', record_state: 'active' },
        },
        {
          ...record,
          id: 10,
          status: 'INVALID',
          resolution_method: null,
          validation_errors: [{ field: 'age_range', code: 'unsupported_age_range', message: 'Age range is not supported.' }],
        },
      ],
    });
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('Import results');
    expect(content).toContain('Review how each source record was handled.');
    expect(content).not.toContain('Review how each record will be handled before adding it to the CRM.');
    expect(content).toContain('Added to the CRM.');
    expect(content).toContain('Existing Person');
    expect(content).toContain('Invalid');
    expect(content).toContain('Age range is not supported.');
    expect(content).toContain('Excluded');
  });

  it('presents destination outcomes instead of None', () => {
    const component = fixture.componentInstance;
    const record = fixture.componentInstance.recordPage()!.results[0];

    expect(component.destinationLabel(record)).toBe('New CRM Person');
    expect(component.destinationLabel({ ...record, status: 'INVALID' })).toBe('Excluded');
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

  it('renders safe backend validation reasons for invalid records and keeps the destination excluded', () => {
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
    expect(content).toContain('Excluded');
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
