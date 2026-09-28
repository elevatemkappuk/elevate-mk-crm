import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { canManagePeople } from '../../core/auth/auth-access';
import { CampaignService } from '../../core/marketing/campaign.service';
import { Campaign, CampaignLifecycle, campaignCriteriaSummary, campaignStatusLabel, campaignStatusTone } from '../../core/marketing/campaign.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

type LifecycleAction = 'archive' | 'restore';

@Component({
  selector: 'app-campaigns-page',
  imports: [CommonModule, RouterLink, StatusBadgeComponent, ConfirmationDialogComponent],
  template: `
    <section class="page">
      <header class="heading"><div><p class="eyebrow">Marketing</p><h1>Campaigns</h1><p class="intro">Review campaigns and prepare CRM recipient snapshots.</p></div>
        @if (canManage()) { <a class="crm-button crm-button--primary" routerLink="/marketing/audience-preview">Create Campaign</a> }
      </header>
      <nav class="lifecycle-tabs" aria-label="Campaign lifecycle"><div class="lifecycle-options"><a [routerLink]="[]" [queryParams]="{ lifecycle: 'active' }" [class.active]="lifecycle() === 'active'" [attr.aria-current]="lifecycle() === 'active' ? 'page' : null">Active</a><a [routerLink]="[]" [queryParams]="{ lifecycle: 'archived' }" [class.active]="lifecycle() === 'archived'" [attr.aria-current]="lifecycle() === 'archived' ? 'page' : null">Archived</a></div>@if (collectionCount() !== null) { <span class="collection-count">{{ collectionCountLabel() }}</span> }</nav>
      @if (errorMessage() && campaigns().length) { <div class="partial-error" role="alert"><span>{{ errorMessage() }}</span><button class="crm-button crm-button--quiet" type="button" (click)="load()">Retry</button></div> }
      @if (loading()) { <section class="state-card" aria-live="polite"><p>Loading campaigns...</p></section> }
      @else if (errorMessage() && !campaigns().length) { <section class="state-card state-card-error" aria-live="polite"><p role="alert">{{ errorMessage() }}</p><button class="crm-button crm-button--secondary" type="button" (click)="load()">Retry</button></section> }
      @else if (!campaigns().length) { <section class="state-card" aria-live="polite"><h2>{{ lifecycle() === 'archived' ? 'No archived campaigns' : 'No active campaigns' }}</h2><p>{{ lifecycle() === 'archived' ? 'Archived Campaigns will appear here for historical review.' : 'Preview an audience to create the first Campaign.' }}</p></section> }
      @else { <section class="list-card"><div class="table-wrap"><table aria-label="Campaigns"><thead><tr><th scope="col">Name</th><th scope="col">Workflow status</th><th scope="col">Lifecycle</th><th scope="col">Recipients</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead><tbody>
        @for (campaign of campaigns(); track campaign.id) { <tr class="campaign-row" tabindex="0" [attr.aria-label]="'Open ' + campaign.name" (click)="openCampaignRow($event, campaign)" (keydown)="openCampaignRowOnKeydown($event, campaign)"><td data-label="Name"><a class="row-action row-action--primary" [routerLink]="['/marketing/campaigns', campaign.id]" [queryParams]="{ lifecycle: lifecycle() }">{{ campaign.name }}</a><small>{{ criteriaSummaryLabel(campaign) }}</small></td><td data-label="Workflow status"><app-status-badge [label]="statusLabel(campaign)" [tone]="statusTone(campaign)" /></td><td data-label="Lifecycle"><span class="lifecycle-label">{{ lifecycleLabel(campaign) }}</span></td><td data-label="Recipients">{{ recipientSummary(campaign) }}</td><td data-label="Updated">{{ campaign.updated_at | date:'mediumDate' }}</td><td data-label="Actions" class="action-cell"><div class="action-group"><a class="row-action row-action--primary" [routerLink]="['/marketing/campaigns', campaign.id]" [queryParams]="{ lifecycle: lifecycle() }">Open</a>@if (lifecycle() === 'active' && campaign.can_archive) { <button class="row-action row-action--quiet lifecycle-action" type="button" [disabled]="lifecycleSubmittingId() !== null" (click)="requestLifecycleAction(campaign, 'archive')">Archive</button> } @if (lifecycle() === 'archived' && campaign.can_restore) { <button class="row-action row-action--quiet lifecycle-action" type="button" [disabled]="lifecycleSubmittingId() !== null" (click)="requestLifecycleAction(campaign, 'restore')">Restore</button> }</div></td></tr> }
      </tbody></table></div></section> }
      @if (successMessage()) { <p class="success-message" role="status">{{ successMessage() }}</p> }
      <app-confirmation-dialog
        [open]="lifecycleAction() !== null"
        [title]="lifecycleTitle()"
        [message]="lifecycleMessage()"
        [confirmLabel]="lifecycleAction() === 'archive' ? 'Archive' : 'Restore'"
        [busy]="lifecycleSubmittingId() !== null"
        (confirmed)="confirmLifecycleAction()"
        (cancelled)="cancelLifecycleAction()"
      />
    </section>
  `,
  styles: `
    :host { display: block; } .page { display: grid; gap: var(--crm-space-4); } .heading { display:flex; justify-content:space-between; align-items:end; gap:1rem; } h1,h2,p { margin:0; } h1 { color:var(--crm-text-strong); font-size:clamp(1.45rem,2.5vw,2rem); } h2 { color:var(--crm-text-strong); font-size:var(--crm-font-lg); } .eyebrow { margin-bottom:.25rem; color:var(--crm-text-muted); font-size:var(--crm-font-sm); font-weight:700; text-transform:uppercase; } .intro { margin-top:.45rem; color:var(--crm-text-secondary); } .lifecycle-tabs { display:flex; align-items:center; gap:1.25rem; border-bottom:1px solid var(--crm-border); } .lifecycle-tabs a { padding:.6rem .15rem; color:var(--crm-text-secondary); text-decoration:none; font-weight:700; } .lifecycle-tabs a.active { color:var(--crm-text-strong); border-bottom:3px solid var(--crm-accent); } .collection-count { margin-left:auto; padding-bottom:.6rem; color:var(--crm-text-muted); font-size:var(--crm-font-sm); } .list-card,.state-card { padding:1.2rem 1.25rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-lg); background:var(--crm-surface); box-shadow:var(--crm-shadow-sm); } .state-card { display:grid; gap:.8rem; } .state-card-error { border-color:var(--crm-error); } .partial-error { display:flex; align-items:center; justify-content:space-between; gap:var(--crm-space-3); padding:var(--crm-space-3) var(--crm-space-4); border:1px solid var(--crm-error); border-radius:var(--crm-radius-md); color:var(--crm-error); background:var(--crm-error-surface); } .partial-error .crm-button { flex:0 0 auto; min-height:var(--crm-control-height-sm); padding:var(--crm-space-1) var(--crm-space-3); } .success-message { color:var(--crm-success); } .table-wrap { overflow-x:auto; } table { width:100%; border-collapse:collapse; } th,td { padding:.85rem .7rem; border-bottom:1px solid var(--crm-border); text-align:left; vertical-align:top; } th { color:var(--crm-text-muted); font-size:var(--crm-font-sm); } td { color:var(--crm-text-secondary); } td a { color:var(--crm-text-strong); } td small { display:block; margin-top:.25rem; color:var(--crm-text-muted); } .action-cell { display:flex; flex-wrap:wrap; align-items:center; gap:.7rem; } .row-action { display:inline-flex; align-items:center; min-height:var(--crm-control-height-sm); white-space:nowrap; } .row-action--primary { padding:.35rem .65rem; border-radius:var(--crm-radius-md); color:var(--crm-action); font-weight:var(--crm-weight-bold); } .row-action--primary:hover { background:var(--crm-info-surface); } .row-action--quiet { padding:.35rem .45rem; color:var(--crm-text-secondary); } button.row-action { border:0; background:transparent; cursor:pointer; font:inherit; } button.row-action:disabled { cursor:not-allowed; opacity:.55; } .lifecycle-label { color:var(--crm-text-strong); font-weight:700; } .crm-button { display:inline-flex; align-items:center; text-decoration:none; } @media (max-width:700px) { .heading { align-items:start; flex-direction:column; } th { display:none; } td { display:grid; grid-template-columns:8rem minmax(0,1fr); gap:.6rem; } .action-cell { display:flex; } .collection-count { margin-left:0; padding-bottom:.6rem; } .partial-error { align-items:flex-start; flex-direction:column; } td::before { content:attr(data-label); color:var(--crm-text-muted); font-size:var(--crm-font-sm); font-weight:700; } }
    .lifecycle-options { display:flex; align-items:center; gap:1.25rem; }
    .campaign-row { cursor:pointer; }
    .campaign-row:focus-visible { outline:2px solid var(--crm-focus-ring); outline-offset:-2px; }
    .action-cell { display:table-cell; }
    .action-group { display:flex; align-items:center; flex-wrap:wrap; gap:.7rem; }
    @media (max-width:700px) { .action-cell { display:grid; } .action-group { display:flex; } }
  `,
})
export class CampaignsPageComponent {
  private readonly service = inject(CampaignService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly campaigns = signal<Campaign[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly lifecycle = signal<CampaignLifecycle>('active');
  readonly lifecycleAction = signal<LifecycleAction | null>(null);
  readonly lifecycleTarget = signal<Campaign | null>(null);
  readonly lifecycleSubmittingId = signal<number | null>(null);
  readonly collectionCount = signal<number | null>(null);
  readonly canManage = () => canManagePeople(this.auth.currentUser());

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const value = params.get('lifecycle');
      this.lifecycle.set(value === 'archived' || value === 'all' ? value : 'active');
      this.collectionCount.set(null);
      this.successMessage.set(null);
      this.load();
    });
  }

  load(clearError = true): void {
    this.loading.set(true);
    if (clearError) this.errorMessage.set(null);
    this.service.list(this.lifecycle()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => { this.campaigns.set(page.results); this.collectionCount.set(page.count); this.loading.set(false); },
      error: (_error: HttpErrorResponse) => { this.loading.set(false); this.errorMessage.set('Campaigns could not be loaded right now. Try again.'); },
    });
  }

  requestLifecycleAction(campaign: Campaign, action: LifecycleAction): void {
    if (this.lifecycleSubmittingId() !== null) return;
    this.lifecycleTarget.set(campaign);
    this.lifecycleAction.set(action);
  }

  cancelLifecycleAction(): void {
    if (this.lifecycleSubmittingId() !== null) return;
    this.lifecycleAction.set(null);
    this.lifecycleTarget.set(null);
  }

  lifecycleTitle(): string {
    return this.lifecycleAction() === 'archive' ? 'Archive campaign?' : 'Restore campaign?';
  }

  lifecycleMessage(): string {
    return this.lifecycleAction() === 'archive'
      ? 'This campaign will leave the Active Campaigns view. Recipient, preparation, and history information will be preserved, and no Brevo resources will be deleted. You can restore it later.'
      : 'This campaign will return to Active Campaigns. Its existing workflow status and history will not change.';
  }

  confirmLifecycleAction(): void {
    const campaign = this.lifecycleTarget();
    const action = this.lifecycleAction();
    if (!campaign || !action || this.lifecycleSubmittingId() !== null) return;
    this.lifecycleSubmittingId.set(campaign.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const request = action === 'archive' ? this.service.archiveCampaign(campaign.id) : this.service.restoreCampaign(campaign.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.lifecycleSubmittingId.set(null);
        this.lifecycleAction.set(null);
        this.lifecycleTarget.set(null);
        this.successMessage.set(action === 'archive' ? 'Campaign archived. Its history and Brevo resources were preserved.' : 'Campaign restored. Its workflow status and history were preserved.');
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.lifecycleSubmittingId.set(null);
        this.lifecycleAction.set(null);
        this.lifecycleTarget.set(null);
        this.errorMessage.set(error.status === 403
          ? 'You do not have permission to change this Campaign.'
          : error.status === 409
            ? 'This Campaign changed before the lifecycle action completed. Its current state has been refreshed.'
            : 'The Campaign lifecycle action could not be completed right now.');
        this.load(false);
      },
    });
  }

  openCampaignRow(event: Event, campaign: Campaign): void {
    if ((event.target as HTMLElement).closest('a,button')) return;
    void this.openCampaign(campaign);
  }

  openCampaignRowOnKeydown(event: KeyboardEvent, campaign: Campaign): void {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    void this.openCampaign(campaign);
  }

  private openCampaign(campaign: Campaign): Promise<boolean> {
    return this.router.navigate(['/marketing/campaigns', campaign.id], { queryParams: { lifecycle: this.lifecycle() } });
  }

  collectionCountLabel(): string { const count = this.collectionCount() ?? 0; const noun = this.lifecycle() === 'archived' ? 'archived campaign' : 'active campaign'; return `${count} ${noun}${count === 1 ? '' : 's'}`; }
  criteriaSummaryLabel(campaign: Campaign): string { const summary = campaignCriteriaSummary(campaign.audience_selection); return summary.length > 1 ? `${summary[0]} \u00b7 +${summary.length - 1} more` : summary[0]; }
  recipientSummary(campaign: Campaign): string { const prep = campaign.current_preparation; return prep ? `${prep.included_count} included · ${prep.excluded_count} excluded` : 'Not prepared'; }
  statusLabel(campaign: Campaign): string { return campaign.current_preparation?.status === 'PROVIDER_PREPARING' ? 'Preparing in Brevo' : campaignStatusLabel(campaign.status); }
  statusTone(campaign: Campaign) { return campaignStatusTone(campaign.current_preparation?.status === 'PROVIDER_PREPARING' ? 'PROVIDER_PREPARING' : campaign.status); }
  lifecycleLabel(campaign: Campaign): string { return campaign.is_archived ? 'Archived' : 'Active'; }
}
