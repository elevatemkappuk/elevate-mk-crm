import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { AuthService } from './core/auth/auth.service';
import { AuthenticatedUser } from './core/auth/auth.types';
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: AuthService, useClass: MockAuthService }],
    });

    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    router = TestBed.inject(Router);
  });

  it('redirects the CRM root to people for authenticated staff', async () => {
    auth.setUser(managerUser);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    expect(router.url).toBe('/people');
    expect(harness.routeNativeElement?.textContent).toContain('People will be the core Staff CRM workspace.');
  });

  it('allows people for CRM admin, manager, and viewer roles', async () => {
    const harness = await RouterTestingHarness.create();

    for (const user of [adminUser, managerUser, viewerUser]) {
      auth.setUser(user);
      await harness.navigateByUrl('/people');

      expect(router.url).toBe('/people');
      expect(harness.routeNativeElement?.textContent).toContain('People will be the core Staff CRM workspace.');
    }
  });

  it('blocks direct administration navigation for non-admin staff', async () => {
    auth.setUser(managerUser);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/administration');

    expect(router.url).toBe('/access-denied');
    expect(harness.routeNativeElement?.textContent).toContain('Staff CRM access is not assigned.');
  });
});
