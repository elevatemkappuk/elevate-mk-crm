import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../core/auth/auth.service';
import { AuthenticatedUser } from '../../core/auth/auth.types';
import { API_CONFIG } from '../../core/http/api-config';
import { PersonDirectoryItem } from '../../core/people/people.types';
import { PeoplePageComponent } from './people-page.component';

const basePerson: PersonDirectoryItem = {
  id: 11, first_name: 'Amina', last_name: 'Zulu', primary_email: 'amina@example.com',
  mobile: '991000001', location: 'Lilongwe', age_range: '', gender: '', archived_at: null,
  created_at: '2026-08-29T12:00:00Z', updated_at: '2026-08-29T12:00:00Z',
  job_title: 'Programme Manager', relationship: 'ACTIVE_MEMBER',
};

describe('People directory projected columns', () => {
  const currentUser = signal<AuthenticatedUser | null>(null);
  let http: HttpTestingController;

  beforeEach(async () => {
    currentUser.set({ id: 1, email: 'staff@example.com',
      person: { id: 1, first_name: 'Staff', last_name: 'Reader', primary_email: 'staff@example.com' },
      staff_roles: ['CRM_MANAGER'] });
    await TestBed.configureTestingModule({
      imports: [PeoplePageComponent],
      providers: [provideRouter([{ path: 'people', component: PeoplePageComponent }]),
        provideHttpClient(), provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
        { provide: AuthService, useValue: { currentUser } }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function render(rows: PersonDirectoryItem[]): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create('/people?record_state=all');
    for (const catalog of ['industries', 'skills', 'interests', 'tags']) {
      http.expectOne(`/api/v1/${catalog}/`).flush([]);
    }
    const request = http.expectOne(req => req.url === '/api/v1/people/');
    expect(request.request.params.get('record_state')).toBe('all');
    request.flush({ count: rows.length, next: null, previous: null, results: rows });
    harness.detectChanges();
    return harness.routeNativeElement!;
  }

  it('renders the requested column order and labels every cell for stacked rows', async () => {
    const host = await render([basePerson]);
    const columns = ['Name', 'Email', 'Mobile', 'Job title', 'Type', 'Location', 'Status', 'Actions'];
    expect(Array.from(host.querySelectorAll('th'), th => th.textContent?.trim())).toEqual(columns);
    expect(Array.from(host.querySelectorAll('tbody td'), td => td.getAttribute('data-label'))).toEqual(columns);
    expect(host.querySelector('[data-label="Job title"]')?.textContent?.trim()).toBe('Programme Manager');
    expect(host.querySelector('[data-label="Actions"] a')?.getAttribute('href')).toBe('/people/11');
    expect(host.querySelector('[data-label="Actions"] a')?.getAttribute('aria-label')).toBe('View Amina Zulu');
  });

  it('maps authoritative types independently of archive status and handles missing job titles', async () => {
    const host = await render([
      { ...basePerson, archived_at: '2026-09-01T00:00:00Z' },
      { ...basePerson, id: 12, job_title: null, relationship: 'FORMER_MEMBER' },
      { ...basePerson, id: 13, job_title: '', relationship: 'CONTACT' },
      { ...basePerson, id: 14, job_title: '   ', relationship: 'CONTACT', archived_at: '2026-09-01T00:00:00Z' },
    ]);
    expect(Array.from(host.querySelectorAll('[data-label="Type"]'), td => td.textContent?.trim()))
      .toEqual(['Member', 'Former member', 'Contact', 'Contact']);
    expect(Array.from(host.querySelectorAll('[data-label="Job title"]'), td => td.textContent?.trim()))
      .toEqual(['Programme Manager', '-', '-', '-']);
    expect(Array.from(host.querySelectorAll('[data-label="Status"]'), td => td.textContent?.trim()))
      .toEqual(['Archived', 'Active', 'Active', 'Archived']);
  });

  it.each(['CRM_ADMIN', 'CRM_MANAGER', 'CRM_VIEWER'] as const)('shows projected values and View to %s without granting write actions', async role => {
    currentUser.update(user => ({ ...user!, staff_roles: [role] }));
    const host = await render([basePerson]);
    expect(host.querySelector('[data-label="Type"]')?.textContent?.trim()).toBe('Member');
    expect(host.querySelector('[data-label="Actions"] a')?.textContent).toBe('View');
    expect(!!host.querySelector('.page-actions')).toBe(role !== 'CRM_VIEWER');
    expect(host.querySelector('[data-label="Actions"] button')).toBeNull();
  });
});
