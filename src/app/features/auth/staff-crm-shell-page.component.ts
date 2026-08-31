import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

interface NavigationItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-staff-crm-shell-page',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="shell">
      <aside class="sidebar" [class.sidebar-open]="menuOpen()">
        <div class="brand">
          <p>Elevate MK</p>
          <h1>Staff CRM</h1>
        </div>

        <nav class="nav" aria-label="Staff CRM navigation">
          @for (item of navigationItems(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="nav-link-active"
              [routerLinkActiveOptions]="{ exact: true }"
              class="nav-link"
              (click)="closeMenu()"
            >
              {{ item.label }}
            </a>
          }
        </nav>

        <section class="user-panel">
          <p class="user-name">{{ fullName() }}</p>
          <p class="user-email">{{ auth.currentUser()?.email }}</p>
          <button type="button" (click)="logout()" [disabled]="submitting()">
            {{ submitting() ? 'Signing out...' : 'Sign out' }}
          </button>
        </section>
      </aside>

      @if (menuOpen()) {
        <button
          type="button"
          class="backdrop"
          aria-label="Close navigation menu"
          (click)="closeMenu()"
        ></button>
      }

      <main class="main">
        <header class="header">
          <div>
            <p class="eyebrow">Elevate MK Staff CRM</p>
            <h2>{{ pageTitle() }}</h2>
          </div>

          <div class="header-actions">
            <button
              type="button"
              class="menu-button"
              aria-label="Open navigation menu"
              (click)="toggleMenu()"
            >
              Menu
            </button>
          </div>
        </header>

        <section class="content">
          <router-outlet />
        </section>
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }

    .shell {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 18rem minmax(0, 1fr);
      position: relative;
    }

    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 1.5rem;
      padding: 1.75rem 1.25rem;
      background: rgba(19, 37, 52, 0.94);
      color: #f7fafc;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      z-index: 3;
    }

    .brand p,
    .eyebrow,
    .user-email {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-size: 0.72rem;
    }

    .brand p {
      color: rgba(207, 229, 239, 0.74);
    }

    .brand h1 {
      margin: 0.5rem 0 0;
      font-size: 1.75rem;
      line-height: 1.15;
      color: #ffffff;
    }

    .nav {
      display: grid;
      align-content: start;
      gap: 0.45rem;
    }

    .nav-link {
      display: block;
      padding: 0.9rem 1rem;
      border-radius: 0.95rem;
      color: rgba(232, 243, 248, 0.9);
      font-weight: 600;
      text-decoration: none;
      transition: background-color 120ms ease, color 120ms ease;
    }

    .nav-link:hover,
    .nav-link:focus-visible {
      background: rgba(125, 175, 196, 0.18);
      color: #fff;
      outline: none;
    }

    .nav-link-active {
      background: linear-gradient(135deg, rgba(77, 130, 151, 0.85), rgba(48, 91, 110, 0.95));
      color: #fff;
      box-shadow: 0 10px 24px rgba(6, 20, 28, 0.22);
    }

    .user-panel {
      display: grid;
      gap: 0.6rem;
      padding: 1rem;
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.08);
    }

    .user-name {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
    }

    .user-email {
      color: rgba(209, 227, 235, 0.85);
      word-break: break-word;
    }

    .sidebar button,
    .menu-button {
      border: 0;
      border-radius: 999px;
      padding: 0.8rem 1rem;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .sidebar button {
      color: #173248;
      background: #f3f7f9;
    }

    .main {
      min-width: 0;
      padding: 1.25rem;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 1rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 1.4rem;
      border-radius: 1.35rem;
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid rgba(21, 40, 55, 0.08);
      box-shadow: 0 18px 38px rgba(17, 29, 40, 0.08);
      backdrop-filter: blur(16px);
    }

    .eyebrow {
      color: #607b8d;
    }

    .header h2 {
      margin: 0.45rem 0 0;
      font-size: clamp(1.55rem, 3vw, 2.35rem);
      color: #1a3142;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .menu-button {
      display: none;
      color: #fff;
      background: linear-gradient(135deg, #18354a, #2f6f84);
    }

    .content {
      min-width: 0;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      border: 0;
      background: rgba(12, 21, 31, 0.45);
      z-index: 2;
    }

    @media (max-width: 900px) {
      .shell {
        grid-template-columns: minmax(0, 1fr);
      }

      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        transform: translateX(-100%);
        width: min(20rem, calc(100vw - 3rem));
        transition: transform 160ms ease;
      }

      .sidebar-open {
        transform: translateX(0);
      }

      .menu-button {
        display: inline-flex;
        justify-content: center;
        align-items: center;
      }
    }
  `,
})
export class StaffCrmShellPageComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly submitting = signal(false);
  readonly menuOpen = signal(false);

  readonly navigationItems = computed<NavigationItem[]>(() => {
    const items: NavigationItem[] = [{ label: 'People', path: '/people' }];

    if (this.auth.isCrmAdmin()) {
      items.push({ label: 'Administration', path: '/administration' });
    }

    return items;
  });

  fullName(): string {
    const person = this.auth.currentUser()?.person;
    return person ? `${person.first_name} ${person.last_name}` : 'Staff CRM';
  }

  pageTitle(): string {
    if (this.router.url.startsWith('/administration')) {
      return 'Administration';
    }

    if (this.router.url.startsWith('/people/new/member')) {
      return 'Add Member';
    }

    if (this.router.url.startsWith('/people/new/contact')) {
      return 'Add Contact';
    }

    if (this.router.url.endsWith('/edit')) {
      return 'Edit Person';
    }

    if (this.router.url.startsWith('/people/')) {
      return 'Person';
    }

    return 'People';
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
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
