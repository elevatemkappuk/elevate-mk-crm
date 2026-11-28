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
});
