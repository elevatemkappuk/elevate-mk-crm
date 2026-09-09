import { Component, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { AuthenticatedUser } from '../../core/auth/auth.types';
import { StaffCrmShellPageComponent } from './staff-crm-shell-page.component';

@Component({
  template: '',
})
class DummyRouteComponent {}

const adminUser: AuthenticatedUser = {
  id: 1,
  email: 'admin@example.com',
  person: {
    id: 1,
    first_name: 'Ada',
    last_name: 'Admin',
    primary_email: 'admin@example.com',
  },
  staff_roles: ['CRM_ADMIN'],
};

const managerUser: AuthenticatedUser = {
  ...adminUser,
  email: 'manager@example.com',
  person: {
    ...adminUser.person,
    first_name: 'Morgan',
    primary_email: 'manager@example.com',
  },
  staff_roles: ['CRM_MANAGER'],
};

class MockAuthService {
  private readonly currentUserState = signal<AuthenticatedUser | null>(adminUser);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isCrmAdmin = computed(() => this.currentUser()?.staff_roles.includes('CRM_ADMIN') ?? false);
  readonly logout = vi.fn(() => of(void 0));

  setUser(user: AuthenticatedUser): void {
    this.currentUserState.set(user);
  }
}

describe('StaffCrmShellPageComponent', () => {
  let fixture: ComponentFixture<StaffCrmShellPageComponent>;
  let component: StaffCrmShellPageComponent;
  let auth: MockAuthService;
  let router: Router;

  beforeEach(async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    await TestBed.configureTestingModule({
      imports: [StaffCrmShellPageComponent],
      providers: [
        provideRouter([
          { path: 'people', component: DummyRouteComponent },
          { path: 'administration', component: DummyRouteComponent },
          { path: 'imports', component: DummyRouteComponent },
          { path: 'login', component: DummyRouteComponent },
        ]),
        { provide: AuthService, useClass: MockAuthService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    await router.navigateByUrl('/people');

    fixture = TestBed.createComponent(StaffCrmShellPageComponent);
    component = fixture.componentInstance;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    fixture.detectChanges();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('shows the administration navigation entry for CRM admins', () => {
    const host = fixture.nativeElement as HTMLElement;
    const links = Array.from(host.querySelectorAll('.nav-link') as NodeListOf<HTMLElement>).map(
      (link) => link.textContent?.trim(),
    );

    expect(links).toContain('Dashboard');
    expect(links).toContain('People');
    expect(links).toContain('Administration');
    expect(links).toContain('Historical Imports');
    expect(fixture.nativeElement.textContent).toContain('Ada Admin');
    expect(fixture.nativeElement.textContent).toContain('admin@example.com');
  });

  it('hides the administration navigation entry for non-admin staff', () => {
    auth.setUser(managerUser);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const links = Array.from(host.querySelectorAll('.nav-link') as NodeListOf<HTMLElement>).map(
      (link) => link.textContent?.trim(),
    );

    expect(links).toContain('Dashboard');
    expect(links).toContain('People');
    expect(links).not.toContain('Administration');
    expect(links).not.toContain('Historical Imports');
  });

  it('marks the active route in navigation', async () => {
    await router.navigateByUrl('/people');
    fixture.detectChanges();

    const activeLink = fixture.nativeElement.querySelector('.nav-link-active') as HTMLElement;

    expect(activeLink?.textContent).toContain('People');
    expect(activeLink?.getAttribute('aria-current')).toBe('page');
  });

  it('keeps logout functional from the shell', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.logout();

    expect(auth.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('keeps a compact app bar without a duplicate feature heading', async () => {
    await router.navigateByUrl('/people?q=amina&record_state=all');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.header h2')).toBeNull();
    expect(fixture.nativeElement.querySelector('.app-bar .menu-button')).not.toBeNull();
    (fixture.nativeElement.querySelector('.menu-button') as HTMLButtonElement).click();
    expect(component.menuOpen()).toBe(true);
  });

  it('lets other pages own their headings and marks their navigation active', async () => {
    await router.navigateByUrl('/administration');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.header')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-current="page"]').textContent).toContain('Administration');
  });

  it('opens a modal drawer, contains keyboard focus, and returns focus on Escape', async () => {
    component.narrow.set(true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const trigger = host.querySelector('.menu-button') as HTMLButtonElement;
    expect(host.querySelector('.sidebar')?.hasAttribute('inert')).toBe(true);
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('.sidebar')?.getAttribute('aria-modal')).toBe('true');
    expect(host.querySelector('main')?.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(host.querySelector('.nav-link-active'));
    const first = host.querySelector('.drawer-close') as HTMLButtonElement;
    const last = host.querySelector('.sign-out') as HTMLButtonElement;
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.menuOpen()).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes the drawer using its backdrop or a navigation link', async () => {
    component.narrow.set(true);
    component.toggleMenu();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.backdrop') as HTMLElement).click();
    expect(component.menuOpen()).toBe(false);
    component.toggleMenu();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.nav-link') as HTMLElement).click();
    expect(component.menuOpen()).toBe(false);
  });
});
