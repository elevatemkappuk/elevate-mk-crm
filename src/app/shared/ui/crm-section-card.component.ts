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
    :host { display: block; }
    .section-card {
      display: grid;
      gap: var(--crm-space-4);
      padding: var(--crm-space-4) var(--crm-space-5);
      border: 1px solid var(--crm-border);
      border-radius: var(--crm-radius-lg);
      background: var(--crm-surface);
      box-shadow: var(--crm-shadow-sm);
    }
    .section-header, h3 { margin: 0; }
    h3 { color: var(--crm-text-strong); font-size: var(--crm-font-base); font-weight: var(--crm-weight-medium); line-height: var(--crm-leading-heading); }
    .section-body { min-width: 0; }
  `,
})
export class CrmSectionCardComponent {
  readonly title = input<string>('');
}
