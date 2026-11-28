import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { StaffEmailChangeVerificationPageComponent } from './staff-email-change-verification-page.component';

describe('StaffEmailChangeVerificationPageComponent', () => {
  it('is configured as a separate-file verification page', async () => {
    await TestBed.configureTestingModule({ imports: [StaffEmailChangeVerificationPageComponent], providers: [provideRouter([])] }).compileComponents();
    expect(StaffEmailChangeVerificationPageComponent).toBeTruthy();
  });
});
