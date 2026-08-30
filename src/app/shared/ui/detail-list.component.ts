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
    :host {
      display: block;
    }

    .detail-list {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.9rem 1.25rem;
    }

    .detail-row {
      display: grid;
      gap: 0.22rem;
      align-content: start;
      padding: 0.1rem 0;
    }

    dt,
    dd {
      margin: 0;
    }

    dt {
      font-size: 0.8rem;
      font-weight: 700;
      color: #617b8c;
    }

    dd {
      line-height: 1.45;
      color: #203a4c;
      word-break: break-word;
    }

    @media (max-width: 680px) {
      .detail-list {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DetailListComponent {
  readonly items = input.required<DetailListItem[]>();

  displayValue(value: string | null | undefined): string {
    return value && value.trim() ? value : 'Not provided';
  }
}
