import '@angular/compiler';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { StaffDirectoryPageComponent } from './staff-directory-page.component';

describe('StaffDirectoryPageComponent', () => {
  it('loads the read-only directory and exposes pagination state', () => {
    const service = { list: () => of({ count: 1, next: null, previous: null, results: [{
      user_id: 1, person_id: 2, display_name: 'Ada Lovelace', login_email: 'a***@e***', crm_role: 'CRM_ADMIN',
      staff_access_state: 'ACTIVE', account_state: 'ACTIVE', invitation_state: null,
      administrator_approval_state: null, protected_account: false, updated_at: null,
    }] }) };
    TestBed.configureTestingModule({
      imports: [StaffDirectoryPageComponent],
      providers: [provideRouter([]), { provide: StaffManagementService, useValue: service }],
    });
    const fixture = TestBed.createComponent(StaffDirectoryPageComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.count()).toBe(1);
    expect(fixture.componentInstance.rows()[0].display_name).toBe('Ada Lovelace');
  });
});
