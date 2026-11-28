import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
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
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
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

  it('returns to the approval list and removes a resolved request from pending state', () => {
    http.expectOne(`${apiBaseUrl}/staff/governance/targets/`).flush({ count: 0, page: 1, page_size: 25, results: [] });
    flushOverviewRequests();

    const proposal = {
      public_id: 'proposal-resolved',
      operation: 'ROLE_DEFAULT_ENABLE',
      status: 'PENDING',
      role_id: 3,
      role_code: 'CRM_VIEWER',
      target_user_id: null,
      capability: 'PERSON_CONTACT_READ',
      proposed_by_id: 7,
      reason: 'Enable access',
      permitted_actions: ['approve'],
    } as any;
    component.roleDefaultHistory.set([proposal]);
    component.selectedProposal.set(proposal);
    component.selectTab('approval-requests');
    component.beginProposalAction(proposal, 'approve');
    component.proposalReason = 'Approved after review';
    component.confirmProposalAction();

    const resolution = http.expectOne(`${apiBaseUrl}/staff/governance/proposals/proposal-resolved/approve/`);
    resolution.flush({ ...proposal, status: 'APPROVED', permitted_actions: [] });
    expect(component.pendingProposalAction()).toBeNull();
    expect(component.selectedProposal()).toBeNull();
    expect(component.activeTab()).toBe('approval-requests');
    expect(component.pendingProposals()).toEqual([]);
    flushOverviewRequests();
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
    component.selectedHistory.set(entry);
    component.selectTab('governance-history');
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
    expect(fixture.nativeElement.textContent).toContain('Enabled by default');
    expect(fixture.nativeElement.textContent).toContain('Enable by default');
    expect(fixture.nativeElement.textContent).toContain('Proposed change');
  });

  it('opens Staff Permissions by default and isolates each tab panel', () => {
    http.expectOne(`${apiBaseUrl}/staff/governance/targets/`).flush({ count: 0, page: 1, page_size: 25, results: [] });
    flushOverviewRequests();
    fixture.detectChanges();

    expect(component.activeTab()).toBe('staff-permissions');
    expect(fixture.nativeElement.querySelector('#staff-permissions-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#role-defaults-panel')).toBeNull();

    component.selectTab('governance-history');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#staff-permissions-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('#governance-history-panel')).not.toBeNull();
  });

  it('renders role defaults as an API-backed permission matrix with pending current state', () => {
    http.expectOne(`${apiBaseUrl}/staff/governance/targets/`).flush({ count: 0, page: 1, page_size: 25, results: [] });
    http.expectOne(`${apiBaseUrl}/staff/governance/role-defaults/`).flush({ policy_version: 4, role_defaults: [
      { id: 1, role_id: 1, role_code: 'CRM_ADMIN', capability: 'PERSON_CONTACT_READ', is_enabled: true, permitted_actions: [], execution_mode: 'PROPOSAL' },
      { id: 2, role_id: 2, role_code: 'CRM_MANAGER', capability: 'PERSON_CONTACT_READ', is_enabled: false, permitted_actions: ['ROLE_DEFAULT_ENABLE'], execution_mode: 'PROPOSAL' },
    ] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/individual/`).flush({ results: [] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/role-defaults/`).flush({ results: [{
      public_id: 'pending-1', operation: 'ROLE_DEFAULT_ENABLE', status: 'PENDING', role_id: 2, role_code: 'CRM_MANAGER', target_user_id: null,
      capability: 'PERSON_CONTACT_READ', proposed_by_id: 7, reason: 'Pending change', policy_version: 4, expires_at: '2026-01-01T00:00:00Z',
      created_at: '2025-12-01T00:00:00Z', resolved_at: null, resolution_reason: '', permitted_actions: [], decision: null,
    }] });
    http.expectOne(`${apiBaseUrl}/staff/governance/history/decisions/`).flush({ results: [] });

    component.selectTab('role-defaults');
    fixture.detectChanges();

    const matrix = fixture.nativeElement.querySelector('.permission-matrix');
    expect(matrix).not.toBeNull();
    expect(matrix.textContent).toContain('View contact information');
    expect(matrix.textContent).toContain('CRM Administrator');
    expect(matrix.textContent).toContain('CRM Manager');
    expect(matrix.querySelectorAll('.permission-status').length).toBe(7 * 3);
    expect(matrix.querySelector('.permission-status--pending')).not.toBeNull();
    expect(matrix.querySelector('.permission-status--pending').getAttribute('aria-label')).toContain('pending enable by default');
  });

  it('uses one accessible row action and omits it for ineligible staff', () => {
    http.expectOne(`${apiBaseUrl}/staff/governance/targets/`).flush({ count: 2, page: 1, page_size: 25, results: [
      { user_id: 5, display_name: 'Synthetic Manager', record_type: 'STAFF', is_active: true, role_codes: ['CRM_MANAGER'], eligible: true, can_manage_privacy_permissions: true },
      { user_id: 6, display_name: 'Synthetic Unauthorized', record_type: 'STAFF', is_active: true, role_codes: [], eligible: false, can_manage_privacy_permissions: false },
    ] });
    flushOverviewRequests();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.staff-table tbody tr');
    expect(rows[0].getAttribute('tabindex')).toBe('0');
    expect(rows[0].getAttribute('aria-label')).toBe('View permissions for Synthetic Manager');
    expect(rows[0].querySelector('.row-chevron')).not.toBeNull();
    expect(rows[1].getAttribute('tabindex')).toBeNull();
    expect(rows[1].querySelector('.row-chevron')).toBeNull();
  });

  it('derives role-default approval state from the authoritative current role-default record', () => {
    http.expectOne(`${apiBaseUrl}/staff/governance/targets/`).flush({ count: 0, page: 1, page_size: 25, results: [] });
    flushOverviewRequests();

    const removal = {
      operation: 'INDIVIDUAL_UNRESTRICT',
      proposed_state: { target_kind: 'individual', restriction_active: true, assignment_state: 'ACTIVE' },
    } as any;
    const roleDefault = {
      operation: 'ROLE_DEFAULT_ENABLE',
      role_id: 2,
      role_code: 'CRM_MANAGER',
      capability: 'PERSON_CONTACT_READ',
      proposed_state: { target_kind: 'role_default', enabled: false },
    } as any;

    component.roleDefaults.set({
      policy_version: 4,
      role_defaults: [{ id: 2, role_id: 2, role_code: 'CRM_MANAGER', capability: 'PERSON_CONTACT_READ', is_enabled: true, permitted_actions: [], execution_mode: 'PROPOSAL' }],
    });

    expect(component.proposalCurrentState(removal)).toBe('Restriction active');
    expect(component.proposalProposedChange(removal)).toBe('Remove restriction');
    expect(component.proposalCurrentState(roleDefault)).toBe('Enabled by default');
    expect(component.proposalProposedChange(roleDefault)).toBe('Enable by default');
  });
});
