import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { API_CONFIG } from '../../core/http/api-config';
import { AuthService } from '../../core/auth/auth.service';
import { PrivacyAdministrationPageComponent } from './privacy-administration-page.component';

describe('PrivacyAdministrationPageComponent', () => {
  const apiBaseUrl = 'http://localhost:8000/api/v1';
  let fixture: ComponentFixture<PrivacyAdministrationPageComponent>;
  let component: PrivacyAdministrationPageComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrivacyAdministrationPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
      ],
    });
    fixture = TestBed.createComponent(PrivacyAdministrationPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function flushOverviewRequests(): void {
    http.expectOne(`${apiBaseUrl}/staff/governance/role-defaults/`).flush({ policy_version: 1, role_defaults: [] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/individual/`).flush({ results: [] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/role-defaults/`).flush({ results: [] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/decisions/`).flush({ results: [] });
  }

  it('clears loading after a failed search and permits retry', () => {
    const first = http.expectOne(`${apiBaseUrl}/staff/governance/targets/`);
    first.flush({ detail: 'Temporary failure' }, { status: 503, statusText: 'Service Unavailable' });
    flushOverviewRequests();

    expect(component.loadingDirectory()).toBeFalsy();
    expect(component.directoryStatus()).toBe('error');

    component.searchStaff();
    expect(component.loadingDirectory()).toBeTruthy();
    const retry = http.expectOne(`${apiBaseUrl}/staff/governance/targets/`);
    retry.flush({ count: 1, page: 1, page_size: 25, results: [{ user_id: 5, display_name: 'Synthetic Manager', record_type: 'STAFF', is_active: true, role_codes: ['CRM_MANAGER'], eligible: true, can_manage_privacy_permissions: true }] });

    expect(component.loadingDirectory()).toBeFalsy();
    expect(component.directoryStatus()).toBe('success');
    expect(component.staffDirectory()[0].user_id).toBe(5);
  });

  it('clears protected state and revalidates access after a governance 403', () => {
    TestBed.inject(AuthService).setCurrentUserForTest({
      id: 7,
      email: 'manager@example.com',
      person: { id: 11, first_name: 'Synthetic', last_name: 'Manager', primary_email: 'manager@example.com' },
      staff_roles: ['CRM_MANAGER'],
    });
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const directory = http.expectOne(`${apiBaseUrl}/staff/governance/targets/`);
    directory.flush({ detail: 'You do not have permission.' }, { status: 403, statusText: 'Forbidden' });
    flushOverviewRequests();

    const accessRefresh = http.expectOne(`${apiBaseUrl}/staff/access/me/`);
    accessRefresh.flush({ capability_codes: [], policy_version: 9 });

    expect(component.staffDirectory()).toEqual([]);
    expect(component.roleDefaults()).toBeNull();
    expect(component.pendingAction()).toBeNull();
    expect(component.pendingProposalAction()).toBeNull();
    expect(navigateByUrl).toHaveBeenCalledWith('/access-denied');
  });

  it('submits a backend-permitted role-default proposal with justification', () => {
    http.expectOne(`${apiBaseUrl}/staff/governance/targets/`).flush({ count: 0, page: 1, page_size: 25, results: [] });
    const entry = {
      id: null,
      role_id: 3,
      role_code: 'CRM_VIEWER',
      capability: 'PERSON_CONTACT_READ',
      is_enabled: false,
      permitted_actions: ['ROLE_DEFAULT_ENABLE'],
      execution_mode: 'PROPOSAL',
    } as const;
    http.expectOne(`${apiBaseUrl}/staff/governance/role-defaults/`).flush({ policy_version: 2, role_defaults: [entry] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/individual/`).flush({ results: [] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/role-defaults/`).flush({ results: [] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/decisions/`).flush({ results: [] });

    component.beginRoleDefaultAction(entry, 'ROLE_DEFAULT_ENABLE');
    component.reason = 'Enable the approved viewer contact workflow';
    component.confirmRoleDefaultAction();

    const proposal = http.expectOne(`${apiBaseUrl}/staff/governance/proposals/`);
    expect(proposal.request.body).toEqual({
      operation: 'ROLE_DEFAULT_ENABLE',
      capability: 'PERSON_CONTACT_READ',
      role_id: 3,
      reason: 'Enable the approved viewer contact workflow',
    });
    proposal.flush({ status: 'PENDING' });
    flushOverviewRequests();

    expect(component.feedback()).toBe('The role-default proposal is awaiting independent approval.');
  });

  it('routes admitted superuser role-default actions through the audited direct endpoint', () => {
    http.expectOne(`${apiBaseUrl}/staff/governance/targets/`).flush({ count: 0, page: 1, page_size: 25, results: [] });
    const entry = {
      id: null,
      role_id: 3,
      role_code: 'CRM_VIEWER',
      capability: 'PERSON_CONTACT_READ',
      is_enabled: false,
      permitted_actions: ['ROLE_DEFAULT_ENABLE'],
      execution_mode: 'DIRECT_SUPERUSER',
    } as const;
    http.expectOne(`${apiBaseUrl}/staff/governance/role-defaults/`).flush({ policy_version: 2, role_defaults: [entry] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/individual/`).flush({ results: [] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/role-defaults/`).flush({ results: [] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/decisions/`).flush({ results: [] });

    component.beginRoleDefaultAction(entry, 'ROLE_DEFAULT_ENABLE');
    component.reason = 'Direct audited superuser role-default change';
    component.confirmRoleDefaultAction();

    const action = http.expectOne(`${apiBaseUrl}/staff/governance/superuser-actions/`);
    expect(action.request.body).toEqual({
      operation: 'ROLE_DEFAULT_ENABLE',
      capability: 'PERSON_CONTACT_READ',
      role_id: 3,
      reason: 'Direct audited superuser role-default change',
    });
    action.flush({ status: 'APPLIED', operation: 'ROLE_DEFAULT_ENABLE', capability: 'PERSON_CONTACT_READ', role_id: 3, target_user_id: null, state: {} });
    flushOverviewRequests();

    expect(component.feedback()).toBe('The role-default change was applied and audited.');
  });

  it('renders backend effective explanations and de-duplicates governance history', () => {
    http.expectOne(`${apiBaseUrl}/staff/governance/targets/`).flush({ count: 0, page: 1, page_size: 25, results: [] });
    flushOverviewRequests();

    const entry = {
      public_id: 'proposal-1',
      operation: 'ROLE_DEFAULT_ENABLE',
      status: 'APPROVED',
      role_id: 3,
      role_code: 'CRM_VIEWER',
      target_user_id: null,
      capability: 'PERSON_CONTACT_READ',
      proposed_by_id: 7,
      reason: 'Approved governance change',
      policy_version: 2,
      expires_at: '2026-01-01T00:00:00Z',
      created_at: '2025-12-01T00:00:00Z',
      resolved_at: '2025-12-02T00:00:00Z',
      resolution_reason: 'Approved',
      permitted_actions: [],
      proposed_state: { target_kind: 'role_default', enabled: false },
      resulting_state: { target_kind: 'role_default', enabled: true },
      decision: null,
    } as any;
    component.roleDefaultHistory.set([entry]);
    component.decisionHistory.set([entry]);
    component.target.set({
      target_user_id: 5,
      person_id: 5,
      is_active: true,
      record_type: 'STAFF',
      staff_roles: [{ id: 3, code: 'CRM_VIEWER', is_active: true }],
      capabilities: {
        PERSON_CONTACT_READ: {
          assignment_state: null,
          restriction_active: false,
          effective: true,
          effective_explanation: {
            effective: true,
            sources: ['ROLE_DEFAULT'],
            reason: 'Effective from an active role default.',
            pending_change: null,
          },
          permitted_actions: [],
          permitted_action_modes: {},
        },
      },
    } as any);
    fixture.detectChanges();

    expect(component.historyItems()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Effective');
    expect(fixture.nativeElement.textContent).toContain('Role default enable');
    expect(fixture.nativeElement.textContent).toContain('Previous/proposed state:');
  });
});
