import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

  const campaign = (status: string, preparationStatus = status === 'DRAFT' ? null : status, lifecycle = {}) => ({ id: 4, name: 'Campaign', status, audience_selection: { q: '', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] }, audience_ordering: 'last_name', audience_schema_version: 1, created_by: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', archived_at: null, archived_by: null, is_archived: false, can_archive: true, can_restore: false, can_delete: status === 'DRAFT', ...lifecycle, current_preparation: preparationStatus ? { id: 2, attempt_number: 1, status: preparationStatus, started_at: '2026-01-01T00:00:00Z', completed_at: '2026-01-01T00:00:00Z', selected_count: 2, included_count: 1, excluded_count: 1, provider_ready_count: status === 'PREPARED' ? 1 : 0, provider_issue_count: status === 'RECONCILIATION_REQUIRED' ? 1 : 0, can_start_provider_preparation: false, can_retry_provider_preparation: status === 'RECONCILIATION_REQUIRED' || status === 'PROVIDER_FAILED', brevo_list_id: null, brevo_campaign_id: null, brevo_editor_url: null, provider_error_code: status === 'PROVIDER_FAILED' ? 'BREVO_TEMPORARY' : null, provider_error_message: status === 'PROVIDER_FAILED' ? 'Safe provider error' : null } : null });

  it('keeps Prepare recipients hidden for viewers', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'viewer@example.com', person: { id: 1, first_name: 'View', last_name: 'Only', primary_email: 'viewer@example.com' }, staff_roles: ['CRM_VIEWER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('DRAFT'));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Prepare campaign');
    expect(harness.routeNativeElement?.textContent).toContain("Recipients haven't been prepared yet");
    expect(harness.routeNativeElement?.textContent).toContain('before preparing the Campaign');
    expect(harness.routeNativeElement?.textContent).not.toContain('Prepare recipients');
  });

  it('prepares recipients and refreshes the authoritative snapshot state', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'manager@example.com', person: { id: 1, first_name: 'Campaign', last_name: 'Manager', primary_email: 'manager@example.com' }, staff_roles: ['CRM_MANAGER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('DRAFT'));
    await harness.fixture.whenStable();
    harness.detectChanges();
    const workflow = harness.routeNativeElement?.querySelector('.draft-workflow-panel');
    expect(workflow).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('.campaign-summary')).toBeNull();
    expect(workflow?.textContent).toContain('Prepare campaign');
    expect(workflow?.textContent).toContain('Audience');
    expect(workflow?.textContent).toContain("Recipients haven't been prepared yet");
    expect(workflow?.textContent).toContain('What happens next');
    expect(workflow?.textContent).toContain('Check recipients');
    expect(workflow?.textContent).toContain('Save recipient snapshot');
    expect(workflow?.textContent).toContain('Prepare in Brevo');
    expect(workflow?.querySelector('.draft-workflow-columns')).not.toBeNull();
    expect(workflow?.querySelector('button')?.textContent).toContain('Prepare recipients');
    expect(harness.routeNativeElement?.querySelector('section > button.crm-button--primary')).toBeNull();
    (Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find((button) => button.textContent?.includes('Prepare recipients')) as HTMLButtonElement).click();
    const prepare = http.expectOne(`${base}/marketing/campaigns/4/prepare/`);
    prepare.flush(campaign('SNAPSHOT_READY'));
    const recipients = http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`);
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
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
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
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Ready in Brevo');
    expect(harness.routeNativeElement?.textContent).toContain('All 1 recipient is prepared in Brevo.');
    expect(harness.routeNativeElement?.textContent).toContain('Campaign draft created in Brevo');
  });

  it('renders one compact summary with audience and selection sentence', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush({
      ...campaign('SNAPSHOT_READY', 'SNAPSHOT_READY'),
      audience_selection: { q: 'fran', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] },
    });
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    const summary = harness.routeNativeElement?.querySelector('.campaign-summary');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('Campaign summary');
    expect(summary?.textContent).toContain('Audience');
    expect(summary?.textContent).toContain('Search: fran');
    expect(summary?.textContent).toContain('Selection');
    expect(summary?.textContent).toContain('2 people selected \u00b7 1 included \u00b7 1 excluded');
    expect(summary?.querySelector('.recipient-metrics')).toBeNull();
    expect(summary?.textContent).not.toContain('Preparation');
    expect(summary?.textContent).not.toContain('Status');
    expect(harness.routeNativeElement?.textContent).toContain('Recipients ready');
  });

  it('keeps the all-people fallback and every audience criterion visible', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush({
      ...campaign('DRAFT'),
      audience_selection: { q: 'fran', relationship: ['Member'], location: ['Milton Keynes'], industry: ['Technology'], career_stage: ['Senior'], interest: ['Training'], skill: ['Leadership'], tag: ['Newsletter'] },
    });
    await harness.fixture.whenStable();
    const summary = harness.routeNativeElement?.querySelector('.draft-workflow-panel');
    for (const criterion of ['Search: fran', 'Relationships: Member', 'Locations: Milton Keynes', 'Industries: Technology', 'Career stages: Senior', 'Interests: Training', 'Skills: Leadership', 'Tags: Newsletter']) {
      expect(summary?.textContent).toContain(criterion);
    }

  });

  it('renders All active People when no audience filters are saved', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('DRAFT'));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.querySelector('.draft-workflow-panel')?.textContent).toContain('All active People');
  });

  it('maps failed, reconciliation, no-ready, and recipient reason states safely', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'viewer@example.com', person: { id: 1, first_name: 'View', last_name: 'Only', primary_email: 'viewer@example.com' }, staff_roles: ['CRM_VIEWER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Needs attention');
    expect(harness.routeNativeElement?.textContent).not.toContain('Retry Brevo preparation');
  });

  it('shows only included reconciliation recipients with safe staff-facing reasons', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'viewer@example.com', person: { id: 1, first_name: 'View', last_name: 'Only', primary_email: 'viewer@example.com' }, staff_roles: ['CRM_VIEWER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 3, next: null, previous: null, results: [
      { id: 1, person: 11, email_snapshot: 'restricted@example.com', first_name_snapshot: 'Restricted', last_name_snapshot: 'Person', consent_state_snapshot: 'OPTED_IN', decision: 'INCLUDED', exclusion_reason: null, captured_at: '', provider_outcome: 'RECONCILIATION_REQUIRED', provider_error_code: 'BREVO_CONTACT_RESTRICTED' },
      { id: 2, person: 12, email_snapshot: 'ready@example.com', first_name_snapshot: 'Ready', last_name_snapshot: 'Person', consent_state_snapshot: 'OPTED_IN', decision: 'INCLUDED', exclusion_reason: null, captured_at: '', provider_outcome: 'ADDED_TO_CAMPAIGN_LIST', provider_error_code: null },
      { id: 3, person: 13, email_snapshot: 'excluded@example.com', first_name_snapshot: 'Excluded', last_name_snapshot: 'Person', consent_state_snapshot: 'OPTED_OUT', decision: 'EXCLUDED', exclusion_reason: 'EXCLUDED_OPTED_OUT', captured_at: '', provider_outcome: null, provider_error_code: null },
    ] });
    await harness.fixture.whenStable();
    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Needs attention');
    expect(text).not.toContain('Recipients needing attention');
    expect(text).toContain('0 of 1 included recipients are ready in Brevo.');
    expect(text).toContain('1 recipients need review.');
    expect(text).toContain('Restricted Person');
    expect(text).toContain('Blocked in Brevo');
    expect(text).toContain('cannot be automatically re-enabled');
    const recipientsTable = harness.routeNativeElement?.querySelector('.campaign-recipient-table');
    const excludedTable = harness.routeNativeElement?.querySelector('table[aria-label="Excluded Campaign recipients"]');
    expect(recipientsTable?.classList.contains('campaign-recipient-table')).toBe(true);
    expect(excludedTable?.classList.contains('campaign-recipient-table')).toBe(true);
    expect(recipientsTable?.textContent).toContain('Restricted Person');
    expect(recipientsTable?.textContent).toContain('restricted@example.com');
    expect(recipientsTable?.textContent).toContain('Ready Person');
    expect(recipientsTable?.textContent).not.toContain('Excluded Person');
    expect(recipientsTable?.textContent).not.toContain('RECONCILIATION_REQUIRED');
    expect(recipientsTable?.querySelectorAll('th[scope="col"]').length).toBe(2);
    expect(excludedTable?.textContent).toContain('Excluded Person');
    expect(excludedTable?.textContent).toContain('Opted out');
    expect(excludedTable?.textContent).not.toContain('excluded@example.com');
    expect(harness.routeNativeElement?.querySelector('summary')?.textContent).toContain('Excluded from this Campaign (1)');
    expect(harness.routeNativeElement?.querySelector('.attention-card')?.textContent).not.toContain('Ready Person');
    expect(text).not.toContain('BREVO_CONTACT_RESTRICTED');
    expect(text).toContain('Excluded Person');
    const attentionCard = harness.routeNativeElement?.querySelector('.attention-card');
    const snapshotCard = harness.routeNativeElement?.querySelector('table[aria-label="Campaign recipients"]')?.closest('section');
    expect(attentionCard).not.toBeNull();
    expect(harness.routeNativeElement?.querySelectorAll('.attention-card').length).toBe(1);
    expect(attentionCard?.querySelector('h2')?.textContent).toBe('Needs attention');
    expect(snapshotCard).not.toBeNull();
    expect(attentionCard!.compareDocumentPosition(snapshotCard!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers Review person navigation with the campaign return context', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'viewer@example.com', person: { id: 1, first_name: 'View', last_name: 'Only', primary_email: 'viewer@example.com' }, staff_roles: ['CRM_VIEWER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 1, next: null, previous: null, results: [
      { id: 1, person: 11, first_name_snapshot: 'Restricted', last_name_snapshot: 'Person', consent_state_snapshot: 'OPTED_IN', decision: 'INCLUDED', exclusion_reason: null, captured_at: '', provider_outcome: 'RECONCILIATION_REQUIRED', provider_error_code: 'BREVO_CONTACT_RESTRICTED' },
    ] });
    await harness.fixture.whenStable();
    const link = harness.routeNativeElement?.querySelector<HTMLAnchorElement>('a[href*="/people/11"]');
    expect(link?.getAttribute('href')).toContain('/people/11');
    expect(link?.getAttribute('href')).toContain('campaign=4');
    expect(link?.textContent).toContain('Review person');
  });

  it('retrieves subsequent recipient pages with the bounded page size', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'viewer@example.com', person: { id: 1, first_name: 'View', last_name: 'Only', primary_email: 'viewer@example.com' }, staff_roles: ['CRM_VIEWER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 101, next: `${base}/marketing/campaigns/4/recipients/?page=2&page_size=100`, previous: null, results: [{ id: 1, person: 1, first_name_snapshot: 'First', last_name_snapshot: 'Page', consent_state_snapshot: 'OPTED_IN', decision: 'INCLUDED', exclusion_reason: null, captured_at: '', provider_outcome: 'ADDED_TO_CAMPAIGN_LIST', provider_error_code: null }] });
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=2&page_size=100`).flush({ count: 101, next: null, previous: `${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`, results: [{ id: 2, person: 2, first_name_snapshot: 'Second', last_name_snapshot: 'Page', consent_state_snapshot: 'INCLUDED', decision: 'INCLUDED', exclusion_reason: null, captured_at: '', provider_outcome: 'RECONCILIATION_REQUIRED', provider_error_code: 'UNKNOWN_CODE' }] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Second Page');
  });

  it('lets managers deliberately retry reconciliation with the safe confirmation text', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'manager@example.com', person: { id: 1, first_name: 'Campaign', last_name: 'Manager', primary_email: 'manager@example.com' }, staff_roles: ['CRM_MANAGER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const retry = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find((button) => button.textContent?.includes('Retry Brevo preparation')) as HTMLButtonElement;
    expect(retry).toBeTruthy();
    retry.click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('completed preparation work');
    expect(harness.routeNativeElement?.textContent).toContain('will not be automatically cleared');
  });

  it('keeps lifecycle actions in a compact secondary header group', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'manager@example.com', person: { id: 1, first_name: 'Campaign', last_name: 'Manager', primary_email: 'manager@example.com' }, staff_roles: ['CRM_MANAGER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('DRAFT'));
    await harness.fixture.whenStable();
    const group = harness.routeNativeElement?.querySelector('.lifecycle-actions');
    expect(group?.textContent).toContain('Archive campaign');
    expect(group?.textContent).toContain('Delete draft');
    expect(harness.routeNativeElement?.querySelector('.draft-workflow-panel button.crm-button--primary')).not.toBeNull();
  });

  it('presents the saved snapshot with staff-readable copy and accessible table headers', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('SNAPSHOT_READY', 'SNAPSHOT_READY'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 1, next: null, previous: null, results: [{ id: 1, person: 11, email_snapshot: 'saved@example.com', first_name_snapshot: 'Saved', last_name_snapshot: 'Person', consent_state_snapshot: 'OPTED_IN', decision: 'INCLUDED', exclusion_reason: null, captured_at: '', provider_outcome: 'ADDED_TO_CAMPAIGN_LIST', provider_error_code: null }] });
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement!;
    expect(element.textContent).toContain('Recipients included in the saved Campaign preparation.');
    expect(element.querySelector('table[aria-label="Campaign recipients"]')).not.toBeNull();
    expect(element.querySelector('table[aria-label="Campaign recipients"] caption')).toBeNull();
    expect(element.querySelector('table[aria-label="Excluded Campaign recipients"] caption')).toBeNull();
    expect(element.querySelector('.campaign-recipient-table')?.textContent).toContain('saved@example.com');
    expect(element.querySelectorAll('.campaign-recipient-table th[scope="col"]').length).toBe(2);
    expect(element.querySelector('.campaign-recipient-table')?.textContent).not.toContain('Decision');
  });

  it('clearly presents active recipient preparation and no-ready guidance', async () => {
    const preparingHarness = await RouterTestingHarness.create();
    await preparingHarness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('PREPARING', 'PREPARING'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
    await preparingHarness.fixture.whenStable();
    expect(preparingHarness.routeNativeElement?.textContent).toContain('Preparing recipients');
    expect(preparingHarness.routeNativeElement?.textContent).toContain('saved recipient snapshot is being created');

  });

  it('gives no-ready campaigns actionable audience and consent guidance', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('NO_READY_RECIPIENTS', 'NO_READY_RECIPIENTS'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Review the audience criteria and current consent status');
  });

  it('archives with reversible confirmation, preserves workflow status, and prevents duplicate submits', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'manager@example.com', person: { id: 1, first_name: 'Campaign', last_name: 'Manager', primary_email: 'manager@example.com' }, staff_roles: ['CRM_MANAGER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('DRAFT'));
    await harness.fixture.whenStable();
    const archive = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(button => button.textContent?.includes('Archive campaign')) as HTMLButtonElement;
    archive.click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('leave the Active Campaigns view');
    const confirm = harness.routeNativeElement?.querySelector<HTMLButtonElement>('app-confirmation-dialog .crm-button--primary')!;
    confirm.click();
    confirm.click();
    const request = http.expectOne(`${base}/marketing/campaigns/4/archive/`);
    request.flush(campaign('DRAFT', null, { archived_at: '2026-01-01T00:00:00Z', archived_by: 1, is_archived: true, can_archive: false, can_restore: true, can_delete: true }));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Archived campaign');
    expect(harness.routeNativeElement?.textContent).toContain('Draft');
    expect(harness.routeNativeElement?.textContent).toContain('Campaign archived');
  });

  it('restores an archived campaign without changing workflow status', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'admin@example.com', person: { id: 1, first_name: 'Campaign', last_name: 'Admin', primary_email: 'admin@example.com' }, staff_roles: ['CRM_ADMIN'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4?lifecycle=archived');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('PREPARED', 'PREPARED', { archived_at: '2026-01-01T00:00:00Z', archived_by: 1, is_archived: true, can_archive: false, can_restore: true, can_delete: false }));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    const restore = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(button => button.textContent?.includes('Restore campaign')) as HTMLButtonElement;
    restore.click();
    harness.detectChanges();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('app-confirmation-dialog .crm-button--primary')?.click();
    const request = http.expectOne(`${base}/marketing/campaigns/4/restore/`);
    request.flush(campaign('PREPARED', 'PREPARED', { archived_at: null, archived_by: null, is_archived: false, can_archive: true, can_restore: false, can_delete: false }));
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Ready in Brevo');
    expect(harness.routeNativeElement?.textContent).toContain('Campaign restored');
    expect(harness.routeNativeElement?.textContent).not.toContain('Archived campaign');
  });

  it('shows destructive delete confirmation and navigates to Campaigns after success', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'admin@example.com', person: { id: 1, first_name: 'Campaign', last_name: 'Admin', primary_email: 'admin@example.com' }, staff_roles: ['CRM_ADMIN'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('DRAFT'));
    await harness.fixture.whenStable();
    (Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(button => button.textContent?.includes('Delete draft')) as HTMLButtonElement).click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('cannot be undone');
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('app-confirmation-dialog .crm-button--primary')?.click();
    const request = http.expectOne(`${base}/marketing/campaigns/4/`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/marketing/campaigns?lifecycle=active');
  });

  it('keeps archived historical information visible while hiding workflow mutations', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'viewer@example.com', person: { id: 1, first_name: 'View', last_name: 'Only', primary_email: 'viewer@example.com' }, staff_roles: ['CRM_VIEWER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED', { archived_at: '2026-01-01T00:00:00Z', archived_by: 1, is_archived: true, can_archive: false, can_restore: false, can_delete: false }));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 1, next: null, previous: null, results: [{ id: 1, person: 11, first_name_snapshot: 'Historical', last_name_snapshot: 'Person', consent_state_snapshot: 'OPTED_IN', decision: 'INCLUDED', exclusion_reason: null, captured_at: '', provider_outcome: 'RECONCILIATION_REQUIRED', provider_error_code: 'BREVO_CONTACT_RESTRICTED' }] });
    await harness.fixture.whenStable();
    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Archived campaign');
    expect(text).toContain('Needs attention');
    expect(text).toContain('Historical Person');
    expect(text).not.toContain('Prepare recipients');
    expect(text).not.toContain('Prepare in Brevo');
    expect(text).not.toContain('Retry Brevo preparation');
  });

  it('refreshes campaign and recipients after a reconciliation retry remains unresolved', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({ id: 1, email: 'manager@example.com', person: { id: 1, first_name: 'Campaign', last_name: 'Manager', primary_email: 'manager@example.com' }, staff_roles: ['CRM_MANAGER'] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/campaigns/4');
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(button => button.textContent?.includes('Retry Brevo preparation'))?.dispatchEvent(new Event('click'));
    harness.detectChanges();
    harness.routeNativeElement?.querySelector<HTMLButtonElement>('app-confirmation-dialog .crm-button--primary')?.click();
    const request = http.expectOne(`${base}/marketing/campaigns/4/prepare-provider/`);
    request.flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED'));
    http.expectOne(`${base}/marketing/campaigns/4/`).flush(campaign('RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED'));
    http.expectOne(`${base}/marketing/campaigns/4/recipients/?page=1&page_size=100`).flush({ count: 0, next: null, previous: null, results: [] });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Needs attention');
    expect(harness.routeNativeElement?.textContent).not.toContain('Recipients needing attention');
    const attention = harness.routeNativeElement?.querySelector('.attention-card');
    const retry = harness.routeNativeElement?.querySelector('.retry-card');
    expect(attention && retry && (attention.compareDocumentPosition(retry) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  });
});
