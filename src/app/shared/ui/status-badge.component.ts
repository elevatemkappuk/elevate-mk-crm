import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

export type StatusBadgeTone = 'default' | 'archived' | 'info' | 'warning' | 'success' | 'neutral' | 'muted';

@Component({
  selector: 'app-status-badge',
  imports: [CommonModule],
  template: ` <span class="status-badge" [attr.data-tone]="tone()" [class.status-badge-archived]="tone() === 'archived'">{{ label() }}</span> `,
  styles: `
    :host { display: inline-flex; max-width: 100%; }
    .status-badge { display: inline-flex; align-items: center; min-height: var(--crm-control-height-sm); padding: var(--crm-space-1) var(--crm-space-3); border-radius: var(--crm-radius-pill); background: var(--crm-surface-subtle); color: var(--crm-text-secondary); font-size: var(--crm-font-sm); font-weight: var(--crm-weight-medium); line-height: var(--crm-leading-heading); overflow-wrap: anywhere; }
    .status-badge-archived { background: var(--crm-warning-surface); color: var(--crm-warning); }
    [data-tone='info'] { background: var(--crm-info-surface); color: var(--crm-info); }
    [data-tone='warning'] { background: var(--crm-warning-surface); color: var(--crm-warning); }
    [data-tone='success'] { background: var(--crm-success-surface); color: var(--crm-success); }
    [data-tone='neutral'] { background: #f0f1f3; color: #4b5563; }
    [data-tone='muted'] { background: #e3e6e9; color: #39434e; }
  `,
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly tone = input<StatusBadgeTone>('default');
}
