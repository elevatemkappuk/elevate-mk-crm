import { CommonModule } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AudienceSelection } from '../../core/marketing/audience.types';

@Component({
  selector: 'app-campaign-create-dialog',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    @if (open()) {
      <div class="backdrop" (click)="close()">
        <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="campaign-create-title" (click)="$event.stopPropagation()">
          <header><p class="eyebrow">Marketing</p><h2 id="campaign-create-title">Continue to Campaign</h2></header>
          <p class="intro">Name this campaign. Recipients will be re-checked against current CRM consent when you prepare them.</p>
          <dl class="summary">
            <div><dt>Selected</dt><dd>{{ selectedCount() }}</dd></div>
            <div><dt>Eligible</dt><dd>{{ eligibleCount() }}</dd></div>
            <div><dt>Excluded</dt><dd>{{ excludedCount() }}</dd></div>
          </dl>
          <div class="criteria"><strong>Active criteria</strong><span>{{ criteriaSummary() }}</span></div>
          <form [formGroup]="form" (ngSubmit)="submit()" [attr.aria-busy]="busy()">
            <label class="crm-label" for="campaign-name">Campaign name</label>
            <input class="crm-control" id="campaign-name" formControlName="name" maxlength="255" autocomplete="off" />
            @if (form.controls.name.invalid && form.controls.name.touched) { <p class="error">Enter a campaign name.</p> }
            @if (errorMessage()) { <p class="error" role="alert">{{ errorMessage() }}</p> }
            <div class="actions">
              <button type="button" class="crm-button crm-button--secondary" [disabled]="busy()" (click)="close()">Cancel</button>
              <button type="submit" class="crm-button crm-button--primary" [disabled]="busy() || form.invalid">{{ busy() ? 'Creating...' : 'Create Campaign' }}</button>
            </div>
          </form>
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .backdrop { position: fixed; inset: 0; z-index: var(--crm-layer-dialog); display: grid; place-items: center; padding: var(--crm-space-4); background: var(--crm-overlay); }
    .dialog { width: min(100%, 38rem); display: grid; gap: var(--crm-space-4); padding: var(--crm-space-6); border: 1px solid var(--crm-border); border-radius: var(--crm-radius-lg); background: var(--crm-surface); box-shadow: var(--crm-shadow-dialog); }
    h2, p, dl { margin: 0; } h2 { color: var(--crm-text-strong); } .eyebrow { color: var(--crm-text-muted); font-size: var(--crm-font-sm); font-weight: 700; text-transform: uppercase; } .intro, .criteria { color: var(--crm-text-secondary); line-height: 1.5; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; } .summary div { padding: .75rem; border: 1px solid var(--crm-border); border-radius: var(--crm-radius-md); } dt { color: var(--crm-text-muted); font-size: var(--crm-font-sm); } dd { margin: .2rem 0 0; color: var(--crm-text-strong); font-size: 1.4rem; font-weight: 700; }
    .criteria { display: grid; gap: .25rem; } .criteria strong { color: var(--crm-text-strong); } form { display: grid; gap: .5rem; } .error { color: var(--crm-error); font-size: var(--crm-font-sm); } .actions { display: flex; justify-content: end; gap: .75rem; margin-top: .75rem; }
    @media (max-width: 500px) { .summary { grid-template-columns: 1fr; } .actions { flex-direction: column-reverse; } .actions button { width: 100%; } }
  `,
})
export class CampaignCreateDialogComponent {
  private readonly fb = new FormBuilder();
  readonly open = input(false);
  readonly selection = input.required<AudienceSelection>();
  readonly selectedCount = input(0);
  readonly eligibleCount = input(0);
  readonly excludedCount = input(0);
  readonly busy = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly cancelled = output<void>();
  readonly submitted = output<string>();
  readonly form = this.fb.nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(255)]] });

  criteriaSummary(): string {
    const values = this.selection();
    const active = Object.entries(values).flatMap(([key, value]) => {
      if (Array.isArray(value) && value.length) return [`${key.replace('_', ' ')}: ${value.join(', ')}`];
      if (typeof value === 'string' && value.trim()) return [`Search: ${value.trim()}`];
      return [];
    });
    return active.length ? active.join(' · ') : 'All active People';
  }

  close(): void { if (!this.busy()) this.cancelled.emit(); }
  submit(): void {
    if (this.busy() || this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitted.emit(this.form.controls.name.value.trim());
  }
}

