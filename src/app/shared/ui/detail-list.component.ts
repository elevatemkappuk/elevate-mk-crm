import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

export interface DetailListItem {
  label: string;
  value: string | null | undefined;
}

@Component({
  selector: 'app-detail-list',
  imports: [CommonModule],
  template: `
    <dl class="detail-list">
      @for (item of items(); track item.label) {
        <div class="detail-row">
          <dt>{{ item.label }}</dt>
          <dd>{{ displayValue(item.value) }}</dd>
        </div>
      }
    </dl>
  `,
  styles: `
    @use '../../../styles/breakpoints' as bp;
    :host { display: block; }
    .detail-list { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--crm-space-4) var(--crm-space-5); }
    .detail-row { display: grid; gap: var(--crm-space-1); align-content: start; }
    dt, dd { margin: 0; }
    dt { font-size: var(--crm-font-sm); font-weight: var(--crm-weight-medium); color: var(--crm-text-muted); }
    dd { line-height: var(--crm-leading); color: var(--crm-text-strong); overflow-wrap: anywhere; }
    @media (max-width: bp.$compact) { .detail-list { grid-template-columns: 1fr; } }
  `,
})
export class DetailListComponent {
  readonly items = input.required<DetailListItem[]>();

  displayValue(value: string | null | undefined): string {
    return value && value.trim() ? value : 'Not provided';
  }
}
