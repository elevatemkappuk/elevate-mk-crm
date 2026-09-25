import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { canManagePeople } from '../../core/auth/auth-access';
import { CampaignService } from '../../core/marketing/campaign.service';
import { Campaign, CampaignRecipientSnapshot, campaignCriteriaSummary, campaignStatusLabel, campaignStatusTone, recipientDecisionLabel, recipientReasonLabel } from '../../core/marketing/campaign.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

type ProviderAction = 'prepare' | 'retry' | null;

@Component({
  selector: 'app-campaign-detail-page',
  imports: [CommonModule, RouterLink, StatusBadgeComponent, ConfirmationDialogComponent],
  template: `
    <section class="page">
      <a class="back-link" routerLink="/marketing/campaigns">Back to Campaigns</a>
      @if (loading()) { <section class="state-card"><p>Loading campaign...</p></section> }
      @else if (errorMessage() && !campaign()) { <section class="state-card state-card-error"><p>{{ errorMessage() }}</p><a class="crm-button crm-button--secondary" routerLink="/marketing/campaigns">Back to Campaigns</a></section> }
      @else if (campaign(); as current) {
        <header class="heading"><div><p class="eyebrow">Campaign review</p><h1>{{ current.name }}</h1><p class="intro">Recipients are determined from the saved audience criteria and re-checked when prepared.</p></div><app-status-badge [label]="statusLabel(current)" [tone]="statusTone(current)" /></header>
        @if (errorMessage()) { <p class="error" role="alert">{{ errorMessage() }}</p> }
        <section class="grid"><article class="card"><h2>Audience</h2><ul>@for (item of criteriaSummary(current); track item) { <li>{{ item }}</li> }</ul></article><article class="card"><h2>Preparation</h2>@if (current.current_preparation; as prep) { <dl><div><dt>Status</dt><dd>{{ prepStatusLabel(prep.status) }}</dd></div><div><dt>Selected</dt><dd>{{ prep.selected_count }}</dd></div><div><dt>Included</dt><dd>{{ prep.included_count }}</dd></div><div><dt>Excluded</dt><dd>{{ prep.excluded_count }}</dd></div></dl> } @else { <p>Recipients have not been prepared yet.</p> }</article></section>
        @if (current.status === 'DRAFT' && canManage()) { <button class="crm-button crm-button--primary" type="button" [disabled]="preparing()" (click)="prepare()">{{ preparing() ? 'Preparing recipients...' : 'Prepare recipients' }}</button> }
        @if (current.status === 'SNAPSHOT_READY' && canManage()) { <section class="action-card"><div><h2>Recipients ready</h2><p>Prepare the current eligible recipients in a dedicated Brevo list. Consent will be checked again first; the email will still be edited and sent from Brevo.</p></div><button class="crm-button crm-button--primary" type="button" [disabled]="providerPreparing()" (click)="providerAction.set('prepare')">{{ providerPreparing() ? 'Preparing in Brevo...' : 'Prepare in Brevo' }}</button></section> }
        @if (current.current_preparation?.status === 'PROVIDER_PREPARING') { <section class="state-card"><h2>Preparing in Brevo</h2><p>The provider preparation is in progress. Refresh this page when the operation has completed.</p></section> }
        @if (current.status === 'PROVIDER_FAILED') { <section class="state-card state-card-error"><h2>Brevo preparation failed</h2><p>{{ safeProviderMessage(current) }}</p><p>Previously completed preparation work will be reused where possible.</p>@if (canManage()) { <button class="crm-button crm-button--primary" type="button" [disabled]="providerPreparing()" (click)="providerAction.set('retry')">{{ providerPreparing() ? 'Retrying...' : 'Retry Brevo preparation' }}</button> }</section> }
        @if (current.status === 'RECONCILIATION_REQUIRED') { <section class="state-card state-card-warning"><h2>Needs attention</h2><p>One or more recipients could not be safely reconciled with their Brevo contact state. Review is required; no automatic repair is available here.</p></section> }
        @if (current.status === 'NO_READY_RECIPIENTS') { <section class="state-card"><h2>No recipients ready</h2><p>No recipients remained ready for provider preparation after the current consent and provider checks.</p></section> }
        @if (current.status === 'PREPARED') { <section class="provider-card"><div><p class="eyebrow">Brevo</p><h2>Ready in Brevo</h2><p>Your recipients are prepared in Brevo. Continue there to edit, preview/test, schedule, and send the campaign.</p></div>@if (current.current_preparation; as prep) { <dl class="provider-counts"><div><dt>Recipients ready</dt><dd>{{ prep.provider_ready_count }}</dd></div><div><dt>Needs attention</dt><dd>{{ prep.provider_issue_count }}</dd></div></dl> } @if (current.current_preparation?.brevo_editor_url; as editorUrl) { <a class="crm-button crm-button--primary" [href]="editorUrl" target="_blank" rel="noopener noreferrer">Open in Brevo <span aria-hidden="true">↗</span></a> } @else { <p class="fallback">Campaign draft created in Brevo. Open Brevo Campaigns to continue editing.</p> }</section> }
        @if (current.current_preparation?.status === 'SNAPSHOT_READY' || current.current_preparation?.status === 'PREPARED') { <section class="card"><h2>Recipients</h2><p class="note">This is the backend-authoritative preparation snapshot. Decisions cannot be edited here.</p>@if (recipientsLoading()) { <p>Loading recipients...</p> } @else if (recipients().length) { <div class="table-wrap"><table><thead><tr><th>Name</th><th>Decision</th><th>Reason</th></tr></thead><tbody>@for (recipient of recipients(); track recipient.id) { <tr><td>{{ recipient.first_name_snapshot }} {{ recipient.last_name_snapshot }}</td><td><app-status-badge [label]="decisionLabel(recipient.decision)" [tone]="recipient.decision === 'INCLUDED' ? 'success' : 'warning'" /></td><td>{{ reasonLabel(recipient.exclusion_reason) }}</td></tr>}</tbody></table></div> } @else { <p>No recipient snapshot rows were returned.</p> }</section> }
      }
    </section>
    <app-confirmation-dialog [open]="providerAction() !== null" [title]="providerAction() === 'retry' ? 'Retry Brevo preparation?' : 'Prepare in Brevo?'" [message]="providerConfirmationMessage()" [confirmLabel]="providerAction() === 'retry' ? 'Retry preparation' : 'Prepare in Brevo'" [busy]="providerPreparing()" (confirmed)="prepareProvider()" (cancelled)="providerAction.set(null)" />
  `,
  styles: `
    :host { display:block; } .page { display:grid; gap:var(--crm-space-4); } .back-link { color:var(--crm-text-secondary); font-weight:600; } .heading { display:flex; justify-content:space-between; align-items:end; gap:1rem; } h1,h2,p { margin:0; } h1 { color:var(--crm-text-strong); font-size:clamp(1.45rem,2.5vw,2rem); } h2 { color:var(--crm-text-strong); font-size:var(--crm-font-lg); } .eyebrow { margin-bottom:.25rem; color:var(--crm-text-muted); font-size:var(--crm-font-sm); font-weight:700; text-transform:uppercase; } .intro,.note,.action-card p,.provider-card p { margin-top:.45rem; color:var(--crm-text-secondary); line-height:1.5; } .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--crm-space-4); } .card,.state-card,.action-card,.provider-card { display:grid; gap:.8rem; padding:1.2rem 1.25rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-lg); background:var(--crm-surface); box-shadow:var(--crm-shadow-sm); } .action-card,.provider-card { grid-template-columns:1fr auto; align-items:center; border-color:var(--crm-shell-accent); background:color-mix(in srgb,var(--crm-shell-accent) 10%,var(--crm-surface)); } .provider-card { border-color:var(--crm-success); background:var(--crm-success-surface); } .state-card-error,.error { border-color:var(--crm-error); color:var(--crm-error); } .state-card-warning { border-color:var(--crm-warning); } ul { display:grid; gap:.45rem; margin:0; padding-left:1.2rem; color:var(--crm-text-secondary); } dl { display:grid; gap:.55rem; margin:0; } dl div { display:flex; justify-content:space-between; gap:1rem; border-bottom:1px solid var(--crm-border); padding-bottom:.4rem; } dt { color:var(--crm-text-muted); } dd { margin:0; color:var(--crm-text-strong); font-weight:700; } .provider-counts { grid-column:1 / -1; grid-template-columns:repeat(2,minmax(0,1fr)); } .provider-counts div { display:block; padding:.7rem; border:1px solid color-mix(in srgb,var(--crm-success) 35%,var(--crm-border)); border-radius:var(--crm-radius-md); } .provider-counts dd { margin-top:.2rem; font-size:1.35rem; } .fallback { grid-column:1 / -1; font-size:var(--crm-font-sm); } .table-wrap { overflow-x:auto; } table { width:100%; border-collapse:collapse; } th,td { padding:.75rem .5rem; border-bottom:1px solid var(--crm-border); text-align:left; } th { color:var(--crm-text-muted); font-size:var(--crm-font-sm); } td { color:var(--crm-text-secondary); } @media (max-width:700px) { .heading { align-items:start; flex-direction:column; } .grid { grid-template-columns:1fr; } .action-card,.provider-card { grid-template-columns:1fr; } .provider-counts { grid-template-columns:1fr; } }
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
  readonly providerPreparing = signal(false);
  readonly providerAction = signal<ProviderAction>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly canManage = () => canManagePeople(this.auth.currentUser());

  constructor() { this.load(); }
  load(): void { const id = Number(this.route.snapshot.paramMap.get('id')); this.loading.set(true); this.service.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (campaign) => { this.campaign.set(campaign); this.loading.set(false); if (campaign.current_preparation?.status === 'SNAPSHOT_READY' || campaign.current_preparation?.status === 'PREPARED') this.loadRecipients(id); }, error: (_error: HttpErrorResponse) => { this.loading.set(false); this.errorMessage.set('This campaign could not be loaded right now.'); } }); }
  prepare(): void { const id = this.campaign()?.id; if (!id || this.preparing()) return; this.preparing.set(true); this.errorMessage.set(null); this.service.prepare(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (campaign) => { this.campaign.set(campaign); this.preparing.set(false); this.loadRecipients(id); }, error: (error: HttpErrorResponse) => { this.preparing.set(false); this.errorMessage.set(error.status === 409 ? 'This campaign cannot be prepared in its current state.' : 'Recipients could not be prepared right now.'); } }); }
  prepareProvider(): void { const id = this.campaign()?.id; if (!id || this.providerPreparing()) return; this.providerPreparing.set(true); this.errorMessage.set(null); this.service.prepareProvider(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.providerAction.set(null); this.providerPreparing.set(false); this.load(); }, error: (error: HttpErrorResponse) => { this.providerAction.set(null); this.providerPreparing.set(false); this.errorMessage.set(error.status === 409 ? 'This campaign cannot be prepared in Brevo in its current state.' : 'Brevo preparation could not be completed right now.'); this.load(); } }); }
  loadRecipients(id: number): void { this.recipientsLoading.set(true); this.service.recipients(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (page) => { this.recipients.set(page.results); this.recipientsLoading.set(false); }, error: () => this.recipientsLoading.set(false) }); }
  criteriaSummary(campaign: Campaign): string[] { return campaignCriteriaSummary(campaign.audience_selection); }
  statusLabel(campaign: Campaign): string { return campaignStatusLabel(campaign.current_preparation?.status === 'PROVIDER_PREPARING' ? 'PROVIDER_PREPARING' : campaign.status); }
  prepStatusLabel(status: string): string { return campaignStatusLabel(status); }
  statusTone(campaign: Campaign) { return campaignStatusTone(campaign.current_preparation?.status === 'PROVIDER_PREPARING' ? 'PROVIDER_PREPARING' : campaign.status); }
  decisionLabel(decision: 'INCLUDED' | 'EXCLUDED'): string { return recipientDecisionLabel(decision); }
  reasonLabel(reason: string | null): string { return recipientReasonLabel(reason); }
  safeProviderMessage(campaign: Campaign): string { return campaign.current_preparation?.provider_error_message || 'Brevo could not prepare this campaign. You can retry the preparation.'; }
  providerConfirmationMessage(): string { const prep = this.campaign()?.current_preparation; const action = this.providerAction() === 'retry' ? 'retry this Brevo preparation' : 'prepare these recipients in Brevo'; return `This will ${action} after checking current marketing consent again. ${prep?.included_count ?? 0} included and ${prep?.excluded_count ?? 0} excluded recipients are in the current snapshot. The email will still be edited and sent from Brevo.`; }
}
