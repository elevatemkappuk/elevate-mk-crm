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
    http.expectOne(`${base}/marketing/campaigns/`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('No campaigns yet');
  });

  it('renders the error state', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns');
    http.expectOne(`${base}/marketing/campaigns/`).flush('failed', { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Campaigns could not be loaded right now');
  });
});

