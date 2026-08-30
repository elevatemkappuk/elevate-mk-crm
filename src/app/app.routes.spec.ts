import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { AuthService } from './core/auth/auth.service';
import { AuthenticatedUser } from './core/auth/auth.types';
import { apiCredentialsInterceptor, csrfHeaderInterceptor } from './core/http/auth-http.interceptors';
import { API_CONFIG } from './core/http/api-config';
import { routes } from './app.routes';

@Component({
  template: '',
})
class DummyRouteComponent {}

const adminUser: AuthenticatedUser = {
  id: 1,
  email: 'admin@example.com',
  person: {
    id: 7,
    first_name: 'Admin',
    last_name: 'User',
    primary_email: 'admin@example.com',
  },
  staff_roles: ['CRM_ADMIN'],
};

const managerUser: AuthenticatedUser = {
  ...adminUser,
  email: 'manager@example.com',
  person: {
    ...adminUser.person,
    first_name: 'Manager',
    primary_email: 'manager@example.com',
  },
  staff_roles: ['CRM_MANAGER'],
};

const viewerUser: AuthenticatedUser = {
  ...adminUser,
  email: 'viewer@example.com',
  person: {
    ...adminUser.person,
    first_name: 'Viewer',
    primary_email: 'viewer@example.com',
  },
  staff_roles: ['CRM_VIEWER'],
};

class MockAuthService {
  private readonly currentUserState = signal<AuthenticatedUser | null>(managerUser);
  private readonly initializedState = signal(true);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly authInitialized = this.initializedState.asReadonly();
  readonly hasStaffAccess = computed(() => (this.currentUser()?.staff_roles.length ?? 0) > 0);
  readonly isCrmAdmin = computed(() => this.canAccessAdministration(this.currentUser()));

  logout = () => of(void 0);

  setUser(user: AuthenticatedUser | null): void {
    this.currentUserState.set(user);
  }

  canAccessAdministration(user: AuthenticatedUser | null = this.currentUser()): boolean {
    return user?.staff_roles.includes('CRM_ADMIN') ?? false;
  }

  getAuthorizedRoute(user: AuthenticatedUser | null = this.currentUser()): string {
    if (!user) {
      return '/login';
    }

    return this.hasStaffAccess() ? '/' : '/access-denied';
  }
}

describe('app routes', () => {
  let auth: MockAuthService;
  let router: Router;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl: 'http://localhost:8000/api/v1' } },
        { provide: AuthService, useClass: MockAuthService },
      ],
    });

    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    router = TestBed.inject(Router);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function stabilize(harness: RouterTestingHarness) {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function expectDefaultPeopleRequest() {
    return httpTesting.expectOne((request) => {
      return (
        request.url === 'http://localhost:8000/api/v1/people/' &&
        request.params.get('q') === '' &&
        request.params.get('record_state') === 'active' &&
        request.params.get('ordering') === 'last_name' &&
        request.params.get('page') === '1' &&
        request.params.get('page_size') === '25'
      );
    });
  }

  function expectPersonOverviewRequest(personId: number) {
    return httpTesting.expectOne(`http://localhost:8000/api/v1/people/${personId}/overview/`);
  }

  it('redirects the CRM root to people for authenticated staff', async () => {
    auth.setUser(managerUser);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    expectDefaultPeopleRequest().flush({ count: 0, next: null, previous: null, results: [] });

    expect(router.url).toBe('/people');
    expect(harness.routeNativeElement?.textContent).toContain('Search');
  });

  it('allows people for CRM admin', async () => {
    auth.setUser(adminUser);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people');

    expectDefaultPeopleRequest().flush({ count: 0, next: null, previous: null, results: [] });

    expect(router.url).toBe('/people');
    expect(harness.routeNativeElement?.textContent).toContain('Search');
  });

  it('allows people for CRM manager', async () => {
    auth.setUser(managerUser);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people');

    expectDefaultPeopleRequest().flush({ count: 0, next: null, previous: null, results: [] });

    expect(router.url).toBe('/people');
    expect(harness.routeNativeElement?.textContent).toContain('Search');
  });

  it('allows people for CRM viewer', async () => {
    auth.setUser(viewerUser);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people');

    expectDefaultPeopleRequest().flush({ count: 0, next: null, previous: null, results: [] });

    expect(router.url).toBe('/people');
    expect(harness.routeNativeElement?.textContent).toContain('Search');
  });

  it('allows CRM staff to reach the person detail route', async () => {
    auth.setUser(viewerUser);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/44');

    expectPersonOverviewRequest(44).flush({
      person: {
        id: 44,
        first_name: 'Ama',
        last_name: 'Amoah',
        primary_email: 'ama@example.com',
        mobile: '0991000001',
        location: 'Lilongwe',
        age_range: '',
        gender: '',
        archived_at: null,
        created_at: '2026-08-30T09:00:00Z',
        updated_at: '2026-08-30T09:15:00Z',
      },
      relationship: {
        type: 'CONTACT',
        label: 'Contact',
      },
      membership: null,
    });
    await stabilize(harness);

    expect(router.url).toBe('/people/44');
    expect(harness.routeNativeElement?.textContent).toContain('Ama Amoah');
    expect(harness.routeNativeElement?.textContent).toContain('Back to People');
    expect(harness.routeNativeElement?.textContent).toContain('Personal details');
    expect(harness.routeNativeElement?.textContent).toContain('Membership');
  });

  it('blocks direct administration navigation for non-admin staff', async () => {
    auth.setUser(managerUser);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/administration');

    expect(router.url).toBe('/access-denied');
    expect(harness.routeNativeElement?.textContent).toContain('Staff CRM access is not assigned.');
  });
});
