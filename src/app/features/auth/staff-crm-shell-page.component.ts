import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-staff-crm-shell-page',
  imports: [CommonModule],
  template: `
    <section class="shell">
      <div class="shell-card">
        <div>
          <p class="eyebrow">Elevate MK Staff CRM</p>
          <h1>{{ fullName() }}</h1>
          <p class="meta">{{ auth.currentUser()?.email }}</p>
        </div>

        <dl class="summary">
          <div>
            <dt>Person</dt>
            <dd>#{{ auth.currentUser()?.person?.id }}</dd>
          </div>
          <div>
            <dt>Primary email</dt>
            <dd>{{ auth.currentUser()?.person?.primary_email || 'Not set' }}</dd>
          </div>
          <div>
            <dt>Staff roles</dt>
            <dd>{{ auth.currentUser()?.staff_roles?.join(', ') }}</dd>
          </div>
        </dl>

        <div class="actions">
          <button type="button" (click)="logout()" [disabled]="submitting()">
            {{ submitting() ? 'Signing out...' : 'Sign out' }}
          </button>
        </div>
      </div>
    </section>
  `,
  styles: `
    .shell {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem;
    }

    .shell-card {
      width: min(100%, 52rem);
      display: grid;
      gap: 1.5rem;
      padding: 2rem;
      border-radius: 1.5rem;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(20, 42, 58, 0.12);
      box-shadow: 0 28px 70px rgba(18, 31, 43, 0.14);
      backdrop-filter: blur(18px);
    }

    .eyebrow {
      margin: 0 0 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-size: 0.72rem;
      color: #4a6678;
    }

    h1 {
      margin: 0;
      color: #152535;
      font-size: clamp(2rem, 4vw, 3.25rem);
    }

    .meta {
      margin: 0.5rem 0 0;
      color: #4d687a;
    }

    .summary {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      margin: 0;
    }

    .summary div {
      padding: 1rem;
      border-radius: 1rem;
      background: #f1f6f8;
    }

    dt {
      margin-bottom: 0.35rem;
      color: #547083;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    dd {
      margin: 0;
      color: #183044;
      font-weight: 700;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 0.9rem 1.25rem;
      font: inherit;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, #17354a, #275f74);
      cursor: pointer;
    }
  `,
})
export class StaffCrmShellPageComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly submitting = signal(false);

  fullName(): string {
    const person = this.auth.currentUser()?.person;
    return person ? `${person.first_name} ${person.last_name}` : 'Staff CRM';
  }

  logout(): void {
    this.submitting.set(true);
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => this.submitting.set(false),
      complete: () => this.submitting.set(false),
    });
  }
}
