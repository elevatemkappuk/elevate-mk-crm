import { DOCUMENT } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { apiCredentialsInterceptor, csrfHeaderInterceptor } from '../http/auth-http.interceptors';
import { API_CONFIG } from '../http/api-config';
import { AuthenticatedUser } from './auth.types';
import { AuthService } from './auth.service';

const apiBaseUrl = 'http://localhost:8000/api/v1';

const staffUser: AuthenticatedUser = {
  id: 7,
  email: 'ada@example.com',
  person: {
    id: 11,
    first_name: 'Ada',
    last_name: 'Lovelace',
    primary_email: 'ada@example.com',
  },
  staff_roles: ['CRM_ADMIN'],
};

describe('AuthService', () => {
  let authService: AuthService;
  let httpTesting: HttpTestingController;
  let mockDocument: Document;

  beforeEach(() => {
    mockDocument = { cookie: '' } as Document;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
        { provide: DOCUMENT, useValue: mockDocument },
      ],
    });

    authService = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('restores the current user on initialization', async () => {
    const initializePromise = authService.initialize();

    const request = httpTesting.expectOne(`${apiBaseUrl}/auth/me/`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(staffUser);

    await initializePromise;

    expect(authService.authInitialized()).toBe(true);
    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.currentUser()).toEqual(staffUser);
  });

  it('treats a 401 me response as unauthenticated', async () => {
    const initializePromise = authService.initialize();

    const request = httpTesting.expectOne(`${apiBaseUrl}/auth/me/`);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    await initializePromise;

    expect(authService.authInitialized()).toBe(true);
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.currentUser()).toBeNull();
  });

  it('bootstraps CSRF then logs in with normalized email and current CSRF header', () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const sessionStorageSpy = vi.spyOn(Storage.prototype, 'setItem');

    authService.login({ email: '  Ada@Example.com ', password: 'secret' }).subscribe((user) => {
      expect(user).toEqual(staffUser);
    });

    const csrfRequest = httpTesting.expectOne(`${apiBaseUrl}/auth/csrf/`);
    expect(csrfRequest.request.method).toBe('GET');
    expect(csrfRequest.request.withCredentials).toBe(true);
    mockDocument.cookie = 'csrftoken=test-token';
    csrfRequest.flush({ detail: 'CSRF cookie set.' });

    const loginRequest = httpTesting.expectOne(`${apiBaseUrl}/auth/login/`);
    expect(loginRequest.request.method).toBe('POST');
    expect(loginRequest.request.withCredentials).toBe(true);
    expect(loginRequest.request.headers.get('X-CSRFToken')).toBe('test-token');
    expect(loginRequest.request.body).toEqual({
      email: 'ada@example.com',
      password: 'secret',
    });
    loginRequest.flush(staffUser);

    expect(authService.currentUser()).toEqual(staffUser);
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
  });

  it('clears the current user on logout without storing session tokens', () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const sessionStorageSpy = vi.spyOn(Storage.prototype, 'setItem');

    authService.setCurrentUserForTest(staffUser);
    mockDocument.cookie = 'csrftoken=rotated-token';

    authService.logout().subscribe();

    const request = httpTesting.expectOne(`${apiBaseUrl}/auth/logout/`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRFToken')).toBe('rotated-token');
    expect(request.request.body).toBeNull();
    request.flush({});

    expect(authService.currentUser()).toBeNull();
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
  });

  it('adds withCredentials only for configured API requests', () => {
    const http = TestBed.inject(HttpClient);

    http.get('https://example.com/health').subscribe();

    const request = httpTesting.expectOne('https://example.com/health');
    expect(request.request.withCredentials).toBe(false);
    request.flush({});
  });
});
