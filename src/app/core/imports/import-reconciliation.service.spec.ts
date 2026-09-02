import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiCredentialsInterceptor, csrfHeaderInterceptor } from '../http/auth-http.interceptors';
import { API_CONFIG } from '../http/api-config';
import { ImportReconciliationService } from './import-reconciliation.service';

describe('ImportReconciliationService', () => {
  let service: ImportReconciliationService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl: 'http://localhost:8000/api/v1' } },
        { provide: DOCUMENT, useValue: { cookie: '' } as Document },
      ],
    });
    service = TestBed.inject(ImportReconciliationService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests import batches without using People APIs', () => {
    service.listBatches().subscribe();
    const request = httpTesting.expectOne('http://localhost:8000/api/v1/imports/');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush([]);
  });

  it('sends only the selected candidate in a same-person resolution', () => {
    service.resolveSamePerson(3, 9, 44).subscribe();
    const request = httpTesting.expectOne('http://localhost:8000/api/v1/imports/3/review/9/resolve/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ resolution: 'SAME_PERSON', person_id: 44 });
    request.flush({});
  });

  it('sends no Person or Membership mutation data for a different-person decision', () => {
    service.resolveDifferentPerson(3, 9).subscribe();
    const request = httpTesting.expectOne('http://localhost:8000/api/v1/imports/3/review/9/resolve/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ resolution: 'DIFFERENT_PERSON' });
    request.flush({});
  });

  it('sends an explicit identity override confirmation only when requested', () => {
    service.resolveDifferentPerson(3, 9, true).subscribe();
    const request = httpTesting.expectOne('http://localhost:8000/api/v1/imports/3/review/9/resolve/');
    expect(request.request.body).toEqual({ resolution: 'DIFFERENT_PERSON', confirm_identity_override: true });
    request.flush({});
  });

  it('uploads the Membership Form as multipart FormData without forcing a content type', () => {
    const file = new File(['workbook'], 'membership.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    service.uploadMembershipForm(file).subscribe();
    const request = httpTesting.expectOne('http://localhost:8000/api/v1/imports/membership-form/');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toBe(file);
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({});
  });

  it('uploads Eventbrite workbooks and analyzes staged batches through their dedicated endpoints', () => {
    const file = new File(['workbook'], 'eventbrite.xlsx');
    service.uploadEventbrite(file).subscribe();
    let request = httpTesting.expectOne('http://localhost:8000/api/v1/imports/eventbrite/');
    expect(request.request.method).toBe('POST');
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush({});

    service.analyzeEventbriteBatch(3).subscribe();
    request = httpTesting.expectOne('http://localhost:8000/api/v1/imports/3/analyze/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush({});
  });

  it('imports a batch without inventing a request body', () => {
    service.importMembershipFormBatch(3).subscribe();
    const request = httpTesting.expectOne('http://localhost:8000/api/v1/imports/3/import/');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toBeNull();
    request.flush({ batch: {}, result: {} });
  });

  it('requests paginated batch records with the canonical query parameters', () => {
    service.getBatchRecords(3, { page: 2, page_size: 25 }).subscribe();
    const request = httpTesting.expectOne('http://localhost:8000/api/v1/imports/3/records/?page=2&page_size=25');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ count: 0, next: null, previous: null, results: [] });
  });
});
