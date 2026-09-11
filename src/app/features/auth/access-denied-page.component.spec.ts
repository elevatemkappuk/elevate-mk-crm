import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { AccessDeniedPageComponent } from './access-denied-page.component';

class MockAuthService {
  logout = vi.fn();
  clearUserState = vi.fn();
}

describe('AccessDeniedPageComponent', () => {
  let fixture: ComponentFixture<AccessDeniedPageComponent>;
  let component: AccessDeniedPageComponent;
  let auth: MockAuthService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessDeniedPageComponent],
      providers: [{ provide: AuthService, useClass: MockAuthService }, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessDeniedPageComponent);
    component = fixture.componentInstance;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('logs out through AuthService, clears state, and navigates to sign-in', () => {
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Staff CRM access is not assigned.');
    expect(fixture.nativeElement.querySelector('button')?.textContent).toContain('Return to sign-in');
    auth.logout.mockReturnValue(of(void 0));

    component.returnToSignIn();

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(component.signingOut()).toBe(false);
  });

  it('guards repeated clicks while logout is pending', () => {
    const pendingLogout = new Subject<void>();
    auth.logout.mockReturnValue(pendingLogout);

    component.returnToSignIn();
    component.returnToSignIn();

    expect(auth.logout).toHaveBeenCalledTimes(1);
    pendingLogout.complete();
  });

  it('clears local state and still opens sign-in when the session is already unavailable', () => {
    auth.logout.mockReturnValue(throwError(() => new Error('session expired')));

    component.returnToSignIn();

    expect(auth.clearUserState).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(component.signingOut()).toBe(false);
  });
});
