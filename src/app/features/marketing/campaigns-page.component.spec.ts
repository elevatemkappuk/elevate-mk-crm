import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { API_CONFIG } from '../../core/http/api-config';
import { CampaignsPageComponent } from './campaigns-page.component';
import { Campaign } from '../../core/marketing/campaign.types';

describe('CampaignsPageComponent', () => {
  let http: HttpTestingController;
  const base = 'http://localhost:8000/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'marketing/campaigns', component: CampaignsPageComponent }]), provideHttpClient(), provideHttpClientTesting(), { provide: API_CONFIG, useValue: { apiBaseUrl: base } }] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const makeCampaign = (overrides: Partial<Campaign> = {}): Campaign => ({
    id: 7, name: 'Lifecycle test', status: 'DRAFT',
    audience_selection: { q: '', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] },
    audience_ordering: 'last_name', audience_schema_version: 1, created_by: 1,
    created_at: '', updated_at: '', archived_at: null, archived_by: null, is_archived: false,
    can_archive: true, can_restore: false, can_delete: false, current_preparation: null,
    ...overrides,
  });

  const flushList = (results: Campaign[]): void => {
    http.expectOne(`${base}/marketing/campaigns/?lifecycle=active`).flush({ count: results.length, next: null, previous: null, results });
  };

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

  it('shows Archive only when the backend allows it and never shows Delete in the list', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns');
    flushList([makeCampaign(), makeCampaign({ id: 8, name: 'Viewer row', can_archive: false })]);
    await harness.fixture.whenStable();
    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).not.toContain('Delete draft');
    expect(harness.routeNativeElement?.querySelectorAll('button.lifecycle-action').length).toBe(1);
  });

  it('shows Restore only when the backend allows it in the archived view', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns?lifecycle=archived');
    http.expectOne(`${base}/marketing/campaigns/?lifecycle=archived`).flush({ count: 2, next: null, previous: null, results: [
      makeCampaign({ id: 9, is_archived: true, archived_at: '2026-01-01T00:00:00Z', can_archive: false, can_restore: true }),
      makeCampaign({ id: 10, name: 'No restore', is_archived: true, archived_at: '2026-01-01T00:00:00Z', can_archive: false, can_restore: false }),
    ] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent?.match(/Restore/g)?.length).toBe(1);
    expect(harness.routeNativeElement?.querySelectorAll('button.lifecycle-action').length).toBe(1);
  });

  it('requires confirmation and does not call the API when Archive is cancelled', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns');
    flushList([makeCampaign()]);
    await harness.fixture.whenStable();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('button.lifecycle-action')?.click();
    await harness.fixture.whenStable();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Archive campaign?');
    expect(harness.routeNativeElement?.textContent).toContain('no Brevo resources will be deleted');
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.button-secondary')?.click();
    await harness.fixture.whenStable();
    http.expectNone(`${base}/marketing/campaigns/7/archive/`);
  });

  it('archives after confirmation, refreshes the active list, and prevents duplicate submission', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns');
    flushList([makeCampaign()]);
    await harness.fixture.whenStable();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('button.lifecycle-action')?.click();
    await harness.fixture.whenStable();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.crm-button--primary')?.click();
    await harness.fixture.whenStable();
    const archive = http.expectOne(`${base}/marketing/campaigns/7/archive/`);
    expect(harness.routeNativeElement?.querySelector<HTMLButtonElement>('button.lifecycle-action')?.disabled).toBe(true);
    archive.flush(makeCampaign({ is_archived: true, can_archive: false, can_restore: true }));
    flushList([]);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('No active campaigns');
    expect(harness.routeNativeElement?.textContent).toContain('Campaign archived');
  });

  it('restores after confirmation and refreshes the archived list', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns?lifecycle=archived');
    http.expectOne(`${base}/marketing/campaigns/?lifecycle=archived`).flush({ count: 1, next: null, previous: null, results: [makeCampaign({ is_archived: true, can_archive: false, can_restore: true })] });
    await harness.fixture.whenStable();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('button.lifecycle-action')?.click();
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Restore campaign?');
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.crm-button--primary')?.click();
    http.expectOne(`${base}/marketing/campaigns/7/restore/`).flush(makeCampaign({ is_archived: false, can_archive: true, can_restore: false }));
    http.expectOne(`${base}/marketing/campaigns/?lifecycle=archived`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('No archived campaigns');
    expect(harness.routeNativeElement?.textContent).toContain('Campaign restored');
  });

  it('shows a safe conflict error and refreshes after an unsuccessful lifecycle action', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns');
    flushList([makeCampaign()]);
    await harness.fixture.whenStable();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('button.lifecycle-action')?.click();
    await harness.fixture.whenStable();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('.crm-button--primary')?.click();
    http.expectOne(`${base}/marketing/campaigns/7/archive/`).flush({ detail: 'internal provider state' }, { status: 409, statusText: 'Conflict' });
    flushList([makeCampaign({ name: 'Refreshed row' })]);
    await harness.fixture.whenStable();
    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('changed before the lifecycle action completed');
    expect(text).not.toContain('internal provider state');
    expect(text).toContain('Refreshed row');
  });
});
