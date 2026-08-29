import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { administrationGuard, authGuard, loginGuard, staffAccessGuard } from './auth.guards';

const adminUser: AuthenticatedUser = {
  id: 1,
  email: 'admin@example.com',
  person: {
    id: 2,
    first_name: 'Admin',
    last_name: 'Member',
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

const nonStaffUser: AuthenticatedUser = {
  ...adminUser,
  staff_roles: [],
};

class MockAuthService {
  private readonly currentUserState = signal<AuthenticatedUser | null>(null);
  private readonly initializedState = signal(true);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly authInitialized = this.initializedState.asReadonly();

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  hasStaffAccess(): boolean {
    return (this.currentUser()?.staff_roles.length ?? 0) !== 0;
  }

  getAuthorizedRoute(user: AuthenticatedUser | null): string {
    if (!user) {
      return '/login';
    }

    return this.hasStaffAccess() ? '/' : '/access-denied';
  }

  canAccessAdministration(user: AuthenticatedUser | null): boolean {
    return user?.staff_roles.includes('CRM_ADMIN') ?? false;
  }

  setInitialized(value: boolean): void {
    this.initializedState.set(value);
  }

  setUser(user: AuthenticatedUser | null): void {
    this.currentUserState.set(user);
  }
}

describe('auth guards', () => {
  let auth: MockAuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useClass: MockAuthService },
      ],
    });

    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    router = TestBed.inject(Router);
  });

  it('does not redirect before auth initialization finishes', () => {
    auth.setInitialized(false);

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('redirects anonymous users to login', () => {
    auth.setUser(null);

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/login');
  });

  it('allows CRM staff roles through the staff access guard', () => {
    for (const user of [adminUser, managerUser, viewerUser]) {
      auth.setUser(user);

      const result = TestBed.runInInjectionContext(() =>
        staffAccessGuard({} as never, {} as never),
      );

      expect(result).toBe(true);
    }
  });

  it('redirects authenticated non-staff users to access denied', () => {
    auth.setUser(nonStaffUser);

    const result = TestBed.runInInjectionContext(() =>
      staffAccessGuard({} as never, {} as never),
    );

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/access-denied',
    );
  });

  it('keeps authenticated staff away from the login page', () => {
    auth.setUser(managerUser);

    const result = TestBed.runInInjectionContext(() => loginGuard({} as never, {} as never));

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/');
  });

  it('allows administration access for CRM admins', () => {
    auth.setUser(adminUser);

    const result = TestBed.runInInjectionContext(() =>
      administrationGuard({} as never, {} as never),
    );

    expect(result).toBe(true);
  });

  it('blocks direct administration navigation for non-admin staff', () => {
    auth.setUser(managerUser);

    const result = TestBed.runInInjectionContext(() =>
      administrationGuard({} as never, {} as never),
    );

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/access-denied',
    );
  });
});
