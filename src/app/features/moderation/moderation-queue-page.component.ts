import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { CommunityModerationService } from '../../core/community-moderation/community-moderation.service';
import { ModerationReport } from '../../core/community-moderation/community-moderation.types';
import { contentStatusLabel, reasonLabel, reportStatusLabel } from './moderation-helpers';

@Component({
  selector: 'app-moderation-queue-page',
  imports: [CommonModule, DatePipe, RouterLink],
  template: `
    <section class="page">
      <header class="heading"><div><p class="eyebrow">Community</p><h1>Moderation</h1><p class="intro">Review member reports and take bounded action on Community content.</p></div></header>
      @if (errorMessage() && reports().length) { <div class="partial-error" role="alert"><span>{{ errorMessage() }}</span><button class="crm-button crm-button--quiet" type="button" (click)="load()">Retry</button></div> }
      @if (loading()) { <section class="state-card" aria-live="polite"><p>Loading reports...</p></section> }
      @else if (errorMessage() && !reports().length) { <section class="state-card state-card-error" aria-live="polite"><p role="alert">{{ errorMessage() }}</p><button class="crm-button crm-button--secondary" type="button" (click)="load()">Retry</button></section> }
      @else if (!reports().length) { <section class="state-card"><h2>NO OPEN REPORTS</h2><p>There are currently no Community reports waiting for review.</p></section> }
      @else { <section class="list-card"><div class="table-wrap"><table aria-label="Open Community reports"><thead><tr><th scope="col">Report</th><th scope="col">Target</th><th scope="col">Reported member</th><th scope="col">Reported</th><th scope="col">State</th><th scope="col">Action</th></tr></thead><tbody>@for (report of reports(); track report.report_id) { <tr><td data-label="Report"><strong>{{ reasonLabel(report.reason) }}</strong><small>{{ report.details || 'No additional details' }}</small></td><td data-label="Target"><span class="type-label">{{ report.target.type }}</span><small>{{ excerpt(report.target.headline || report.target.body) }}</small></td><td data-label="Reported member">{{ fullName(report.target.author) }}<small>{{ report.target.author.job_title || report.target.author.location }}</small></td><td data-label="Reported">{{ report.created_at | date:'medium' }}</td><td data-label="State"><span class="state-label">{{ contentStatusLabel(report.target.status) }}</span></td><td data-label="Action"><a class="crm-button crm-button--secondary" [routerLink]="['/moderation', report.report_id]">Review</a></td></tr> }</tbody></table></div><nav class="pagination" aria-label="Report pages"><button class="crm-button crm-button--secondary" type="button" [disabled]="!previous() || loading()" (click)="load(page() - 1)">Previous</button><span>Page {{ page() }}</span><button class="crm-button crm-button--secondary" type="button" [disabled]="!next() || loading()" (click)="load(page() + 1)">Next</button></nav></section> }
    </section>
  `,
  styles: `:host{display:block}.page{display:grid;gap:var(--crm-space-4)}.heading{display:flex;justify-content:space-between;align-items:end;gap:1rem}h1,h2,p{margin:0}h1{color:var(--crm-text-strong);font-size:clamp(1.45rem,2.5vw,2rem)}h2{color:var(--crm-text-strong);font-size:var(--crm-font-lg)}.eyebrow{margin-bottom:.25rem;color:var(--crm-text-muted);font-size:var(--crm-font-sm);font-weight:700;text-transform:uppercase}.intro{margin-top:.45rem;color:var(--crm-text-secondary)}.list-card,.state-card{padding:1.2rem 1.25rem;border:1px solid var(--crm-border);border-radius:var(--crm-radius-lg);background:var(--crm-surface);box-shadow:var(--crm-shadow-sm)}.state-card{display:grid;gap:.8rem}.state-card-error{border-color:var(--crm-error)}.partial-error{display:flex;justify-content:space-between;gap:var(--crm-space-3);padding:var(--crm-space-3) var(--crm-space-4);border:1px solid var(--crm-error);border-radius:var(--crm-radius-md);color:var(--crm-error);background:var(--crm-error-surface)}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{padding:.85rem .7rem;border-bottom:1px solid var(--crm-border);text-align:left;vertical-align:top;overflow-wrap:anywhere}th{color:var(--crm-text-muted);font-size:var(--crm-font-sm)}td{color:var(--crm-text-secondary)}td small{display:block;margin-top:.25rem;color:var(--crm-text-muted);line-height:1.4}.type-label,.state-label{font-weight:700;color:var(--crm-text-strong)}.pagination{display:flex;align-items:center;justify-content:flex-end;gap:var(--crm-space-3);padding-top:var(--crm-space-4)}@media(max-width:700px){.heading{align-items:start;flex-direction:column}.partial-error{align-items:flex-start;flex-direction:column}th{display:none}td{display:grid;grid-template-columns:8rem minmax(0,1fr);gap:.6rem}td::before{content:attr(data-label);color:var(--crm-text-muted);font-size:var(--crm-font-sm);font-weight:700}.pagination{justify-content:flex-start;flex-wrap:wrap}}`,
})
export class ModerationQueuePageComponent {
  private readonly service = inject(CommunityModerationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly reports = signal<ModerationReport[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly page = signal(1);
  readonly next = signal<string | null>(null);
  readonly previous = signal<string | null>(null);
  constructor() { this.load(); }
  load(page = this.page()): void { this.loading.set(true); this.errorMessage.set(null); this.service.list(page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: value => { this.reports.set(value.results); this.page.set(page); this.next.set(value.next); this.previous.set(value.previous); this.loading.set(false); }, error: (_error: HttpErrorResponse) => { this.loading.set(false); this.errorMessage.set('Reports could not be loaded right now. Try again.'); } }); }
  reasonLabel = reasonLabel;
  contentStatusLabel = contentStatusLabel;
  reportStatusLabel = reportStatusLabel;
  fullName(identity: { first_name: string; last_name: string }): string { return `${identity.first_name} ${identity.last_name}`.trim(); }
  excerpt(value: string): string { return value.length > 100 ? `${value.slice(0, 100).trim()}…` : value; }
}
