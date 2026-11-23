import '@angular/compiler';

import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { API_CONFIG } from './api-config';
import { sessionExpiryInterceptor } from './auth-http.interceptors';

const apiBaseUrl = 'http://localhost:8000/api/v1';
const staffUser: AuthenticatedUser = {
  id: 7,
  email: 'ada@example.com',
  person: { id: 11, first_name: 'Ada', last_name: 'Lovelace', primary_email: 'ada@example.com' },
  staff_roles: ['CRM_ADMIN'],
};

describe('sessionExpiryInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let auth: AuthService;
  const router = { url: '/', navigateByUrl: vi.fn() };

  beforeEach(() => {
    router.navigateByUrl.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionExpiryInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
        { provide: Router, useValue: router },
      ],
    });

    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('clears state and redirects once for an expired authenticated session', () => {
    auth.setAuthenticatedUser(staffUser);
    http.get(`${apiBaseUrl}/auth/me/`).subscribe({ error: () => undefined });

    const request = httpTesting.expectOne(`${apiBaseUrl}/auth/me/`);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.currentUser()).toBeNull();
    expect(auth.sessionExpiredMessage()).toContain('session expired');
    expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/login');
  });

  it('does not treat an ordinary permission 403 as session expiry', () => {
    auth.setAuthenticatedUser(staffUser);
    http.get(`${apiBaseUrl}/people/`).subscribe({ error: () => undefined });

    const request = httpTesting.expectOne(`${apiBaseUrl}/people/`);
    request.flush({ code: 'permission_denied' }, { status: 403, statusText: 'Forbidden' });

    expect(auth.currentUser()).toEqual(staffUser);
    expect(auth.sessionExpiredMessage()).toBeNull();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('recognizes only the explicit expired-session 403 contract', () => {
    auth.setAuthenticatedUser(staffUser);
    http.get(`${apiBaseUrl}/people/`).subscribe({ error: () => undefined });

    const request = httpTesting.expectOne(`${apiBaseUrl}/people/`);
    request.flush({ code: 'session_expired' }, { status: 403, statusText: 'Forbidden' });

    expect(auth.currentUser()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/login');
  });
});
