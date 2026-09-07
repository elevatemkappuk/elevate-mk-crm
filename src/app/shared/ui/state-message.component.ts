import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-state-message',
  imports: [CommonModule],
  template: `
    <section class="state-card" [class.state-card-error]="tone() === 'error'" aria-live="polite">
      @if (title()) {
        <h3>{{ title() }}</h3>
      }

      @if (message()) {
        <p>{{ message() }}</p>
      }

      @if (tone() === 'error' && secondaryMessage()) {
        <p class="secondary">{{ secondaryMessage() }}</p>
      }

      @if (tone() !== 'error' && secondaryMessage()) {
        <p class="secondary">{{ secondaryMessage() }}</p>
      }

      <div class="state-actions">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .state-card { display: grid; gap: var(--crm-space-3); min-height: 10rem; align-content: center; padding: var(--crm-space-4) var(--crm-space-5); border: 1px solid var(--crm-border); border-radius: var(--crm-radius-lg); background: var(--crm-surface); box-shadow: var(--crm-shadow-sm); }
    .state-card-error { background: var(--crm-error-surface); border-color: var(--crm-error); }
    h3, p { margin: 0; }
    h3 { font-size: var(--crm-font-base); font-weight: var(--crm-weight-medium); color: var(--crm-text-strong); }
    p { max-width: var(--crm-width-reading); line-height: var(--crm-leading); color: var(--crm-text-secondary); overflow-wrap: anywhere; }
    .secondary { color: var(--crm-text-muted); }
    .state-card-error h3, .state-card-error p { color: var(--crm-error); }
    .state-actions { display: flex; gap: var(--crm-space-3); flex-wrap: wrap; }
    .state-actions:empty { display: none; }
  `,
})
export class StateMessageComponent {
  readonly title = input<string>('');
  readonly message = input<string>('');
  readonly secondaryMessage = input<string>('');
  readonly tone = input<'default' | 'error'>('default');
}
