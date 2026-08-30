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
    :host {
      display: block;
    }

    .state-card {
      display: grid;
      gap: 0.65rem;
      min-height: 10rem;
      align-content: center;
      padding: 1.2rem 1.25rem;
      border-radius: 1.1rem;
      border: 1px solid rgba(22, 39, 53, 0.08);
      background: rgba(255, 255, 255, 0.88);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 10px 24px rgba(17, 29, 40, 0.04);
    }

    .state-card-error {
      background: rgba(255, 250, 250, 0.94);
      border-color: rgba(184, 81, 81, 0.16);
    }

    h3,
    p {
      margin: 0;
    }

    h3 {
      font-size: 1.05rem;
      color: #1d3749;
    }

    p {
      max-width: 36rem;
      line-height: 1.5;
      color: #4f697b;
    }

    .state-card-error h3,
    .state-card-error p {
      color: #8b2626;
    }

    .secondary {
      color: #6c8392;
    }

    .state-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-top: 0.2rem;
    }
  `,
})
export class StateMessageComponent {
  readonly title = input<string>('');
  readonly message = input<string>('');
  readonly secondaryMessage = input<string>('');
  readonly tone = input<'default' | 'error'>('default');
}
