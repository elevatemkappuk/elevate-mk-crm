import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { signal } from '@angular/core';

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
  let capability: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    capability = signal(true);
    TestBed.configureTestingModule({
      imports: [LegalHoldsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: StaffAccessService, useValue: { hasCapability: () => capability(), refresh: () => of(null) } },
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

  it('uses cancellation metadata for cancelled history while preserving request metadata', () => {
    const initialList = http.expectOne(`${apiBaseUrl}/privacy/legal-holds/`);
    initialList.flush({ count: 0, next: null, previous: null, results: [] });

    component.holds.set([{
      public_id: 'hold-1', status: 'ACTIVE', placed_at: '2026-11-20T12:00:00Z', release_requests: [{
        public_id: 'request-1', status: 'CANCELLED', justification: 'Original request reason',
        requested_by: { id: 2, display_name: 'Requester', contact_restricted: false }, requested_by_id: 2,
        requested_at: '2026-11-21T12:00:00Z', approved_by: null, approved_by_id: null, approved_at: null,
        approval_justification: null, rejected_by: null, rejected_by_id: null, rejected_at: null,
        rejection_reason: null, cancelled_by: { id: 3, display_name: 'Canceller', contact_restricted: false },
        cancelled_by_id: 3, cancelled_at: '2026-11-22T12:00:00Z', cancellation_reason: 'No longer required',
        permitted_actions: [],
      }],
    } as any]);

    const row = component.historyRows()[0];
    expect(row.timestamp).toBe('2026-11-22T12:00:00Z');
    expect(component.historyActor(row.request!)!.display_name).toBe('Canceller');
    expect(component.historyReason(row.request!)).toBe('No longer required');
    expect(row.request!.requested_at).toBe('2026-11-21T12:00:00Z');
    expect(row.request!.justification).toBe('Original request reason');
  });

  it('clears protected person state and ignores a late search response after capability loss', () => {
    const initialList = http.expectOne(`${apiBaseUrl}/privacy/legal-holds/`);
    initialList.flush({ count: 0, next: null, previous: null, results: [] });

    component.personId = 41;
    component.personSearch = 'UAT';
    component.selectedPerson.set({ id: 41, first_name: 'UAT', last_name: 'Subject' } as any);
    component.personOptions.set([{ id: 42, first_name: 'Other', last_name: 'Person' }] as any);
    component.createDialogOpen.set(true);
    component.createReason = 'Protected draft reason';
    component.searchPeople();
    const search = http.expectOne(request => request.url === `${apiBaseUrl}/privacy/legal-holds/person-targets/`);

    capability.set(false);
    fixture.detectChanges();
    expect(component.personId).toBeNull();
    expect(component.personSearch).toBe('');
    expect(component.selectedPerson()).toBeNull();
    expect(component.personOptions()).toEqual([]);
    expect(component.createDialogOpen()).toBe(false);
    expect(component.createReason).toBe('');

    search.flush({ count: 1, next: null, previous: null, results: [{ id: 42, first_name: 'Late', last_name: 'Response' }] });
    expect(component.personOptions()).toEqual([]);
    expect(component.selectedPerson()).toBeNull();
  });
});
