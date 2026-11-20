import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CommunityModerationService } from '../../core/community-moderation/community-moderation.service';
import { ModerationReport } from '../../core/community-moderation/community-moderation.types';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { contentStatusLabel, reasonLabel, reportStatusLabel } from './moderation-helpers';

type ReviewAction = 'dismiss' | 'remove' | 'restore';

@Component({
  selector: 'app-moderation-report-page',
  imports: [CommonModule, DatePipe, RouterLink, ConfirmationDialogComponent],
  template: `
    <section class="page">
      <a class="back-link" routerLink="/moderation">← Back to Moderation</a>
      @if (loading()) { <section class="state-card" aria-live="polite"><p>Loading report...</p></section> }
      @else if (errorMessage() && !report()) { <section class="state-card state-card-error"><p role="alert">{{ errorMessage() }}</p><button class="crm-button crm-button--secondary" type="button" (click)="load()">Retry</button></section> }
      @else if (report(); as current) {
        <header class="heading"><div><p class="eyebrow">Report</p><h1>{{ reasonLabel(current.reason) }}</h1><p class="intro">{{ reportStatusLabel(current.status) }} · reported {{ current.created_at | date:'medium' }}</p></div><span class="status-badge">{{ reportStatusLabel(current.status) }}</span></header>
        @if (errorMessage()) { <p class="error" role="alert">{{ errorMessage() }}</p> }
        @if (successMessage()) { <p class="success" role="status">{{ successMessage() }}</p> }
        <section class="review-grid">
          <article class="card"><p class="section-label">REPORT</p><dl><div><dt>Reason</dt><dd>{{ reasonLabel(current.reason) }}</dd></div><div><dt>Reported at</dt><dd>{{ current.created_at | date:'medium' }}</dd></div><div><dt>Reporter</dt><dd>{{ fullName(current.reporter) }}<small>{{ current.reporter.job_title || current.reporter.location }}</small></dd></div><div><dt>Details</dt><dd>{{ current.details || 'No additional details supplied.' }}</dd></div></dl></article>
          <article class="card"><p class="section-label">CONTENT</p><dl><div><dt>Type</dt><dd>{{ current.target.type }}</dd></div><div><dt>Author</dt><dd>{{ fullName(current.target.author) }}<small>{{ current.target.author.job_title || current.target.author.location }}</small></dd></div><div><dt>State</dt><dd>{{ contentStatusLabel(current.target.status) }}</dd></div></dl><h2>{{ current.target.headline || (current.target.type === 'REPLY' ? 'Reply' : 'Post') }}</h2><p class="content-body">{{ current.target.body }}</p>@if (current.target.parent_post; as parent) { <aside class="context"><strong>Parent post</strong><p>{{ parent.headline }}</p><small>{{ parent.body }}</small></aside> }</article>
        </section>
        <section class="actions-card"><div><p class="section-label">REVIEW ACTIONS</p><p>Dismiss leaves the content unchanged. Removing content makes it unavailable to Community members while retaining its record and history.</p></div><div class="action-row">@if (current.status === 'OPEN') { <button class="crm-button crm-button--secondary" type="button" [disabled]="submitting()" (click)="requestAction('dismiss')">Dismiss report</button><button class="crm-button crm-button--danger" type="button" [disabled]="submitting()" (click)="requestAction('remove')">{{ current.target.type === 'POST' ? 'Remove post' : 'Remove reply' }}</button> } @if (current.target.status === 'MODERATOR_REMOVED') { <button class="crm-button crm-button--secondary" type="button" [disabled]="submitting()" (click)="requestAction('restore')">Restore {{ current.target.type === 'POST' ? 'post' : 'reply' }}</button> }</div><label class="resolution-label" for="resolution">Internal moderation context (optional)</label><textarea id="resolution" maxlength="1000" rows="3" [value]="resolution()" (input)="resolution.set($any($event.target).value)"></textarea><small>{{ resolution().length }}/1000</small></section>
        <app-confirmation-dialog [open]="action() !== null" [title]="actionTitle()" [message]="actionMessage()" [confirmLabel]="actionConfirmLabel()" [busy]="submitting()" (confirmed)="confirmAction()" (cancelled)="cancelAction()" />
      }
    </section>
  `,
  styles: `:host{display:block}.page{display:grid;gap:var(--crm-space-4)}.back-link{color:var(--crm-text-secondary);font-weight:600}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}h1,h2,p{margin:0}h1{color:var(--crm-text-strong);font-size:clamp(1.45rem,2.5vw,2rem)}h2{margin-top:var(--crm-space-4);color:var(--crm-text-strong);font-size:var(--crm-font-lg)}.eyebrow,.section-label{margin-bottom:.25rem;color:var(--crm-text-muted);font-size:var(--crm-font-sm);font-weight:700;text-transform:uppercase}.intro{margin-top:.45rem;color:var(--crm-text-secondary)}.status-badge{padding:.35rem .6rem;border-radius:999px;background:var(--crm-info-surface);color:var(--crm-text-strong);font-size:var(--crm-font-sm);font-weight:700}.review-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--crm-space-4)}.card,.actions-card,.state-card{display:grid;gap:var(--crm-space-3);padding:1.2rem 1.25rem;border:1px solid var(--crm-border);border-radius:var(--crm-radius-lg);background:var(--crm-surface);box-shadow:var(--crm-shadow-sm)}dl{display:grid;gap:var(--crm-space-3);margin:0}dl div{display:grid;gap:.2rem}dt{color:var(--crm-text-muted);font-size:var(--crm-font-sm);font-weight:700}dd{margin:0;color:var(--crm-text-secondary);overflow-wrap:anywhere}dd small{display:block;margin-top:.2rem;color:var(--crm-text-muted)}.content-body{white-space:pre-wrap;color:var(--crm-text-secondary);line-height:1.6;overflow-wrap:anywhere}.context{display:grid;gap:.3rem;margin-top:var(--crm-space-3);padding:var(--crm-space-3);border-left:3px solid var(--crm-border);background:var(--crm-surface-muted)}.context small{color:var(--crm-text-secondary);white-space:pre-wrap;overflow-wrap:anywhere}.actions-card{grid-template-columns:minmax(0,1fr) auto}.actions-card>p,.actions-card>div>p{color:var(--crm-text-secondary);line-height:1.5}.action-row{display:flex;align-items:flex-start;justify-content:flex-end;flex-wrap:wrap;gap:var(--crm-space-2)}.resolution-label{grid-column:1/-1;color:var(--crm-text-strong);font-weight:700}.actions-card textarea{grid-column:1/-1;width:100%;resize:vertical;padding:.7rem;border:1px solid var(--crm-border);border-radius:var(--crm-radius-md);font:inherit;color:var(--crm-text-strong);background:var(--crm-surface)}.actions-card>small{grid-column:1/-1;color:var(--crm-text-muted)}.error{color:var(--crm-error);font-weight:600}.success{color:var(--crm-success);font-weight:600}.state-card-error{border-color:var(--crm-error)}.crm-button--danger{border-color:var(--crm-error);background:var(--crm-error);color:var(--crm-surface)}@media(max-width:700px){.heading{flex-direction:column}.review-grid{grid-template-columns:1fr}.actions-card{grid-template-columns:1fr}.action-row{justify-content:flex-start}}
  `,
})
export class ModerationReportPageComponent {
  private readonly service = inject(CommunityModerationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly report = signal<ModerationReport | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly action = signal<ReviewAction | null>(null);
  readonly resolution = signal('');
  constructor() { this.load(); }
  load(): void { const id = this.route.snapshot.paramMap.get('reportId'); if (!id) return; this.loading.set(true); this.errorMessage.set(null); this.service.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: value => { this.report.set(value); this.loading.set(false); }, error: (_error: HttpErrorResponse) => { this.loading.set(false); this.errorMessage.set('This report is no longer available or could not be loaded.'); } }); }
  requestAction(action: ReviewAction): void { if (!this.submitting()) this.action.set(action); }
  cancelAction(): void { if (!this.submitting()) this.action.set(null); }
  actionTitle(): string { const action = this.action(); return action === 'dismiss' ? 'Dismiss report?' : action === 'remove' ? `Remove ${this.report()?.target.type === 'POST' ? 'post' : 'reply'}?` : `Restore ${this.report()?.target.type === 'POST' ? 'post' : 'reply'}?`; }
  actionMessage(): string { const action = this.action(); if (action === 'dismiss') return 'The report will be resolved and the content will remain available to Community members.'; if (action === 'restore') return 'This will make the moderator-removed content available again wherever normal Community visibility rules allow.'; return 'This content will no longer be available to Community members. Its record and history will be retained.'; }
  actionConfirmLabel(): string { const action = this.action(); return action === 'dismiss' ? 'Dismiss report' : action === 'restore' ? 'Restore content' : 'Remove content'; }
  confirmAction(): void { const report = this.report(); const action = this.action(); if (!report || !action || this.submitting()) return; this.submitting.set(true); this.errorMessage.set(null); this.service.action(report.report_id, action, this.resolution()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: value => { this.action.set(null); this.submitting.set(false); if (action === 'restore') { this.report.set(value); this.successMessage.set('Content restored.'); } else { void this.router.navigate(['/moderation']); } }, error: (error: HttpErrorResponse) => { this.action.set(null); this.submitting.set(false); this.errorMessage.set(error.status === 409 ? 'This report or content changed before the action completed. The current state has been refreshed.' : error.status === 404 ? 'This report is no longer available.' : 'The moderation action could not be completed right now.'); this.load(); } }); }
  reasonLabel = reasonLabel;
  contentStatusLabel = contentStatusLabel;
  reportStatusLabel = reportStatusLabel;
  fullName(identity: { first_name: string; last_name: string }): string { return `${identity.first_name} ${identity.last_name}`.trim(); }
}
