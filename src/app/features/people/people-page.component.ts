import { Component } from '@angular/core';

@Component({
  selector: 'app-people-page',
  template: `
    <section class="workspace">
      <p class="eyebrow">People</p>
      <h2>People will be the core Staff CRM workspace.</h2>
      <p>
        This placeholder marks the entry point for the upcoming person record, search, and
        relationship workflows.
      </p>
    </section>
  `,
  styles: `
    .workspace {
      display: grid;
      gap: 1rem;
      padding: 1.5rem;
      border-radius: 1.25rem;
      border: 1px solid rgba(22, 39, 53, 0.08);
      background: rgba(255, 255, 255, 0.82);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .eyebrow {
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.75rem;
      color: #617d90;
    }

    h2 {
      margin: 0;
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      color: #193042;
    }

    p {
      margin: 0;
      max-width: 42rem;
      line-height: 1.7;
      color: #4f697b;
    }
  `,
})
export class PeoplePageComponent {}
