import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let auth: MockAuthService;
  let router: Router;

  it('renders a forgot-password link', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/forgot-password"]')?.textContent).toContain('Forgot password?');
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        { provide: AuthService, useClass: MockAuthService },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
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

  it('reveals and conceals the same password input without submitting or changing its value', () => {
    component.form.setValue({ email: 'staff@example.com', password: 'secret' });
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#login-password');
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.auth-password-toggle');
    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('aria-controls')).toBe(input.id);
    expect(toggle.getAttribute('aria-label')).toBe('Show password');
    expect(toggle.getAttribute('title')).toBe('Show password');
    expect(toggle.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(toggle.querySelector('svg')?.getAttribute('focusable')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
    expect(toggle.getAttribute('title')).toBe('Hide password');
    expect(input.value).toBe('secret');
    expect(component.form.controls.password.value).toBe('secret');
    expect(auth.login).not.toHaveBeenCalled();
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
  });

  it('connects a touched invalid email to its visible validation message', () => {
    component.form.controls.email.setValue('invalid');
    component.form.controls.email.markAsTouched();
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#login-email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('login-email-error');
    expect(fixture.nativeElement.querySelector('#login-email-error').textContent).toContain('email address');
  });

  it('announces sign-in verification failures without backend terminology', () => {
    auth.login.mockReturnValue(throwError(() => ({ status: 403 })));
    component.form.setValue({ email: 'staff@example.com', password: 'secret' });
    component.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Refresh the page');
    expect(fixture.nativeElement.textContent).not.toContain('CSRF');
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe('/branding/logo.png');
  });
});
