import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../core/auth/auth.service';
import { API_CONFIG } from '../../core/http/api-config';
import { CampaignDetailPageComponent } from './campaign-detail-page.component';

@Component({ standalone: true, template: '' })
class CampaignFallbackComponent {}

describe('CampaignDetailPageComponent', () => {
  let http: HttpTestingController;
  const base = 'http://localhost:8000/api/v1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'marketing/campaigns/:id', component: CampaignDetailPageComponent }, { path: '**', component: CampaignFallbackComponent }]),
        provideHttpClient(), provideHttpClientTesting(), { provide: API_CONFIG, useValue: { apiBaseUrl: base } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const campaign = (status: string, preparationStatus = status === 'DRAFT' ? null : status) => ({ id: 4, name: 'Campaign', status, audience_selection: { q: '', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] }, audience_ordering: 'last_name', audience_schema_version: 1, created_by: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', current_preparation: preparationStatus ? { id: 2, attempt_number: 1, status: preparationStatus, started_at: '2026-01-01T00:00:00Z', completed_at: '2026-01-01T00:00:00Z', selected_count: 2, included_count: 1, excluded_count: 1, provider_ready_count: status === 'PREPARED' ? 1 : 0, provider_issue_count: 0, can_start_provider_preparation: false, can_retry_provider_preparation: false, brevo_list_id: null, brevo_campaign_id: null, brevo_editor_url: null, provider_error_code: status === 'PROVIDER_FAILED' ? 'BREVO_TEMPORARY' : null, provider_error_message: status === 'PROVIDER_FAILED' ? 'Safe provider error' : null } : null });

  it('keeps Prepare recipients hidden for viewers', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'viewer@example.com', person: { id: 1, first_name: 'View', last_name: 'Only', primary_email: 'viewer@example.com' }, staff_roles: ['CRM_VIEWER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('DRAFT'));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).not.toContain('Prepare recipients');
  });

  it('prepares recipients and refreshes the authoritative snapshot state', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'manager@example.com', person: { id: 1, first_name: 'Campaign', last_name: 'Manager', primary_email: 'manager@example.com' }, staff_roles: ['CRM_MANAGER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('DRAFT'));
    await harness.fixture.whenStable();
    harness.detectChanges();
    (Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find((button) => button.textContent?.includes('Prepare recipients')) as HTMLButtonElement).click();
    const prepare = http.expectOne(`${base}/marketing/campaigns/4/prepare/`);
    prepare.flush(campaign('SNAPSHOT_READY'));
    const recipients = http.expectOne(`${base}/marketing/campaigns/4/recipients/`);
    recipients.flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Recipients ready');
    expect(harness.routeNativeElement?.textContent).toContain('Recipients');
  });

  it('shows Prepare in Brevo only to managers and refreshes prepared state', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'manager@example.com', person: { id: 1, first_name: 'Campaign', last_name: 'Manager', primary_email: 'manager@example.com' }, staff_roles: ['CRM_MANAGER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('SNAPSHOT_READY'));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Prepare in Brevo');
    (Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find((button) => button.textContent?.includes('Prepare in Brevo')) as HTMLButtonElement).click();
    harness.detectChanges();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('app-confirmation-dialog .crm-button--primary')?.click();
    const request = http.expectOne(`${base}/marketing/campaigns/4/prepare-provider/`);
    expect(request.request.method).toBe('POST');
    request.flush(campaign('PREPARED', 'PREPARED'));
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('PREPARED', 'PREPARED'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Ready in Brevo');
    expect(harness.routeNativeElement?.textContent).toContain('Campaign draft created in Brevo');
  });

  it('maps failed, reconciliation, no-ready, and recipient reason states safely', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'viewer@example.com', person: { id: 1, first_name: 'View', last_name: 'Only', primary_email: 'viewer@example.com' }, staff_roles: ['CRM_VIEWER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Needs attention');
    expect(harness.routeNativeElement?.textContent).not.toContain('Retry Brevo preparation');
  });
});
