import { CommonModule, DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, ElementRef, HostListener, inject, Injector, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

interface NavigationItem {
  label: string;
  path: string;
  icon: string;
  group: 'Workspace' | 'Management';
}

@Component({
  selector: 'app-staff-crm-shell-page',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="shell">
      <aside #sidebar id="crm-navigation" class="sidebar" [class.sidebar-open]="menuOpen()"
        [attr.inert]="narrow() && !menuOpen() ? '' : null"
        [attr.role]="narrow() && menuOpen() ? 'dialog' : null"
        [attr.aria-modal]="narrow() && menuOpen() ? 'true' : null" aria-label="Staff CRM">
        <div class="brand">
          <div class="logo"><img src="/branding/logo.png" alt="Elevate MK" /></div>
          <p>Staff CRM</p>
        </div>
        <button class="drawer-close" type="button" (click)="closeMenu()" aria-label="Close navigation menu">Close</button>
        <nav class="nav" aria-label="Staff CRM navigation">
          @for (group of groups; track group) {
            @if (hasGroup(group)) {
              <div class="nav-group">
                <p class="group-label">{{ group }}</p>
                @for (item of navigationItems(); track item.path) {
                  @if (item.group === group) {
                    <a [routerLink]="item.path" routerLinkActive="nav-link-active"
                      [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page"
                      class="nav-link" (click)="closeMenu()">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="item.icon" /></svg>
                      <span>{{ item.label }}</span>
                    </a>
                  }
                }
              </div>
            }
          }
        </nav>
        <section class="user-panel" aria-label="Your account">
          <div class="identity">
            <span class="avatar" aria-hidden="true">{{ initials() }}</span>
            <div class="user-details">
              <p class="user-name">{{ fullName() }}</p>
              <p class="user-email" [title]="auth.currentUser()?.email || ''">{{ auth.currentUser()?.email }}</p>
            </div>
          </div>
          <button class="sign-out" type="button" (click)="logout()" [disabled]="submitting()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H4v16h6M8 12h13m-5-5 5 5-5 5" /></svg>
            {{ submitting() ? 'Signing out...' : 'Sign out' }}
          </button>
        </section>
      </aside>
      @if (narrow() && menuOpen()) {
        <div class="backdrop" aria-hidden="true" (click)="closeMenu()"></div>
      }
      <main class="main" [attr.inert]="narrow() && menuOpen() ? '' : null">
        <header class="app-bar">
          <span>Elevate MK <small>Staff CRM</small></span>
          <button #menuTrigger type="button" class="menu-button" aria-label="Open navigation menu"
            [attr.aria-expanded]="menuOpen()" aria-controls="crm-navigation" (click)="toggleMenu()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>Menu
          </button>
        </header>
        <section class="content"><router-outlet /></section>
      </main>
    </div>
  `,
  styleUrl: './staff-crm-shell-page.component.scss',
})
export class StaffCrmShellPageComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly sidebar = viewChild<ElementRef<HTMLElement>>('sidebar');
  private readonly menuTrigger = viewChild<ElementRef<HTMLButtonElement>>('menuTrigger');
  readonly submitting = signal(false);
  readonly menuOpen = signal(false);
  // Matches the shared SCSS medium breakpoint.
  readonly narrow = signal(this.document.defaultView?.matchMedia('(max-width: 900px)').matches ?? false);
  readonly groups = ['Workspace', 'Management'] as const;

  readonly navigationItems = computed<NavigationItem[]>(() => {
    const items: NavigationItem[] = [{
      label: 'People', path: '/people', group: 'Workspace',
      icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 7m1 4a4 4 0 0 1 4 4v2',
    }];
    if (this.auth.isCrmAdmin()) {
      items.push({ label: 'Historical Imports', path: '/imports', group: 'Management', icon: 'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7' });
      items.push({ label: 'Administration', path: '/administration', group: 'Management', icon: 'm9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8' });
    }
    return items;
  });

  hasGroup(group: NavigationItem['group']): boolean {
    return this.navigationItems().some(item => item.group === group);
  }

  fullName(): string {
    const person = this.auth.currentUser()?.person;
    return person ? `${person.first_name} ${person.last_name}` : 'Staff CRM';
  }

  initials(): string {
    const person = this.auth.currentUser()?.person;
    return person ? ((person.first_name?.[0] || '') + (person.last_name?.[0] || '')).toUpperCase() : 'MK';
  }

  @HostListener('window:resize')
  updateViewport(): void {
    this.narrow.set(this.document.defaultView?.matchMedia('(max-width: 900px)').matches ?? false);
    if (!this.narrow()) this.menuOpen.set(false);
  }

  toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu();
      return;
    }
    this.menuOpen.set(true);
    afterNextRender(() => {
      if (this.menuOpen() && this.narrow()) this.sidebar()?.nativeElement.querySelector<HTMLElement>('.nav-link-active, .nav-link')?.focus();
    }, { injector: this.injector });
  }

  closeMenu(): void {
    const restore = this.menuOpen() && this.narrow();
    this.menuOpen.set(false);
    if (restore) afterNextRender(() => this.menuTrigger()?.nativeElement.focus(), { injector: this.injector });
  }

  @HostListener('document:keydown', ['$event'])
  handleDrawerKey(event: KeyboardEvent): void {
    if (!this.menuOpen() || !this.narrow()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeMenu();
    } else if (event.key === 'Tab') {
      const controls = this.sidebar()?.nativeElement.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && this.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && this.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  logout(): void {
    this.submitting.set(true);
    this.auth.logout().subscribe({
      next: () => {
        this.closeMenu();
        void this.router.navigateByUrl('/login');
      },
      error: () => this.submitting.set(false),
      complete: () => this.submitting.set(false),
    });
  }
}
