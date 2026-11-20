import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_CONFIG } from '../http/api-config';
import { CommunityModerationService } from './community-moderation.service';

describe('CommunityModerationService', () => {
  const base = 'http://localhost:8000/api/v1';
  let service: CommunityModerationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_CONFIG, useValue: { apiBaseUrl: base } }] });
    service = TestBed.inject(CommunityModerationService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses the queue, detail, and bounded action contracts', () => {
    service.list(2).subscribe();
    const list = http.expectOne(`${base}/community/moderation/reports/?page=2&page_size=25`);
    expect(list.request.method).toBe('GET');
    list.flush({ count: 0, next: null, previous: null, results: [] });
    service.get('report/one').subscribe();
    const detail = http.expectOne(`${base}/community/moderation/reports/report%2Fone/`);
    expect(detail.request.method).toBe('GET');
    detail.flush({});
    service.action('r-1', 'remove', 'Reviewed by staff.').subscribe();
    const action = http.expectOne(`${base}/community/moderation/reports/r-1/remove/`);
    expect(action.request.method).toBe('POST');
    expect(action.request.body).toEqual({ resolution: 'Reviewed by staff.' });
    action.flush({});
  });
});

