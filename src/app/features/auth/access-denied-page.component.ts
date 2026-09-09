import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import { AuthPageShellComponent } from './auth-page-shell.component';

@Component({
  selector: 'app-access-denied-page',
  imports: [AuthPageShellComponent],
  template: `
    <app-auth-page-shell>
      <div class="auth-heading access-denied-heading">
        <p class="eyebrow">Access denied</p>
        <h1>Staff CRM access is not assigned.</h1>
        <p>
          Your account is authenticated, but it does not currently hold one of the CRM staff roles
          required for this application.
        </p>
      </div>
      <div class="access-denied-actions">
        <button
          class="crm-button crm-button--primary auth-submit crm-focusable"
          type="button"
          (click)="returnToSignIn()"
          [disabled]="signingOut()"
          [attr.aria-busy]="signingOut()"
          aria-live="polite"
        >
          {{ signingOut() ? 'Signing out…' : 'Return to sign-in' }}
        </button>
      </div>
    </app-auth-page-shell>
  `,
  styles: `
    .eyebrow {
      margin: 0 0 var(--crm-space-2);
      text-transform: uppercase;
      letter-spacing: 0.16em;
      font-size: var(--crm-font-sm);
      font-weight: var(--crm-weight-medium);
      color: var(--crm-warning);
    }

    .access-denied-heading {
      margin-bottom: var(--crm-space-6);
    }

    .access-denied-heading h1 {
      max-width: 18ch;
    }

    .access-denied-heading p:last-child {
      max-width: 30rem;
    }

    .access-denied-actions {
      display: grid;
      gap: var(--crm-space-3);
    }

    @media (max-width: 34rem) {
      .access-denied-heading h1 {
        max-width: none;
      }
    }
  `,
})
export class AccessDeniedPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly signingOut = signal(false);

  returnToSignIn(): void {
    if (this.signingOut()) {
      return;
    }

    this.signingOut.set(true);
    this.auth.logout().pipe(
      catchError(() => {
        // The server session may already be gone. Clear local state so the
        // user can still choose another account instead of being trapped.
        this.auth.clearUserState();
        return of(void 0);
      }),
      finalize(() => this.signingOut.set(false)),
    ).subscribe(() => {
      void this.router.navigateByUrl('/login');
    });
  }
}
