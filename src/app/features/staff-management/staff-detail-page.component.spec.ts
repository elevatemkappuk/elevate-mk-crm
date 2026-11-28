import '@angular/compiler';

import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { StaffDetailPageComponent } from './staff-detail-page.component';

describe('StaffDetailPageComponent', () => {
  it('loads the staff detail and activity projection', () => {
    const detail = {
      user_id: 1, person_id: 2, display_name: 'Ada Lovelace', login_email: 'a***@e***', crm_role: 'CRM_ADMIN',
      staff_access_state: 'ACTIVE', account_state: 'ACTIVE', invitation_state: null,
      administrator_approval_state: null, protected_account: false, updated_at: null,
      person: { id: 2, first_name: 'Ada', last_name: 'Lovelace', primary_email: 'a***@e***' },
      role_assignments: [], invitations: [], administrator_proposals: [],
      can_propose_administrator_promotion: false, can_change_role: false, can_deactivate: false, can_reactivate: false,
      can_disable_account: false, can_enable_account: false, can_send_password_reset: false, can_change_login_email: false, email_change_requests: [],
    };
    const service = { get: () => of(detail), activity: () => of({ count: 0, next: null, previous: null, results: [] }) };
    TestBed.configureTestingModule({
      imports: [StaffDetailPageComponent],
      providers: [
        { provide: StaffManagementService, useValue: service },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '1' })) } },
      ],
    });
    const fixture = TestBed.createComponent(StaffDetailPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.detail()?.display_name).toBe('Ada Lovelace');
    expect(fixture.componentInstance.activity()).toEqual([]);
  });

  it('opens the administrative password-reset confirmation action', () => {
    const service = { get: () => of(null), activity: () => of({ count: 0, next: null, previous: null, results: [] }) };
    TestBed.configureTestingModule({
      imports: [StaffDetailPageComponent],
      providers: [
        { provide: StaffManagementService, useValue: service },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '1' })) } },
      ],
    });
    const fixture = TestBed.createComponent(StaffDetailPageComponent);
    fixture.componentInstance.openAccountAction('password-reset', 1);
    expect(fixture.componentInstance.action()).toEqual({ kind: 'password-reset', id: 1 });
  });
});
