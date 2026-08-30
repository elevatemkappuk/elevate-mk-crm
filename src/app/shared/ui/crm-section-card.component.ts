import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-crm-section-card',
  imports: [CommonModule],
  template: `
    <section class="section-card">
      @if (title()) {
        <header class="section-header">
          <h3>{{ title() }}</h3>
        </header>
      }

      <div class="section-body">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .section-card {
      display: grid;
      gap: 0.9rem;
      padding: 1.15rem 1.25rem;
      border-radius: 1.1rem;
      border: 1px solid rgba(22, 39, 53, 0.08);
      background: rgba(255, 255, 255, 0.88);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 10px 24px rgba(17, 29, 40, 0.04);
    }

    .section-header,
    h3 {
      margin: 0;
    }

    h3 {
      font-size: 1rem;
      line-height: 1.3;
      color: #1d3749;
    }

    .section-body {
      min-width: 0;
    }
  `,
})
export class CrmSectionCardComponent {
  readonly title = input<string>('');
}
