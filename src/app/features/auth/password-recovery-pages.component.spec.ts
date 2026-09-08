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
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('If an account exists');
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).not.toBeNull();
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
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('expired');
  });

  it('links mismatch feedback to confirmation and reveals each password independently', async () => {
    const auth = new MockAuthService();
    await TestBed.configureTestingModule({ imports: [ResetPasswordPageComponent], providers: [provideRouter([]), { provide: AuthService, useValue: auth }] }).compileComponents();
    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.componentInstance.form.setValue({ new_password: 'First-password', confirm_password: 'Different-password' });
    fixture.detectChanges();
    const password: HTMLInputElement = fixture.nativeElement.querySelector('#reset-password');
    const confirmation: HTMLInputElement = fixture.nativeElement.querySelector('#reset-confirm');
    const toggles: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('[appPasswordVisibility]');
    expect(confirmation.getAttribute('aria-invalid')).toBe('true');
    expect(confirmation.getAttribute('aria-describedby')).toBe('reset-mismatch');
    expect(toggles[1].getAttribute('aria-label')).toBe('Show password confirmation');
    toggles[1].click();
    fixture.detectChanges();
    expect(confirmation.type).toBe('text');
    expect(password.type).toBe('password');
    expect(fixture.componentInstance.form.controls.confirm_password.value).toBe('Different-password');
    expect(auth.confirmPasswordReset).not.toHaveBeenCalled();
    fixture.componentInstance.submit();
    expect(auth.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('announces reset completion and provides the existing sign-in destination', async () => {
    await TestBed.configureTestingModule({ imports: [ResetPasswordPageComponent], providers: [provideRouter([]), { provide: AuthService, useClass: MockAuthService }] }).compileComponents();
    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.componentInstance.form.setValue({ new_password: 'Password-123!', confirm_password: 'Password-123!' });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('Your password has been reset');
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
});
