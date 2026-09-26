import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';

import { apiCredentialsInterceptor, csrfHeaderInterceptor } from '../../core/http/auth-http.interceptors';
import { API_CONFIG } from '../../core/http/api-config';
import { AudiencePreviewPageComponent } from './audience-preview-page.component';
import { AuthService } from '../../core/auth/auth.service';
import { Component } from '@angular/core';

@Component({ standalone: true, template: '' })
class CampaignDestinationComponent {}

const apiBaseUrl = 'http://localhost:8000/api/v1';

describe('AudiencePreviewPageComponent', () => {
  let httpTesting: HttpTestingController;
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.open = true; }) });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'marketing/audience-preview', component: AudiencePreviewPageComponent },
          { path: 'marketing/campaigns/:id', component: CampaignDestinationComponent },
        ]),
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  afterAll(() => {
    for (const [key, descriptor] of [['showModal', showModal], ['close', close]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
    }
  });

  function flushCatalogRequests(): void {
    for (const path of ['industries', 'interests', 'skills', 'tags']) {
      httpTesting.match(`${apiBaseUrl}/${path}/`).forEach((request) => request.flush([]));
    }
  }

  function response(result: 'all' | 'eligible' | 'excluded' = 'all') {
    return {
      selection: { q: '', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [], record_state: 'active' },
      selected_count: 2,
      eligible_count: 1,
      excluded_count: 1,
      exclusion_counts: { EXCLUDED_OPTED_OUT: 1, EXCLUDED_CONSENT_UNKNOWN: 0, EXCLUDED_NO_EMAIL: 0 },
      results: {
        count: result === 'all' ? 2 : 1,
        page: 1,
        page_size: 25,
        next_page: null,
        previous_page: null,
        next: null,
        previous: null,
        results: result === 'eligible'
          ? [{ id: 1, first_name: 'Eligible', last_name: 'Person', primary_email: 'eligible@example.com', classification: 'ELIGIBLE', exclusion_reasons: [] }]
          : result === 'excluded'
            ? [{ id: 2, first_name: 'Opted', last_name: 'Out', primary_email: 'out@example.com', classification: 'EXCLUDED_OPTED_OUT', exclusion_reasons: ['EXCLUDED_OPTED_OUT'] }]
            : [
              { id: 1, first_name: 'Eligible', last_name: 'Person', primary_email: 'eligible@example.com', classification: 'ELIGIBLE', exclusion_reasons: [] },
              { id: 2, first_name: 'Opted', last_name: 'Out', primary_email: 'out@example.com', classification: 'EXCLUDED_OPTED_OUT', exclusion_reasons: ['EXCLUDED_OPTED_OUT'] },
            ],
      },
    };
  }

  it('loads URL-backed criteria, renders backend counts and explains excluded rows', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/audience-preview?q=mentor&relationship=ACTIVE_MEMBER');
    flushCatalogRequests();
    const request = httpTesting.expectOne(`${apiBaseUrl}/marketing/audiences/preview/`);
    expect(request.request.body.selection).toEqual({
      q: 'mentor', relationship: ['ACTIVE_MEMBER'], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [],
    });
    request.flush(response());
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Selected');
    expect(harness.routeNativeElement?.textContent).toContain('Eligible');
    expect(harness.routeNativeElement?.textContent).toContain('Excluded');
    expect(harness.routeNativeElement?.textContent).toContain('Search: mentor');
    expect(harness.routeNativeElement?.textContent).toContain('1 of 2 selected People can currently receive marketing email.');
    expect(harness.routeNativeElement?.textContent).toContain('Eligible recipients (1)');
    expect(harness.routeNativeElement?.textContent).not.toContain('Sync to Brevo');
    expect(harness.routeNativeElement?.textContent).not.toContain('Create campaign');
    expect(harness.routeNativeElement?.textContent).toContain('Opted out');
    expect(harness.routeNativeElement?.textContent).toContain('This person has opted out of email marketing.');
    expect(harness.routeNativeElement?.querySelector('a[href="/people/1"]')).not.toBeNull();
  });

  it('makes an empty criteria set explicit as all active People', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/audience-preview');
    flushCatalogRequests();
    httpTesting.expectOne(`${apiBaseUrl}/marketing/audiences/preview/`).flush(response());
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('All active People');
  });

  it('requests the selected backend result view rather than filtering rows locally', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/audience-preview');
    flushCatalogRequests();
    httpTesting.expectOne(`${apiBaseUrl}/marketing/audiences/preview/`).flush(response());
    await harness.fixture.whenStable();
    harness.detectChanges();

    const excludedTab = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.trim() === 'Exclusions (1)') as HTMLButtonElement;
    excludedTab.click();
    await harness.fixture.whenStable();
    const request = httpTesting.expectOne(`${apiBaseUrl}/marketing/audiences/preview/`);
    expect(request.request.body.result).toBe('excluded');
    expect(request.request.body.page).toBe(1);
    request.flush(response('excluded'));
  });

  it('opens the reusable filter drawer from the compact criteria summary', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/audience-preview');
    flushCatalogRequests();
    httpTesting.expectOne(`${apiBaseUrl}/marketing/audiences/preview/`).flush(response());
    await harness.fixture.whenStable();
    harness.detectChanges();

    const editButton = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.trim() === 'Edit criteria') as HTMLButtonElement;
    editButton.click();
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Audience criteria');
    expect(harness.routeNativeElement?.textContent).toContain('Search People');
  });

  it('shows Continue to Campaign only to managers/admins and posts normalized criteria', async () => {
    TestBed.inject(AuthService).setAuthenticatedUser({
      id: 1,
      email: 'manager@example.com',
      person: { id: 1, first_name: 'Campaign', last_name: 'Manager', primary_email: 'manager@example.com' },
      staff_roles: ['CRM_MANAGER'],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/marketing/audience-preview?q=mentor');
    flushCatalogRequests();
    httpTesting.expectOne(`${apiBaseUrl}/marketing/audiences/preview/`).flush(response());
    await harness.fixture.whenStable();
    harness.detectChanges();

    const continueButton = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.trim() === 'Continue to Campaign') as HTMLButtonElement;
    expect(continueButton).not.toBeNull();
    continueButton.click();
    harness.detectChanges();
    const name = harness.routeNativeElement?.querySelector<HTMLInputElement>('#campaign-name');
    expect(name).not.toBeNull();
    name!.value = 'Mentor Campaign';
    name!.dispatchEvent(new Event('input'));
    harness.detectChanges();
    (harness.routeNativeElement?.querySelector('form button[type="submit"]') as HTMLButtonElement).click();
    const request = httpTesting.expectOne(`${apiBaseUrl}/marketing/campaigns/`);
    expect(request.request.body).toEqual({
      name: 'Mentor Campaign',
      audience_selection: { q: 'mentor', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] },
      audience_ordering: 'last_name',
    });
    request.flush({ id: 8 });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/marketing/campaigns/8');
  });
});
