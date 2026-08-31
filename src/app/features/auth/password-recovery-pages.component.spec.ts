import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { ForgotPasswordPageComponent } from './forgot-password-page.component';
import { ResetPasswordPageComponent } from './reset-password-page.component';

class MockAuthService {
  requestPasswordReset = vi.fn(() => of({ detail: 'sent' }));
  confirmPasswordReset = vi.fn(() => of({ detail: 'reset' }));
}

describe('password recovery pages', () => {
  it('submits the forgot-password email and shows the generic success state', async () => {
    await TestBed.configureTestingModule({ imports: [ForgotPasswordPageComponent], providers: [provideRouter([]), { provide: AuthService, useClass: MockAuthService }] }).compileComponents();
    const fixture: ComponentFixture<ForgotPasswordPageComponent> = TestBed.createComponent(ForgotPasswordPageComponent);
    fixture.componentInstance.form.setValue({ email: 'staff@example.com' });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(TestBed.inject(AuthService).requestPasswordReset).toHaveBeenCalledWith({ email: 'staff@example.com' });
    expect(fixture.nativeElement.textContent).toContain('If an account exists');
  });

  it('uses uid and token from route parameters without rendering them and provides an invalid-link recovery path', async () => {
    const auth = new MockAuthService();
    auth.confirmPasswordReset.mockReturnValue(throwError(() => ({ error: { code: 'invalid_password_reset_token' } })));
    await TestBed.configureTestingModule({ imports: [ResetPasswordPageComponent], providers: [provideRouter([]), { provide: AuthService, useValue: auth }, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['uid', 'uid-value'], ['token', 'token-value']]) } } }] }).compileComponents();
    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.componentInstance.form.setValue({ new_password: 'Password-123!', confirm_password: 'Password-123!' });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(auth.confirmPasswordReset).toHaveBeenCalledWith({ uid: 'uid-value', token: 'token-value', new_password: 'Password-123!', confirm_password: 'Password-123!' });
    expect(fixture.nativeElement.textContent).toContain('Request another reset link');
    expect(fixture.nativeElement.textContent).not.toContain('token-value');
  });
});
