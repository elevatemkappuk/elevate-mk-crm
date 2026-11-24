import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_CONFIG } from '../../core/http/api-config';
import { PrivacyAdministrationService } from './privacy-administration.service';

describe('PrivacyAdministrationService', () => {
  const apiBaseUrl = 'http://localhost:8000/api/v1';
  let service: PrivacyAdministrationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
      ],
    });
    service = TestBed.inject(PrivacyAdministrationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the backend governance contracts without storing local state', () => {
    service.target(42).subscribe();
    const target = http.expectOne(`${apiBaseUrl}/staff/governance/targets/42/`);
    expect(target.request.method).toBe('GET');
    target.flush({ target_user_id: 42 });

    service.applyIndividualChange({
      operation: 'INDIVIDUAL_RESTRICT',
      capability: 'PERSON_CONTACT_READ',
      target_user_id: 42,
      reason: 'Required review justification',
    }).subscribe();
    const mutation = http.expectOne(`${apiBaseUrl}/staff/governance/individual-changes/`);
    expect(mutation.request.method).toBe('POST');
    expect(mutation.request.body).toEqual({
      operation: 'INDIVIDUAL_RESTRICT',
      capability: 'PERSON_CONTACT_READ',
      target_user_id: 42,
      reason: 'Required review justification',
    });
    mutation.flush({ status: 'APPROVED' });
  });
});
