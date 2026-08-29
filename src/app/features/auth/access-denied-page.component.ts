import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  template: `
    <section class="denied">
      <div class="card">
        <p class="eyebrow">Access denied</p>
        <h1>Staff CRM access is not assigned.</h1>
        <p>
          Your account is authenticated, but it does not currently hold one of the CRM staff roles
          required for this application.
        </p>
        <a routerLink="/login">Return to sign-in</a>
      </div>
    </section>
  `,
  styles: `
    .denied {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem;
    }

    .card {
      width: min(100%, 34rem);
      padding: 2rem;
      border-radius: 1.25rem;
      background: rgba(255, 251, 247, 0.92);
      border: 1px solid rgba(128, 75, 17, 0.16);
      box-shadow: 0 28px 60px rgba(49, 35, 18, 0.12);
    }

    .eyebrow {
      margin: 0 0 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.72rem;
      color: #8c611b;
    }

    h1 {
      margin: 0 0 0.75rem;
      color: #3d2a0f;
    }

    p {
      margin: 0 0 1rem;
      line-height: 1.65;
      color: #68461a;
    }

    a {
      color: #5c3d14;
      font-weight: 700;
    }
  `,
})
export class AccessDeniedPageComponent {}
