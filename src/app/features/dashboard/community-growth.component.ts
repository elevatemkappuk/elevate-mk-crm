import { Component, computed, input } from '@angular/core';
import { DashboardProjection } from '../../core/dashboard/dashboard.types';

@Component({
  selector: 'app-community-growth',
  template: `
    <p class="legend"><span><i class="people-key" aria-hidden="true"></i>People added</span><span><i class="members-key" aria-hidden="true"></i>Members joined</span></p>
    <svg viewBox="0 0 600 310" role="img" aria-label="Six-month community growth. Exact values are available in the monthly values table below.">
      <defs><pattern id="member-stripes" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#ffda70"/><path d="M0 0L6 6" stroke="#805014" stroke-width="1"/></pattern></defs>
      <path d="M10 265H590" stroke="currentColor" opacity=".3" />
      @for (row of rows(); track row.month; let i = $index) {
        <rect [attr.x]="i * 98 + 26" [attr.y]="265 - height(row.people)" width="24" [attr.height]="height(row.people)" fill="#245b78" />
        <rect [attr.x]="i * 98 + 54" [attr.y]="265 - height(row.members)" width="24" [attr.height]="height(row.members)" fill="url(#member-stripes)" />
        <text [attr.x]="i * 98 + 38" [attr.y]="253 - height(row.people)" text-anchor="middle">{{ row.people }}</text>
        <text [attr.x]="i * 98 + 66" [attr.y]="253 - height(row.members)" text-anchor="middle">{{ row.members }}</text>
        <text [attr.x]="i * 98 + 52" y="294" text-anchor="middle">{{ monthLabel(row.month) }}</text>
      }
    </svg>
    <details><summary>View monthly values</summary><table class="crm-table"><caption>Community growth by calendar month: CRM entry dates for People added; membership join dates for Members joined.</caption><thead><tr><th scope="col">Month</th><th scope="col">People added</th><th scope="col">Members joined</th></tr></thead><tbody>@for (row of rows(); track row.month) { <tr><th scope="row">{{ row.month }}</th><td>{{ row.people }}</td><td>{{ row.members }}</td></tr> }</tbody></table></details>
  `,
  styles: `
    :host { display:block; min-width:0; } svg { display:block; width:100%; height:auto; overflow:visible; color:var(--crm-text-secondary); }
    text { fill:var(--crm-text-strong); font:14px var(--crm-font-family); }
    .legend { display:flex; flex-wrap:wrap; gap:var(--crm-space-4); margin:0 0 var(--crm-space-2); font-size:var(--crm-font-sm); }
    .legend span { display:inline-flex; align-items:center; gap:var(--crm-space-2); }
    .legend i { width:var(--crm-space-3); height:var(--crm-space-3); border-radius:2px; }
    .people-key { background:var(--crm-info); }
    .members-key { background:repeating-linear-gradient(45deg,var(--crm-shell-accent) 0 3px,var(--crm-warning) 3px 4px); }
    .legend span:first-child { color:var(--crm-info); } .legend span:last-child { color:var(--crm-warning); }
    details { margin-top:var(--crm-space-3); font-size:var(--crm-font-sm); } summary { cursor:pointer; color:var(--crm-text-secondary); padding-block:var(--crm-space-2); }
    summary:focus-visible { outline:2px solid var(--crm-focus-ring); outline-offset:3px; } table { width:100%; } caption { text-align:left; margin:.75rem 0; }
  `,
})
export class CommunityGrowthComponent {
  readonly growth = input.required<DashboardProjection['growth']>();
  readonly rows = computed(() => this.growth().people_by_month.map(row => ({ month: row.month, people: row.count, members: this.growth().members_by_month.find(member => member.month === row.month)?.count ?? 0 })));
  readonly maximum = computed(() => Math.max(1, ...this.rows().flatMap(row => [row.people, row.members])));
  height(count: number) { return count / this.maximum() * 225; }
  monthLabel(month: string) { return new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)); }
}
