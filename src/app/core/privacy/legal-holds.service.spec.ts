import '@angular/compiler';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../http/api-config';
import { LegalHoldsService } from './legal-holds.service';

describe('LegalHoldsService', () => {
  let service: LegalHoldsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl: 'http://localhost:8000/api/v1' } },
      ],
    });
    service = TestBed.inject(LegalHoldsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses opaque event references and the separate direct-release transport', () => {
    service.create({ audit_event_reference: 'signed-event-reference', reason: 'Review' }).subscribe();
    const create = http.expectOne('http://localhost:8000/api/v1/privacy/legal-holds/');
    expect(create.request.body).toEqual({ audit_event_reference: 'signed-event-reference', reason: 'Review' });
    create.flush({});

    service.directRelease('hold-id', 'Direct review').subscribe();
    const release = http.expectOne('http://localhost:8000/api/v1/privacy/legal-holds/hold-id/direct-release/');
    expect(release.request.body).toEqual({ reason: 'Direct review' });
    release.flush({});
  });

  it('posts cancellation reasons to the governed release-request endpoint', () => {
    service.cancelRelease('request-1', 'The matter remains active').subscribe();

    const request = http.expectOne('http://localhost:8000/api/v1/privacy/legal-hold-release-requests/request-1/cancel/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'The matter remains active' });
    request.flush({ public_id: 'request-1', status: 'CANCELLED', permitted_actions: ['request_release'] });
  });
});
