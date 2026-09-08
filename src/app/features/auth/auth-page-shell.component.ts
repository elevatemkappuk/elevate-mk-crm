import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-auth-page-shell',
  host: { class: 'auth-shell' },
  template: `
    <main class="auth-layout">
      <div class="auth-experience">
        <header class="auth-brand">
          <div class="auth-logo">
            <img src="/branding/logo.png" alt="Elevate MK" width="500" height="500" fetchpriority="high" />
          </div>
          <p>Staff CRM</p>
        </header>
        <section class="auth-card"><ng-content /></section>
      </div>
    </main>
  `,
  // Scope projected form styles to the host class, keeping emitted selectors compact.
  encapsulation: ViewEncapsulation.None,
  styleUrl: './auth-page-shell.component.scss',
})
export class AuthPageShellComponent {}
