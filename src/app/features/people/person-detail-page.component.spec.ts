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

const apiBaseUrl = 'http://localhost:8000/api/v1';

const viewerUser: AuthenticatedUser = {
  id: 3,
  email: 'viewer@example.com',
  person: {
    id: 9,
    first_name: 'Viewer',
    last_name: 'User',
    primary_email: 'viewer@example.com',
  },
  staff_roles: ['CRM_VIEWER'],
};

const activePerson = {
  id: 11,
  first_name: 'Ama',
  last_name: 'Amoah',
  primary_email: 'ama@example.com',
  mobile: '0991000001',
  location: 'Lilongwe',
  age_range: '25-34',
  gender: 'Female',
  archived_at: null,
  created_at: '2026-08-30T09:00:00Z',
  updated_at: '2026-08-30T09:15:00Z',
};

const archivedPerson = {
  id: 12,
  first_name: 'Kwame',
  last_name: 'Mensah',
  primary_email: null,
  mobile: '',
  location: '',
  age_range: '',
  gender: '',
  archived_at: '2026-08-28T10:30:00Z',
  created_at: '2026-08-01T08:00:00Z',
  updated_at: '2026-08-28T10:45:00Z',
};

class MockAuthService {
  readonly authInitialized = signal(true).asReadonly();
  readonly currentUser = signal<AuthenticatedUser | null>(viewerUser).asReadonly();
}

@Component({
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
class DummyShellComponent {}

describe('PersonDetailPageComponent', () => {
  let httpTesting: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: DummyShellComponent,
            children: [{ path: 'people/:id', component: PersonDetailPageComponent }],
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
    httpTesting.verify();
  });

  async function stabilize(harness: RouterTestingHarness) {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  it('loads a person from the route id and renders available fields', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/`).flush(activePerson);
    await stabilize(harness);

    expect(router.url).toBe('/people/11');
    expect(harness.routeNativeElement?.textContent).toContain('Ama Amoah');
    expect(harness.routeNativeElement?.textContent).toContain('ama@example.com');
    expect(harness.routeNativeElement?.textContent).toContain('0991000001');
    expect(harness.routeNativeElement?.textContent).toContain('Lilongwe');
    expect(harness.routeNativeElement?.textContent).toContain('Personal details');
    expect(harness.routeNativeElement?.textContent).toContain('Record information');
  });

  it('shows a loading state before the request resolves', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    expect(harness.routeNativeElement?.textContent).toContain('Loading person');
    expect(harness.routeNativeElement?.textContent).toContain('Retrieving the person record.');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/`).flush(activePerson);
    await stabilize(harness);
  });

  it('shows consistent fallback text for missing optional values', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/`).flush(archivedPerson);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Not provided');
  });

  it('displays archived state for archived people', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/`).flush(archivedPerson);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Archived');
    expect(text).toContain('Archived on');
  });

  it('renders record dates in a human-readable format', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/`).flush(activePerson);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain(formatDateTime(activePerson.created_at));
    expect(text).toContain(formatDateTime(activePerson.updated_at));
  });

  it('shows a clean not-found state for missing or non-visible records', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/404');

    httpTesting.expectOne(`${apiBaseUrl}/people/404/`).flush({}, { status: 404, statusText: 'Not Found' });
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Person not found');
    expect(text).toContain('Return to People');
    expect(text).not.toContain('The record may not exist or may be outside the CRM People domain.');
  });

  it('shows a restrained generic error state for non-404 API failures', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/`).flush({}, { status: 500, statusText: 'Server Error' });
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Person could not be loaded');
    expect(text).toContain('The person record could not be loaded right now.');
  });

  it('provides a back-to-people navigation link', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/`).flush(activePerson);
    await stabilize(harness);

    const link = Array.from(harness.routeNativeElement?.querySelectorAll('a') ?? []).find((anchor) =>
      anchor.textContent?.includes('Back to People'),
    ) as HTMLAnchorElement | undefined;
    expect(link?.textContent).toContain('Back to People');
  });

  it('reloads the person when the route id changes', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/`).flush(activePerson);
    await stabilize(harness);
    expect(harness.routeNativeElement?.textContent).toContain('Ama Amoah');

    await harness.navigateByUrl('/people/12');
    httpTesting.expectOne(`${apiBaseUrl}/people/12/`).flush(archivedPerson);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(router.url).toBe('/people/12');
    expect(text).toContain('Kwame Mensah');
    expect(text).toContain('Archived');
  });
});
