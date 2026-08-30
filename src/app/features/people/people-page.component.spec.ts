import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../core/auth/auth.service';
import { AuthenticatedUser } from '../../core/auth/auth.types';
import { apiCredentialsInterceptor, csrfHeaderInterceptor } from '../../core/http/auth-http.interceptors';
import { API_CONFIG } from '../../core/http/api-config';
import { PersonDetailPageComponent } from './person-detail-page.component';
import { PeoplePageComponent } from './people-page.component';

const apiBaseUrl = 'http://localhost:8000/api/v1';

const managerUser: AuthenticatedUser = {
  id: 2,
  email: 'manager@example.com',
  person: {
    id: 6,
    first_name: 'Morgan',
    last_name: 'Manager',
    primary_email: 'manager@example.com',
  },
  staff_roles: ['CRM_MANAGER'],
};

const firstPerson = {
  id: 11,
  first_name: 'Amina',
  last_name: 'Zulu',
  primary_email: 'amina@example.com',
  mobile: '991000001',
  location: 'Lilongwe',
  age_range: '',
  gender: '',
  archived_at: null,
  created_at: '2026-08-29T12:00:00Z',
  updated_at: '2026-08-29T12:00:00Z',
};

const secondPerson = {
  id: 12,
  first_name: 'Brian',
  last_name: 'Archive',
  primary_email: null,
  mobile: '',
  location: '',
  age_range: '',
  gender: '',
  archived_at: '2026-08-28T08:00:00Z',
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-28T08:00:00Z',
};

class MockAuthService {
  readonly authInitialized = signal(true).asReadonly();
  readonly currentUser = signal<AuthenticatedUser | null>(managerUser).asReadonly();
}

