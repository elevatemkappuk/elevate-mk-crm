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
});
