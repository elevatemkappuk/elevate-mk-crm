import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
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
    const columns = ['Name', 'Email', 'Mobile', 'Job title', 'Type', 'Location', 'Status'];
    expect(Array.from(host.querySelectorAll('th'), th => th.textContent?.trim())).toEqual(columns);
    expect(Array.from(host.querySelectorAll('tbody td'), td => td.getAttribute('data-label'))).toEqual(columns);
    expect(host.querySelector('[data-label="Job title"]')?.textContent?.trim()).toBe('Programme Manager');
    expect(host.querySelector('[data-label="Actions"]')).toBeNull();
    expect(host.querySelector('.row-link')?.getAttribute('href')).toBe('/people/11');
    expect(host.querySelectorAll('tbody a')).toHaveLength(1);
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
    expect(Array.from(host.querySelectorAll('[data-label="Type"] [data-tone]'), badge => badge.getAttribute('data-tone')))
      .toEqual(['info', 'warning', 'neutral', 'neutral']);
    expect(Array.from(host.querySelectorAll('[data-label="Status"] [data-tone]'), badge => badge.getAttribute('data-tone')))
      .toEqual(['muted', 'success', 'success', 'muted']);
  });

  it.each(['CRM_ADMIN', 'CRM_MANAGER', 'CRM_VIEWER'] as const)('shows linked rows to %s without granting write actions', async role => {
    currentUser.update(user => ({ ...user!, staff_roles: [role] }));
    const host = await render([basePerson]);
    expect(host.querySelector('[data-label="Type"]')?.textContent?.trim()).toBe('Member');
    expect(host.querySelector('.row-link')?.getAttribute('href')).toBe('/people/11');
    expect(!!host.querySelector('.page-actions')).toBe(role !== 'CRM_VIEWER');
    expect(host.querySelector('.page-actions a')).toBeNull();
    if (role !== 'CRM_VIEWER') {
      expect(host.querySelector('.controls .page-actions button')?.textContent?.trim()).toBe('Add person');
    }
    expect(host.querySelector('tbody button')).toBeNull();
  });

  it('navigates from a non-interactive row cell', async () => {
    const host = await render([basePerson]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    (host.querySelector('[data-label="Job title"]') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/people', 11]);
  });

  it.each(['Enter', ' '])('activates the native name link with %s without adding a row tab stop', async key => {
    const host = await render([basePerson]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const link = host.querySelector('.row-link') as HTMLAnchorElement;
    expect(link.tabIndex).toBe(0);
    expect(host.querySelector('tbody tr')?.hasAttribute('tabindex')).toBe(false);
    expect(host.querySelector('tbody tr')?.getAttribute('role')).toBeNull();
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/people', 11]);
    link.dispatchEvent(new KeyboardEvent('keydown', { key, repeat: true, bubbles: true, cancelable: true }));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('leaves child controls, stopped clicks, and modified links to their own handlers', async () => {
    const host = await render([basePerson]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const cell = host.querySelector('[data-label="Job title"]') as HTMLElement;
    const button = document.createElement('button');
    cell.append(button);
    button.click();
    const ownAction = document.createElement('span');
    ownAction.addEventListener('click', event => event.stopPropagation());
    cell.append(ownAction);
    ownAction.click();
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    const modifiedEnter = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true });
    host.querySelector('.row-link')!.dispatchEvent(modifiedEnter);
    expect(modifiedEnter.defaultPrevented).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
