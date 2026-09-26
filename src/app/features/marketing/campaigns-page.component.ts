import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { canManagePeople } from '../../core/auth/auth-access';
import { CampaignService } from '../../core/marketing/campaign.service';
import { Campaign, CampaignLifecycle, campaignCriteriaSummary, campaignStatusLabel, campaignStatusTone } from '../../core/marketing/campaign.types';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-campaigns-page',
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
  template: `
    <section class="page">
      <header class="heading"><div><p class="eyebrow">Marketing</p><h1>Campaigns</h1><p class="intro">Review campaigns and prepare CRM recipient snapshots.</p></div>
        @if (canManage()) { <a class="crm-button crm-button--primary" routerLink="/marketing/audience-preview">Create Campaign</a> }
      </header>
      <nav class="lifecycle-tabs" aria-label="Campaign lifecycle"><a [routerLink]="[]" [queryParams]="{ lifecycle: 'active' }" [class.active]="lifecycle() === 'active'">Active</a><a [routerLink]="[]" [queryParams]="{ lifecycle: 'archived' }" [class.active]="lifecycle() === 'archived'">Archived</a></nav>
      @if (loading()) { <section class="state-card"><p>Loading campaigns...</p></section> }
      @else if (errorMessage()) { <section class="state-card state-card-error"><p>{{ errorMessage() }}</p><button class="crm-button crm-button--secondary" type="button" (click)="load()">Retry</button></section> }
      @else if (!campaigns().length) { <section class="state-card"><h2>{{ lifecycle() === 'archived' ? 'No archived campaigns' : 'No active campaigns' }}</h2><p>{{ lifecycle() === 'archived' ? 'Archived Campaigns will appear here for historical review.' : 'Preview an audience to create the first Campaign.' }}</p></section> }
      @else { <section class="list-card"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Workflow status</th><th>Lifecycle</th><th>Recipients</th><th>Updated</th><th></th></tr></thead><tbody>
        @for (campaign of campaigns(); track campaign.id) { <tr><td data-label="Name"><a [routerLink]="['/marketing/campaigns', campaign.id]" [queryParams]="{ lifecycle: lifecycle() }">{{ campaign.name }}</a><small>{{ criteriaSummary(campaign)[0] }}</small></td><td data-label="Workflow status"><app-status-badge [label]="statusLabel(campaign)" [tone]="statusTone(campaign)" /></td><td data-label="Lifecycle"><span class="lifecycle-label">{{ lifecycleLabel(campaign) }}</span></td><td data-label="Recipients">{{ recipientSummary(campaign) }}</td><td data-label="Updated">{{ campaign.updated_at | date:'mediumDate' }}</td><td><a class="row-action" [routerLink]="['/marketing/campaigns', campaign.id]" [queryParams]="{ lifecycle: lifecycle() }">Open</a></td></tr> }
      </tbody></table></div></section> }
    </section>
  `,
  styles: `
    :host { display: block; } .page { display: grid; gap: var(--crm-space-4); } .heading { display:flex; justify-content:space-between; align-items:end; gap:1rem; } h1,h2,p { margin:0; } h1 { color:var(--crm-text-strong); font-size:clamp(1.45rem,2.5vw,2rem); } h2 { color:var(--crm-text-strong); font-size:var(--crm-font-lg); } .eyebrow { margin-bottom:.25rem; color:var(--crm-text-muted); font-size:var(--crm-font-sm); font-weight:700; text-transform:uppercase; } .intro { margin-top:.45rem; color:var(--crm-text-secondary); } .lifecycle-tabs { display:flex; gap:1.25rem; border-bottom:1px solid var(--crm-border); } .lifecycle-tabs a { padding:.6rem .15rem; color:var(--crm-text-secondary); text-decoration:none; font-weight:700; } .lifecycle-tabs a.active { color:var(--crm-text-strong); border-bottom:3px solid var(--crm-accent); } .list-card,.state-card { padding:1.2rem 1.25rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-lg); background:var(--crm-surface); box-shadow:var(--crm-shadow-sm); } .state-card { display:grid; gap:.8rem; } .state-card-error { border-color:var(--crm-error); } .table-wrap { overflow-x:auto; } table { width:100%; border-collapse:collapse; } th,td { padding:.85rem .7rem; border-bottom:1px solid var(--crm-border); text-align:left; vertical-align:top; } th { color:var(--crm-text-muted); font-size:var(--crm-font-sm); } td { color:var(--crm-text-secondary); } td a { color:var(--crm-text-strong); font-weight:700; } td small { display:block; margin-top:.25rem; color:var(--crm-text-muted); } .row-action { white-space:nowrap; } .lifecycle-label { color:var(--crm-text-strong); font-weight:700; } .crm-button { display:inline-flex; align-items:center; text-decoration:none; } @media (max-width:700px) { .heading { align-items:start; flex-direction:column; } th { display:none; } td { display:grid; grid-template-columns:8rem minmax(0,1fr); gap:.6rem; } td::before { content:attr(data-label); color:var(--crm-text-muted); font-size:var(--crm-font-sm); font-weight:700; } }
  `,
})
export class CampaignsPageComponent {
  private readonly service = inject(CampaignService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly campaigns = signal<Campaign[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly lifecycle = signal<CampaignLifecycle>('active');
  readonly canManage = () => canManagePeople(this.auth.currentUser());

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const value = params.get('lifecycle');
      this.lifecycle.set(value === 'archived' || value === 'all' ? value : 'active');
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.service.list(this.lifecycle()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => { this.campaigns.set(page.results); this.loading.set(false); },
      error: (_error: HttpErrorResponse) => { this.loading.set(false); this.errorMessage.set('Campaigns could not be loaded right now. Try again.'); },
    });
  }

  criteriaSummary(campaign: Campaign): string[] { return campaignCriteriaSummary(campaign.audience_selection); }
  recipientSummary(campaign: Campaign): string { const prep = campaign.current_preparation; return prep ? `${prep.included_count} included · ${prep.excluded_count} excluded` : 'Not prepared'; }
  statusLabel(campaign: Campaign): string { return campaign.current_preparation?.status === 'PROVIDER_PREPARING' ? 'Preparing in Brevo' : campaignStatusLabel(campaign.status); }
  statusTone(campaign: Campaign) { return campaignStatusTone(campaign.current_preparation?.status === 'PROVIDER_PREPARING' ? 'PROVIDER_PREPARING' : campaign.status); }
  lifecycleLabel(campaign: Campaign): string { return campaign.is_archived ? 'Archived' : 'Active'; }
}
