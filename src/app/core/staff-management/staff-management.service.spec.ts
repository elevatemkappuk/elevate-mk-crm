import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { API_CONFIG } from '../http/api-config';
import { StaffManagementService } from './staff-management.service';

describe('StaffManagementService', () => {
  it('uses the read-only directory contracts', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_CONFIG, useValue: { apiBaseUrl: '/api' } }],
    });
    const service = TestBed.inject(StaffManagementService);
    const http = TestBed.inject(HttpTestingController);

    service.list({ q: 'Ada', page: 2 }).subscribe();
    const request = http.expectOne(request => request.url === '/api/staff/directory/');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('q')).toBe('Ada');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ count: 0, next: null, previous: null, results: [] });
    http.verify();
  });

  it('uses the non-mutating role privacy preview contract', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_CONFIG, useValue: { apiBaseUrl: '/api' } }],
    });
    const service = TestBed.inject(StaffManagementService);
    const http = TestBed.inject(HttpTestingController);
    service.previewStaffRole(7, 'CRM_MANAGER', 'Role-change privacy preview').subscribe();
    const request = http.expectOne('/api/staff/role-change/preview/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ user_id: 7, role_code: 'CRM_MANAGER', reason: 'Role-change privacy preview' });
    request.flush({ status: 'HYPOTHETICAL', target_user_id: 7, current_role_codes: ['CRM_VIEWER'], proposed_role_code: 'CRM_MANAGER', current: {}, proposed: {}, gained: [], lost: [], retained_restrictions: [], suspended_grants: [] });
    http.verify();
  });
});
