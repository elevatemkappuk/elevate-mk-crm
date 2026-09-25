import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { canManagePeople } from '../../core/auth/auth-access';
import { CampaignService } from '../../core/marketing/campaign.service';
import { Campaign, CampaignRecipientSnapshot, campaignCriteriaSummary } from '../../core/marketing/campaign.types';
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-campaign-detail-page',
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page">
      <a class="back-link" routerLink="/marketing/campaigns">Back to Campaigns</a>
      @if (loading()) { <section class="state-card"><p>Loading campaign...</p></section> }
      @else if (errorMessage() && !campaign()) { <section class="state-card state-card-error"><p>{{ errorMessage() }}</p><a class="crm-button crm-button--secondary" routerLink="/marketing/campaigns">Back to Campaigns</a></section> }
      @else if (campaign(); as current) {
        <header class="heading"><div><p class="eyebrow">Campaign review</p><h1>{{ current.name }}</h1><p class="intro">Recipients are determined from the saved audience criteria and re-checked when prepared.</p></div><app-status-badge [label]="current.status" [tone]="statusTone(current.status)" /></header>
        @if (errorMessage()) { <p class="error" role="alert">{{ errorMessage() }}</p> }
        <section class="grid"><article class="card"><h2>Audience</h2><ul>@for (item of criteriaSummary(current); track item) { <li>{{ item }}</li> }</ul></article><article class="card"><h2>Preparation</h2>@if (current.current_preparation; as prep) { <dl><div><dt>Status</dt><dd>{{ prep.status }}</dd></div><div><dt>Selected</dt><dd>{{ prep.selected_count }}</dd></div><div><dt>Included</dt><dd>{{ prep.included_count }}</dd></div><div><dt>Excluded</dt><dd>{{ prep.excluded_count }}</dd></div></dl> } @else { <p>Recipients have not been prepared yet.</p> }</article></section>
        @if (current.status === 'DRAFT' && canManage()) { <button class="crm-button crm-button--primary" type="button" [disabled]="preparing()" (click)="prepare()">{{ preparing() ? 'Preparing recipients...' : 'Prepare recipients' }}</button> }
        @if (current.current_preparation?.status === 'SNAPSHOT_READY' || current.current_preparation?.status === 'PREPARED') { <section class="card"><h2>Recipients</h2><p class="note">This is the backend-authoritative preparation snapshot. Decisions cannot be edited here.</p>@if (recipientsLoading()) { <p>Loading recipients...</p> } @else if (recipients().length) { <div class="table-wrap"><table><thead><tr><th>Name</th><th>Decision</th><th>Reason</th></tr></thead><tbody>@for (recipient of recipients(); track recipient.id) { <tr><td>{{ recipient.first_name_snapshot }} {{ recipient.last_name_snapshot }}</td><td><app-status-badge [label]="recipient.decision" [tone]="recipient.decision === 'INCLUDED' ? 'success' : 'warning'" /></td><td>{{ recipient.exclusion_reason || '—' }}</td></tr>}</tbody></table></div> } @else { <p>No recipient snapshot rows were returned.</p> }</section> }
      }
    </section>
  `,
  styles: `
    :host { display:block; } .page { display:grid; gap:var(--crm-space-4); } .back-link { color:var(--crm-text-secondary); font-weight:600; } .heading { display:flex; justify-content:space-between; align-items:end; gap:1rem; } h1,h2,p { margin:0; } h1 { color:var(--crm-text-strong); font-size:clamp(1.45rem,2.5vw,2rem); } h2 { color:var(--crm-text-strong); font-size:var(--crm-font-lg); } .eyebrow { margin-bottom:.25rem; color:var(--crm-text-muted); font-size:var(--crm-font-sm); font-weight:700; text-transform:uppercase; } .intro,.note { margin-top:.45rem; color:var(--crm-text-secondary); } .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--crm-space-4); } .card,.state-card { display:grid; gap:.8rem; padding:1.2rem 1.25rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-lg); background:var(--crm-surface); box-shadow:var(--crm-shadow-sm); } .state-card-error,.error { border-color:var(--crm-error); color:var(--crm-error); } ul { display:grid; gap:.45rem; margin:0; padding-left:1.2rem; color:var(--crm-text-secondary); } dl { display:grid; gap:.55rem; margin:0; } dl div { display:flex; justify-content:space-between; gap:1rem; border-bottom:1px solid var(--crm-border); padding-bottom:.4rem; } dt { color:var(--crm-text-muted); } dd { margin:0; color:var(--crm-text-strong); font-weight:700; } .table-wrap { overflow-x:auto; } table { width:100%; border-collapse:collapse; } th,td { padding:.75rem .5rem; border-bottom:1px solid var(--crm-border); text-align:left; } th { color:var(--crm-text-muted); font-size:var(--crm-font-sm); } td { color:var(--crm-text-secondary); } @media (max-width:700px) { .heading { align-items:start; flex-direction:column; } .grid { grid-template-columns:1fr; } }
  `,
})
export class CampaignDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(CampaignService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly campaign = signal<Campaign | null>(null);
  readonly recipients = signal<CampaignRecipientSnapshot[]>([]);
  readonly loading = signal(true);
  readonly recipientsLoading = signal(false);
  readonly preparing = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly canManage = () => canManagePeople(this.auth.currentUser());

  constructor() { this.load(); }
  load(): void { const id = Number(this.route.snapshot.paramMap.get('id')); this.loading.set(true); this.service.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (campaign) => { this.campaign.set(campaign); this.loading.set(false); if (campaign.current_preparation?.status === 'SNAPSHOT_READY' || campaign.current_preparation?.status === 'PREPARED') this.loadRecipients(id); }, error: (_error: HttpErrorResponse) => { this.loading.set(false); this.errorMessage.set('This campaign could not be loaded right now.'); } }); }
  prepare(): void { const id = this.campaign()?.id; if (!id || this.preparing()) return; this.preparing.set(true); this.errorMessage.set(null); this.service.prepare(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (campaign) => { this.campaign.set(campaign); this.preparing.set(false); this.loadRecipients(id); }, error: (error: HttpErrorResponse) => { this.preparing.set(false); this.errorMessage.set(error.status === 409 ? 'This campaign cannot be prepared in its current state.' : 'Recipients could not be prepared right now.'); } }); }
  loadRecipients(id: number): void { this.recipientsLoading.set(true); this.service.recipients(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (page) => { this.recipients.set(page.results); this.recipientsLoading.set(false); }, error: () => this.recipientsLoading.set(false) }); }
  criteriaSummary(campaign: Campaign): string[] { return campaignCriteriaSummary(campaign.audience_selection); }
  statusTone(status: string): StatusBadgeTone { return status === 'PREPARED' || status === 'SNAPSHOT_READY' ? 'success' : status.includes('FAILED') || status === 'RECONCILIATION_REQUIRED' ? 'warning' : 'info'; }
}

