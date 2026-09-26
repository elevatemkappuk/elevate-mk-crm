import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { API_CONFIG } from '../../core/http/api-config';
import { CampaignsPageComponent } from './campaigns-page.component';

describe('CampaignsPageComponent', () => {
  let http: HttpTestingController;
  const base = 'http://localhost:8000/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'marketing/campaigns', component: CampaignsPageComponent }]), provideHttpClient(), provideHttpClientTesting(), { provide: API_CONFIG, useValue: { apiBaseUrl: base } }] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders the empty state', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns');
    http.expectOne(`${base}/marketing/campaigns/?lifecycle=active`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('No active campaigns');
  });

  it('renders the error state', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns');
    http.expectOne(`${base}/marketing/campaigns/?lifecycle=active`).flush('failed', { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Campaigns could not be loaded right now');
  });

  it('loads the archived lifecycle view from the URL and keeps workflow status separate', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns?lifecycle=archived');
    const request = http.expectOne(`${base}/marketing/campaigns/?lifecycle=archived`);
    request.flush({ count: 1, next: null, previous: null, results: [{
      id: 9, name: 'Prepared history', status: 'PREPARED', audience_selection: { q: '', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] }, audience_ordering: 'last_name', audience_schema_version: 1, created_by: 1, created_at: '', updated_at: '', archived_at: '2026-01-01T00:00:00Z', archived_by: 1, is_archived: true, can_archive: false, can_restore: true, can_delete: false, current_preparation: null,
    }] });
    await harness.fixture.whenStable();
    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Prepared history');
    expect(text).toContain('Ready in Brevo');
    expect(text).toContain('Archived');
  });
});
