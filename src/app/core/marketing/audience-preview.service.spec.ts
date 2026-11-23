import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiCredentialsInterceptor, csrfHeaderInterceptor } from '../http/auth-http.interceptors';
import { API_CONFIG } from '../http/api-config';
import { AudiencePreviewService } from './audience-preview.service';

describe('AudiencePreviewService', () => {
  let service: AudiencePreviewService;
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
    service = TestBed.inject(AudiencePreviewService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('posts only the provider-neutral audience preview contract', () => {
    const request = {
      selection: { q: '', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] },
      result: 'eligible' as const,
      ordering: 'last_name' as const,
      page: 1,
      page_size: 25 as const,
    };
    service.preview(request).subscribe();

    const httpRequest = httpTesting.expectOne('http://localhost:8000/api/v1/marketing/audiences/preview/');
    expect(httpRequest.request.method).toBe('POST');
    expect(httpRequest.request.withCredentials).toBe(true);
    expect(httpRequest.request.body).toEqual(request);
    httpRequest.flush({
      selection: { ...request.selection, record_state: 'active' },
      selected_count: 0,
      eligible_count: 0,
      excluded_count: 0,
      exclusion_counts: { EXCLUDED_OPTED_OUT: 0, EXCLUDED_CONSENT_UNKNOWN: 0, EXCLUDED_NO_EMAIL: 0 },
      results: { count: 0, page: 1, page_size: 25, next_page: null, previous_page: null, next: null, previous: null, results: [] },
    });
  });
});
