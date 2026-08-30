import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  imports: [CommonModule],
  template: ` <span class="status-badge" [class.status-badge-archived]="tone() === 'archived'">{{ label() }}</span> `,
  styles: `
    :host {
      display: inline-flex;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      min-height: 1.8rem;
      padding: 0.2rem 0.7rem;
      border-radius: 999px;
      background: rgba(34, 79, 102, 0.09);
      color: #21465b;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .status-badge-archived {
      background: rgba(144, 88, 46, 0.12);
      color: #805028;
    }
  `,
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly tone = input<'default' | 'archived'>('default');
}
