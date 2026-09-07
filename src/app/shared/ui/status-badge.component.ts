import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  imports: [CommonModule],
  template: ` <span class="status-badge" [class.status-badge-archived]="tone() === 'archived'">{{ label() }}</span> `,
  styles: `
    :host { display: inline-flex; max-width: 100%; }
    .status-badge { display: inline-flex; align-items: center; min-height: var(--crm-control-height-sm); padding: var(--crm-space-1) var(--crm-space-3); border-radius: var(--crm-radius-pill); background: var(--crm-surface-subtle); color: var(--crm-text-secondary); font-size: var(--crm-font-sm); font-weight: var(--crm-weight-medium); line-height: var(--crm-leading-heading); overflow-wrap: anywhere; }
    .status-badge-archived { background: var(--crm-warning-surface); color: var(--crm-warning); }
  `,
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly tone = input<'default' | 'archived'>('default');
}