@Component({
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
class DummyShellComponent {}

describe('PeoplePageComponent', () => {
  let httpTesting: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: DummyShellComponent,
            children: [
              { path: 'people', component: PeoplePageComponent },
              { path: 'people/:id', component: PersonDetailPageComponent },
            ],
          },
        ]),
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
        { provide: AuthService, useClass: MockAuthService },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    httpTesting.verify();
  });

  function expectPeopleRequest(expected: {
    q: string;
    record_state: string;
    ordering: string;
    page: string;
    page_size: string;
  }) {
    return httpTesting.expectOne((request) => {
      return (
        request.url === `${apiBaseUrl}/people/` &&
        request.params.get('q') === expected.q &&
        request.params.get('record_state') === expected.record_state &&
        request.params.get('ordering') === expected.ordering &&
        request.params.get('page') === expected.page &&
        request.params.get('page_size') === expected.page_size
      );
    });
  }

  async function stabilize(harness: RouterTestingHarness) {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('loads API data and renders returned person fields', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people');

    const request = expectPeopleRequest({
      q: '',
      record_state: 'active',
      ordering: 'last_name',
      page: '1',
      page_size: '25',
    });
    request.flush({
      count: 1,
      next: null,
      previous: null,
      results: [firstPerson],
    });

    harness.detectChanges();
    const text = harness.routeNativeElement?.textContent ?? '';

    expect(text).toContain('Amina Zulu');
    expect(text).toContain('amina@example.com');
    expect(text).toContain('991000001');
    expect(text).toContain('Lilongwe');
  });

  it('search sends q to the backend and resets page to 1', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people?page=3');

    expectPeopleRequest({
      q: '',
      record_state: 'active',
      ordering: 'last_name',
      page: '3',
      page_size: '25',
    }).flush({
      count: 1,
      next: null,
      previous: 'prev',
      results: [firstPerson],
    });

    harness.detectChanges();
    const input = harness.routeNativeElement?.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'ama';
    input.dispatchEvent(new Event('input'));
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    await stabilize(harness);

    expect(router.url).toBe('/people?q=ama');

    expectPeopleRequest({
      q: 'ama',
      record_state: 'active',
      ordering: 'last_name',
      page: '1',
      page_size: '25',
    }).flush({
      count: 1,
      next: null,
      previous: null,
      results: [firstPerson],
    });
  });

  it('restores search and filters from the URL', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people?q=ama&record_state=archived&ordering=-updated_at&page=2&page_size=50');

    const request = expectPeopleRequest({
      q: 'ama',
      record_state: 'archived',
      ordering: '-updated_at',
      page: '2',
      page_size: '50',
    });
    request.flush({
      count: 51,
      next: 'next',
      previous: 'prev',
      results: [secondPerson],
    });

    harness.detectChanges();
    const host = harness.routeNativeElement as HTMLElement;

    expect((host.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('ama');
    expect((host.querySelector('select[formcontrolname="record_state"]') as HTMLSelectElement).value).toBe(
      'archived',
    );
    expect((host.querySelector('select[formcontrolname="ordering"]') as HTMLSelectElement).value).toBe(
      '-updated_at',
    );
    expect((host.querySelector('select[formcontrolname="page_size"]') as HTMLSelectElement).value).toBe(
      '50',
    );
    expect(host.textContent).toContain('Page 2 of 2');
  });

  it('record state and ordering changes update the URL and backend query', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people');

    expectPeopleRequest({
      q: '',
      record_state: 'active',
      ordering: 'last_name',
      page: '1',
      page_size: '25',
    }).flush({
      count: 1,
      next: null,
      previous: null,
      results: [firstPerson],
    });

    harness.detectChanges();
    const host = harness.routeNativeElement as HTMLElement;
    const recordState = host.querySelector('select[formcontrolname="record_state"]') as HTMLSelectElement;
    recordState.value = 'all';
    recordState.dispatchEvent(new Event('change'));
    await stabilize(harness);

    expect(router.url).toBe('/people?record_state=all');

    expectPeopleRequest({
      q: '',
      record_state: 'all',
      ordering: 'last_name',
      page: '1',
      page_size: '25',
    }).flush({
      count: 2,
      next: null,
      previous: null,
      results: [firstPerson, secondPerson],
    });

    const ordering = host.querySelector('select[formcontrolname="ordering"]') as HTMLSelectElement;
    ordering.value = '-updated_at';
    ordering.dispatchEvent(new Event('change'));
    await stabilize(harness);

    expect(router.url).toBe('/people?record_state=all&ordering=-updated_at');

    expectPeopleRequest({
      q: '',
      record_state: 'all',
      ordering: '-updated_at',
      page: '1',
      page_size: '25',
    }).flush({
      count: 2,
      next: null,
      previous: null,
      results: [secondPerson, firstPerson],
    });
  });

  it('page size and pagination navigation update the URL and reload data', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people');

    expectPeopleRequest({
      q: '',
      record_state: 'active',
      ordering: 'last_name',
      page: '1',
      page_size: '25',
    }).flush({
      count: 30,
      next: 'next',
      previous: null,
      results: [firstPerson],
    });

    harness.detectChanges();
    let host = harness.routeNativeElement as HTMLElement;
    const pageSize = host.querySelector('select[formcontrolname="page_size"]') as HTMLSelectElement;
    pageSize.value = '50';
    pageSize.dispatchEvent(new Event('change'));
    await stabilize(harness);

    expect(router.url).toBe('/people?page_size=50');

    expectPeopleRequest({
      q: '',
      record_state: 'active',
      ordering: 'last_name',
      page: '1',
      page_size: '50',
    }).flush({
      count: 60,
      next: 'next',
      previous: null,
      results: [firstPerson],
    });

    await stabilize(harness);
    host = harness.routeNativeElement as HTMLElement;

    const nextButton = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Next',
    ) as HTMLButtonElement;
    nextButton.click();
    await stabilize(harness);

    expect(router.url).toBe('/people?page=2&page_size=50');

    expectPeopleRequest({
      q: '',
      record_state: 'active',
      ordering: 'last_name',
      page: '2',
      page_size: '50',
    }).flush({
      count: 60,
      next: null,
      previous: 'prev',
      results: [secondPerson],
    });
  });

  it('shows a neutral empty state', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people?q=missing');

    expectPeopleRequest({
      q: 'missing',
      record_state: 'active',
      ordering: 'last_name',
      page: '1',
      page_size: '25',
    }).flush({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });

    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No people matched the current search.');
  });

  it('shows an inline API error state', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people');

    expectPeopleRequest({
      q: '',
      record_state: 'active',
      ordering: 'last_name',
      page: '1',
      page_size: '25',
    }).flush({}, { status: 500, statusText: 'Server Error' });

    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('People could not be loaded right now.');
  });

  it('routes row links to the person detail page', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people');

    expectPeopleRequest({
      q: '',
      record_state: 'active',
      ordering: 'last_name',
      page: '1',
      page_size: '25',
    }).flush({
      count: 1,
      next: null,
      previous: null,
      results: [firstPerson],
    });

    harness.detectChanges();
    const link = harness.routeNativeElement?.querySelector('.row-link') as HTMLAnchorElement;
    link.click();
    await Promise.resolve();

    await harness.navigateByUrl(link.getAttribute('href') ?? '/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/`).flush(firstPerson);
    await stabilize(harness);

    expect(router.url).toBe('/people/11');
    expect(harness.routeNativeElement?.textContent).toContain('Amina Zulu');
    expect(harness.routeNativeElement?.textContent).toContain('Personal details');
  });
});
