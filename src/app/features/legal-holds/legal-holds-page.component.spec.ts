import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { StaffAccessService } from '../../core/auth/staff-access.service';
import { API_CONFIG } from '../../core/http/api-config';
import { ToastService } from '../../shared/ui/toast.service';
import { LegalHoldsPageComponent } from './legal-holds-page.component';

describe('LegalHoldsPageComponent', () => {
  const apiBaseUrl = 'http://localhost:8000/api/v1';
  let fixture: ComponentFixture<LegalHoldsPageComponent>;
  let component: LegalHoldsPageComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LegalHoldsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: StaffAccessService, useValue: { hasCapability: () => true, refresh: () => of(null) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(LegalHoldsPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps a refreshed creation list authoritative when the initial list response arrives late', () => {
    const initialList = http.expectOne(`${apiBaseUrl}/privacy/legal-holds/`);

    component.personId = 41;
    component.createReason = 'Protect the synthetic UAT record.';
    component.createHold();

    const create = http.expectOne(request => request.url === `${apiBaseUrl}/privacy/legal-holds/` && request.method === 'POST');
    expect(create.request.method).toBe('POST');
    create.flush({});

    const refreshedList = http.match(`${apiBaseUrl}/privacy/legal-holds/`).find(request => request !== initialList)!;
    expect(refreshedList.request.params.has('person_id')).toBe(false);
    refreshedList.flush({
      count: 3,
      next: null,
      previous: null,
      results: [
        { public_id: 'new-hold', status: 'ACTIVE', placed_at: '2026-11-27T12:00:00Z', release_requests: [] },
        { public_id: 'existing-newer', status: 'ACTIVE', placed_at: '2026-11-26T12:00:00Z', release_requests: [] },
        { public_id: 'existing-older', status: 'ACTIVE', placed_at: '2026-11-25T12:00:00Z', release_requests: [] },
      ],
    });
    initialList.flush({ count: 0, next: null, previous: null, results: [] });

    expect(component.activeHolds().map(hold => hold.public_id)).toEqual(['new-hold', 'existing-newer', 'existing-older']);
  });
});
