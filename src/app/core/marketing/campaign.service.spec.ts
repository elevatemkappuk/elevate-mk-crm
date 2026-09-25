import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../http/api-config';
import { CampaignService } from './campaign.service';

describe('CampaignService', () => {
  let service: CampaignService;
  let http: HttpTestingController;
  const base = 'http://localhost:8000/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_CONFIG, useValue: { apiBaseUrl: base } }] });
    service = TestBed.inject(CampaignService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the Campaign API endpoints and wire-format payloads', () => {
    const selection = { q: 'mentor', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] };
    service.list().subscribe();
    http.expectOne(`${base}/marketing/campaigns/`).flush({ count: 0, next: null, previous: null, results: [] });
    service.create({ name: 'Spring Campaign', audience_selection: selection, audience_ordering: 'last_name' }).subscribe();
    const create = http.expectOne(`${base}/marketing/campaigns/`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Spring Campaign', audience_selection: selection, audience_ordering: 'last_name' });
    create.flush({});
    service.prepare(4).subscribe();
    const prepare = http.expectOne(`${base}/marketing/campaigns/4/prepare/`);
    expect(prepare.request.method).toBe('POST');
    prepare.flush({});
    service.recipients(4).subscribe();
    const recipients = http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`);
    expect(recipients.request.method).toBe('GET');
    recipients.flush({});
    service.prepareProvider(4).subscribe();
    const provider = http.expectOne(`${base}/marketing/campaigns/4/prepare-provider/`);
    expect(provider.request.method).toBe('POST');
    provider.flush({});
  });
});
