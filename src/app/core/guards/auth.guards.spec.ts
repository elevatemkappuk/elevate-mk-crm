import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { authGuard, loginGuard, staffAccessGuard } from './auth.guards';

const staffUser: AuthenticatedUser = {
  id: 1,
  email: 'staff@example.com',
  person: {
    id: 2,
    first_name: 'Staff',
    last_name: 'Member',
    primary_email: 'staff@example.com',
  },
  staff_roles: ['CRM_MANAGER'],
};

const nonStaffUser: AuthenticatedUser = {
  ...staffUser,
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
    return this.currentUser()?.staff_roles.length !== 0;
  }

  getAuthorizedRoute(user: AuthenticatedUser | null): string {
    if (!user) {
      return '/login';
    }

    return this.hasStaffAccess() ? '/' : '/access-denied';
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
    auth.setUser(staffUser);

    const result = TestBed.runInInjectionContext(() =>
      staffAccessGuard({} as never, {} as never),
    );

    expect(result).toBe(true);
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
    auth.setUser(staffUser);

    const result = TestBed.runInInjectionContext(() => loginGuard({} as never, {} as never));

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/');
  });
});
