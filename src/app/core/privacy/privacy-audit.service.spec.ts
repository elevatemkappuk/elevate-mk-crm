import '@angular/compiler';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PrivacyAuditService } from './privacy-audit.service';
import { API_CONFIG } from '../http/api-config';

describe('PrivacyAuditService', () => {
  let service: PrivacyAuditService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl: 'http://localhost:8000/api/v1' } },
      ],
    });
    service = TestBed.inject(PrivacyAuditService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends bounded backend-owned history filters without changing the operational route', () => {
    service.getPersonHistory(12, {
      page: 2,
      occurred_from: '2026-01-01',
      outcome: 'SUCCESS',
      superuser_operation: true,
    }).subscribe();

    const request = http.expectOne((candidate) => candidate.url.endsWith('/people/12/privacy-audit-history/'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('occurred_from')).toBe('2026-01-01');
    expect(request.request.params.get('outcome')).toBe('SUCCESS');
    expect(request.request.params.get('superuser_operation')).toBe('true');
    request.flush({ count: 0, next: null, previous: null, results: [] });
  });
});
