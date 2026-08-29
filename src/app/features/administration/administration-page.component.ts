import { Component } from '@angular/core';

@Component({
  selector: 'app-administration-page',
  template: `
    <section class="workspace">
      <p class="eyebrow">Administration</p>
      <h2>Administration tools will live here for CRM administrators.</h2>
      <p>
        This placeholder reserves the admin-only workspace for future staff access and controlled
        reference-data management features.
      </p>
    </section>
  `,
  styles: `
    .workspace {
      display: grid;
      gap: 1rem;
      padding: 1.5rem;
      border-radius: 1.25rem;
      border: 1px solid rgba(57, 47, 18, 0.08);
      background: rgba(255, 250, 244, 0.9);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
    }

    .eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.75rem;
      color: #8b6519;
    }

    h2 {
      margin: 0;
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      color: #443117;
    }

    p {
      margin: 0;
      max-width: 42rem;
      line-height: 1.7;
      color: #6f5220;
    }
  `,
})
export class AdministrationPageComponent {}
