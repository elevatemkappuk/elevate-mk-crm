import '@angular/compiler';

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { StaffOnboardingDrawerComponent } from './staff-onboarding-drawer.component';

describe('StaffOnboardingDrawerComponent', () => {
  it('loads the authoritative role options for the invitation workflow', () => {
    const service = {
      onboardingRoles: () => of({ results: [{ code: 'CRM_VIEWER', name: 'CRM Viewer', administrator_approval_required: false }] }),
      validateOnboarding: () => of({ eligible: true, requested_role: 'CRM_VIEWER', submission_available: false, unavailable_reason: 'Invitation lifecycle pending.' }),
      submitOnboarding: () => of({ public_id: 'invitation', intended_email: 'person@example.com', expires_at: '2030-01-01T00:00:00Z', delivery: 'PENDING' }),
    };
    TestBed.configureTestingModule({ imports: [StaffOnboardingDrawerComponent], providers: [{ provide: StaffManagementService, useValue: service }] });
    const fixture = TestBed.createComponent(StaffOnboardingDrawerComponent);
    expect(fixture.componentInstance.result()).toBeNull();
    expect(fixture.componentInstance.roles()[0].code).toBe('CRM_VIEWER');
  });
});
