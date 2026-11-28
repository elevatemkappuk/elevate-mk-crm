import '@angular/compiler';

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { StaffInvitationAcceptPageComponent } from './staff-invitation-accept-page.component';

describe('StaffInvitationAcceptPageComponent', () => {
  it('uses the existing account authentication path before acceptance', () => {
    const service = {
      inspectInvitation: () => of({ usable: true, existing_account: true, role_code: 'CRM_VIEWER', expires_at: '2030-01-01T00:00:00Z' }),
      acceptInvitation: vi.fn(() => of({ detail: 'accepted', user_id: 10 })),
    };
    const auth = { currentUser: () => null, login: vi.fn(() => of({})), logout: vi.fn(() => of(void 0)) };
    TestBed.configureTestingModule({ imports: [StaffInvitationAcceptPageComponent], providers: [{ provide: StaffManagementService, useValue: service }, { provide: AuthService, useValue: auth }] });
    const fixture = TestBed.createComponent(StaffInvitationAcceptPageComponent);
    fixture.componentInstance.form.setValue({ email: 'person@example.com', password: 'Existing-password-123!', confirm_password: '' });
    fixture.componentInstance.accept();
    expect(auth.login).toHaveBeenCalled();
  });
});
