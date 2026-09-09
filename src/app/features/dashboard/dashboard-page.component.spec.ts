import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, beforeEach, afterEach, expect, it } from 'vitest';
import { API_CONFIG } from '../../core/http/api-config';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardProjection } from '../../core/dashboard/dashboard.types';
import { DashboardPageComponent } from './dashboard-page.component';

const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const data: DashboardProjection = {
  overview: { total_people: 12, active_members: 8, contacts: 3, former_members: 1 },
  growth: { people_by_month: months.map(month => ({ month, count: 0 })), members_by_month: months.map(month => ({ month, count: 0 })) },
  community_profile: { top_locations: [], top_industries: [], age_ranges: [{ value: 'UNDER_25', label: 'Under 25', count: 0 }] },
  attention: { imports_needing_review: 2, archived_people: 4 },
};

describe('DashboardPageComponent', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DashboardPageComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: API_CONFIG, useValue: { apiBaseUrl: '/api/v1' } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function create(role = 'CRM_ADMIN') {
    TestBed.inject(AuthService).setCurrentUserForTest({ id: 1, email: 'staff@example.com', person: { id: 1, first_name: 'Staff', last_name: 'User', primary_email: null }, staff_roles: [role] });
    const fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    return fixture;
  }
  function respond() {
    const request = http.expectOne('/api/v1/dashboard/');
    expect(request.request.method).toBe('GET');
    request.flush(data);
  }
  it('shows loading without fake metrics, then renders the typed response and future Events state', () => {
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Loading Dashboard');
    expect(fixture.nativeElement.querySelector('.metric')).toBeNull();
    respond(); fixture.detectChanges();
    expect(Array.from(fixture.nativeElement.querySelectorAll('.metric strong')).map(node => (node as HTMLElement).textContent)).toEqual(['12', '8', '3', '1']);
    expect(fixture.nativeElement.textContent).toContain('Coming soon');
    expect(fixture.nativeElement.textContent).toContain('No location data yet.');
    expect(fixture.nativeElement.textContent).toContain('No industry data yet.');
    expect(fixture.nativeElement.textContent).toContain('Under 25');
    expect(fixture.nativeElement.querySelectorAll('app-community-growth tbody tr').length).toBe(6);
    expect(fixture.nativeElement.querySelector('svg').innerHTML).not.toContain('NaN');
  });
  it('uses canonical deep links and only the normal Imports destination', () => {
    const fixture = create(); respond(); fixture.detectChanges();
    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('.metric')).map(node => (node as HTMLAnchorElement).getAttribute('href'));
    expect(hrefs).toEqual(['/people', '/people?relationship=ACTIVE_MEMBER', '/people?relationship=CONTACT', '/people?relationship=FORMER_MEMBER']);
    const attention = Array.from(fixture.nativeElement.querySelectorAll('a.attention')).map(node => (node as HTMLAnchorElement).getAttribute('href'));
    expect(attention).toEqual(['/imports', '/people?record_state=archived']);
  });
  it('shows errors with Retry instead of zeros and requests fresh data on retry', () => {
    const fixture = create();
    http.expectOne('/api/v1/dashboard/').flush({}, { status: 500, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Dashboard unavailable');
    expect(fixture.nativeElement.querySelector('.metric')).toBeNull();
    fixture.nativeElement.querySelector('app-state-message button').click();
    respond(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.metric').length).toBe(4);
  });
  for (const role of ['CRM_ADMIN', 'CRM_MANAGER', 'CRM_VIEWER']) {
    it(`respects ${role} capabilities`, () => {
      const fixture = create(role); respond(); fixture.detectChanges();
      const actions = fixture.nativeElement.querySelector('.quick-actions').textContent;
      expect(actions.includes('Add person')).toBe(role !== 'CRM_VIEWER');
      expect(actions.includes('Upload historical records')).toBe(role === 'CRM_ADMIN');
      expect(actions).toContain('View People');
      expect(fixture.nativeElement.querySelector('a.attention[href="/imports"]') !== null).toBe(role === 'CRM_ADMIN');
    });
  }
  it('renders legitimate zero overview values and preserves backend profile order', () => {
    const fixture = create();
    http.expectOne('/api/v1/dashboard/').flush({ ...data, overview: { total_people: 0, active_members: 0, contacts: 0, former_members: 0 }, community_profile: { ...data.community_profile, top_locations: [{ label: 'Zulu', count: 2 }, { label: 'Alpha', count: 1 }] } });
    fixture.detectChanges();
    expect(Array.from(fixture.nativeElement.querySelectorAll('.metric strong')).every(node => (node as HTMLElement).textContent === '0')).toBe(true);
    const locations = fixture.nativeElement.querySelector('.profile').textContent as string;
    expect(locations.indexOf('Zulu')).toBeLessThan(locations.indexOf('Alpha'));
  });
});
