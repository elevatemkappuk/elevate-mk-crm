import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthenticatedUser } from '../../core/auth/auth.types';
import { AuthService } from '../../core/auth/auth.service';
import { LoginPageComponent } from './login-page.component';

const staffUser: AuthenticatedUser = {
  id: 1,
  email: 'staff@example.com',
  person: {
    id: 10,
    first_name: 'Staff',
    last_name: 'Member',
    primary_email: 'staff@example.com',
  },
  staff_roles: ['CRM_ADMIN'],
};

const nonStaffUser: AuthenticatedUser = {
  ...staffUser,
  email: 'member@example.com',
  staff_roles: [],
};

class MockAuthService {
  readonly authInitialized = signal(true).asReadonly();
  readonly currentUser = signal<AuthenticatedUser | null>(null).asReadonly();

  login = vi.fn();
  setAuthenticatedUser = vi.fn();
  getAuthorizedRoute = vi.fn();
}

class MockRouter {
  navigateByUrl = vi.fn().mockResolvedValue(true);
}

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let auth: MockAuthService;
  let router: MockRouter;

  it('renders a forgot-password link', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/forgot-password"]')?.textContent).toContain('Forgot password?');
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        { provide: AuthService, useClass: MockAuthService },
        { provide: Router, useClass: MockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    router = TestBed.inject(Router) as unknown as MockRouter;
    fixture.detectChanges();
  });

  it('immediately navigates CRM staff into the protected CRM route after login', () => {
    auth.login.mockReturnValue(of(staffUser));
    auth.getAuthorizedRoute.mockReturnValue('/');

    component.form.setValue({ email: 'staff@example.com', password: 'secret' });
    component.submit();

    expect(auth.setAuthenticatedUser).toHaveBeenCalledWith(staffUser);
    expect(auth.getAuthorizedRoute).toHaveBeenCalledWith(staffUser);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('immediately navigates authenticated non-staff users to access denied', () => {
    auth.login.mockReturnValue(of(nonStaffUser));
    auth.getAuthorizedRoute.mockReturnValue('/access-denied');

    component.form.setValue({ email: 'member@example.com', password: 'secret' });
    component.submit();

    expect(auth.setAuthenticatedUser).toHaveBeenCalledWith(nonStaffUser);
    expect(auth.getAuthorizedRoute).toHaveBeenCalledWith(nonStaffUser);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/access-denied');
  });

  it('sets authenticated state before evaluating the redirect target', () => {
    auth.login.mockReturnValue(of(staffUser));
    auth.getAuthorizedRoute.mockImplementation((user: AuthenticatedUser | null) => {
      expect(auth.setAuthenticatedUser).toHaveBeenCalledWith(staffUser);
      expect(user).toEqual(staffUser);
      return '/';
    });

    component.form.setValue({ email: 'staff@example.com', password: 'secret' });
    component.submit();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('shows a generic error for failed login', () => {
    auth.login.mockReturnValue(
      throwError(() => ({
        status: 400,
      })),
    );

    component.form.setValue({ email: 'staff@example.com', password: 'wrong' });
    component.submit();

    expect(component.errorMessage()).toBe('Sign-in failed. Check your credentials and try again.');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
