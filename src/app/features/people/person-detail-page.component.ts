import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-person-detail-page',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="detail-card">
      <p class="eyebrow">Person</p>
      <h2>Person {{ personId }}</h2>
      <p>The 360-degree person profile will be implemented next.</p>
      <a routerLink="/people">Back to People</a>
    </section>
  `,
  styles: `
    .detail-card {
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

    h2,
    p,
    a {
      margin: 0;
    }

    h2 {
      font-size: clamp(1.5rem, 3vw, 2rem);
      color: #193042;
    }

    p {
      color: #4f697b;
      line-height: 1.7;
    }

    a {
      width: fit-content;
      color: #1a5267;
      font-weight: 700;
      text-decoration: none;
    }
  `,
})
export class PersonDetailPageComponent {
  private readonly route = inject(ActivatedRoute);

  get personId(): string {
    return this.route.snapshot.paramMap.get('id') ?? 'Unknown';
  }
}
