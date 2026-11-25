import '@angular/compiler';

import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { apiCredentialsInterceptor } from '../http/auth-http.interceptors';
import { API_CONFIG } from '../http/api-config';
import { AuthenticatedUser } from './auth.types';
import { StaffAccessService } from './staff-access.service';

const apiBaseUrl = 'http://localhost:8000/api/v1';
const staffUser: AuthenticatedUser = {
  id: 7,
  email: 'ada@example.com',
  person: { id: 11, first_name: 'Ada', last_name: 'Lovelace', primary_email: 'ada@example.com' },
  staff_roles: ['CRM_ADMIN'],
};
const replacementUser: AuthenticatedUser = {
  ...staffUser,
  id: 8,
  email: 'grace@example.com',
};

describe('StaffAccessService', () => {
  let service: StaffAccessService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiCredentialsInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
      ],
    });

    service = TestBed.inject(StaffAccessService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads the exact empty production projection into immutable in-memory state', () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const sessionStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    let projection: unknown;

    service.refresh(staffUser).subscribe((value) => projection = value);

    const request = httpTesting.expectOne(`${apiBaseUrl}/staff/access/me/`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ capability_codes: [], policy_version: 2 });

    expect(projection).toEqual({ capability_codes: [], policy_version: 2 });
    expect(service.status()).toBe('ready');
    expect(service.capabilityCodes()).toEqual([]);
    expect(service.policyVersion()).toBe(2);
    expect(service.hasCapability('PERSON_CONTACT_READ')).toBe(false);
    expect(Object.isFrozen(service.state())).toBe(true);
    expect(Object.isFrozen(service.projection())).toBe(true);
    expect(Object.isFrozen(service.capabilityCodes())).toBe(true);
    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();
  });

  it('fails closed for malformed and unknown capability responses', () => {
    let receivedError: unknown;
    service.refresh(staffUser).subscribe({ error: (error) => receivedError = error });
    const request = httpTesting.expectOne(`${apiBaseUrl}/staff/access/me/`);
    request.flush({ capability_codes: ['UNKNOWN_CODE'], policy_version: 2 });

    expect(receivedError).toBeTruthy();
    expect(service.status()).toBe('error');
    expect(service.projection()).toBeNull();
    expect(service.hasCapability('UNKNOWN_CODE')).toBe(false);

    service.refresh(staffUser).subscribe({ error: (error) => receivedError = error });
    const malformedRequest = httpTesting.expectOne(`${apiBaseUrl}/staff/access/me/`);
    malformedRequest.flush({ capability_codes: [], policy_version: 2, extra: true });

    expect(receivedError).toBeTruthy();
    expect(service.status()).toBe('error');
    expect(service.projection()).toBeNull();
  });

  it('accepts the independent privacy capabilities without inferring them from roles', () => {
    service.refresh(staffUser).subscribe();
    const request = httpTesting.expectOne(`${apiBaseUrl}/staff/access/me/`);
    request.flush({ capability_codes: ['LEGAL_HOLD_ADMIN', 'PRIVACY_AUDIT_READ'], policy_version: 3 });

    expect(service.hasCapability('PRIVACY_AUDIT_READ')).toBe(true);
    expect(service.hasCapability('LEGAL_HOLD_ADMIN')).toBe(true);
    expect(service.hasCapability('STAFF_CAPABILITY_ADMIN')).toBe(false);
  });

  it('retains unauthenticated state on 401 and forbidden state on ordinary 403', () => {
    let firstError: unknown;
    service.refresh(staffUser).subscribe({ error: (error) => firstError = error });
    const unauthorizedRequest = httpTesting.expectOne(`${apiBaseUrl}/staff/access/me/`);
    unauthorizedRequest.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(firstError).toBeTruthy();
    expect(service.status()).toBe('unauthenticated');
    expect(service.projection()).toBeNull();

    let secondError: unknown;
    service.refresh(staffUser).subscribe({ error: (error) => secondError = error });
    const forbiddenRequest = httpTesting.expectOne(`${apiBaseUrl}/staff/access/me/`);
    forbiddenRequest.flush({}, { status: 403, statusText: 'Forbidden' });

    expect(secondError).toBeTruthy();
    expect(service.status()).toBe('forbidden');
    expect(service.projection()).toBeNull();
  });

  it('deduplicates concurrent refreshes for one account and epoch', () => {
    let firstResult = 0;
    let secondResult = 0;
    const first = service.refresh(staffUser).subscribe(() => firstResult++);
    const second = service.refresh(staffUser).subscribe(() => secondResult++);

    httpTesting.expectOne(`${apiBaseUrl}/staff/access/me/`).flush({ capability_codes: [], policy_version: 2 });

    expect(firstResult).toBe(1);
    expect(secondResult).toBe(1);
    first.unsubscribe();
    second.unsubscribe();
  });

  it('ignores stale responses after account replacement', () => {
    let oldError: unknown;
    let newResult = 0;
    service.refresh(staffUser).subscribe({ error: (error) => oldError = error });
    service.refresh(replacementUser).subscribe(() => newResult++);

    const requests = httpTesting.match(`${apiBaseUrl}/staff/access/me/`);
    expect(requests).toHaveLength(2);
    requests[0].flush({ capability_codes: [], policy_version: 1 });
    expect(service.status()).toBe('loading');
    expect(oldError).toBeUndefined();

    requests[1].flush({ capability_codes: [], policy_version: 2 });
    expect(newResult).toBe(1);
    expect(service.status()).toBe('ready');
    expect(service.policyVersion()).toBe(2);
  });

  it('ignores an in-flight response after logout/account invalidation', () => {
    service.refresh(staffUser).subscribe();
    const request = httpTesting.expectOne(`${apiBaseUrl}/staff/access/me/`);

    service.clearUnauthenticated();
    request.flush({ capability_codes: [], policy_version: 2 });

    expect(service.status()).toBe('unauthenticated');
    expect(service.projection()).toBeNull();
    expect(service.policyVersion()).toBeNull();
  });

  it('does not call the endpoint for an authenticated non-CRM user', () => {
    const user = { ...staffUser, staff_roles: [] };
    service.refresh(user).subscribe((value) => expect(value).toBeNull());

    expect(service.status()).toBe('forbidden');
    expect(httpTesting.match(`${apiBaseUrl}/staff/access/me/`)).toHaveLength(0);
  });

  it('marks a null account unauthenticated without making a request', () => {
    service.refresh(null).subscribe((value) => expect(value).toBeNull());

    expect(service.status()).toBe('unauthenticated');
    expect(httpTesting.match(`${apiBaseUrl}/staff/access/me/`)).toHaveLength(0);
  });
});
