import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PeopleService } from '../../core/people/people.service';
import { BrevoIntegrationStatus, PersonBrevoIntegration } from '../../core/people/people.types';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-person-brevo-integration-section',
  imports: [CommonModule, CrmSectionCardComponent, StateMessageComponent, StatusBadgeComponent],
  template: `
    <app-crm-section-card title="Brevo integration">
      @if (loading()) {
        <p class="loading-copy">Checking the current Brevo connection...</p>
      } @else if (errorMessage()) {
        <app-state-message
          title="Brevo status unavailable"
          [message]="errorMessage()!"
          tone="error"
        />
      } @else if (inspection(); as current) {
        <div class="integration-summary">
          <div class="integration-heading">
            <p class="detail-label">Current integration status</p>
            <app-status-badge [label]="statusLabel(current.integration.status)" [tone]="statusTone(current.integration.status)" />
          </div>
          <h3>{{ current.integration.title }}</h3>
          <p class="explanation">{{ current.integration.explanation }}</p>

          @if (current.integration.status === 'RESTRICTED') {
            <p class="prominent-warning">Brevo currently prevents marketing email for this contact.</p>
            <p class="next-step">Elevate will not automatically unblock or resubscribe this person.</p>
            <p class="next-step"><strong>Next step:</strong> Review the contact's marketing status in Brevo and resolve it through the approved provider workflow if appropriate.</p>
          }
          @if (current.integration.status === 'CONTACT_MISSING' && current.integration.can_reconcile) {
            <p class="next-step">An administrator can reconcile this Brevo connection.</p>
          }
          @if (current.integration.status === 'IDENTITY_CONFLICT') {
            <p class="next-step"><strong>Next step:</strong> {{ identityNextStep(current.integration.reason_code) }}</p>
          }
          @if (current.integration.status === 'NOT_CONNECTED') {
            <p class="next-step">Elevate will not automatically create a Brevo connection from this page.</p>
          }

          <div class="preference-summary">
            <p class="detail-label">CRM email marketing preference</p>
            <p class="preference-value">{{ preferenceLabel(current.marketing_preference.state) }}</p>
            @if (current.marketing_preference.source) {
              <p class="metadata"><span>Source</span>{{ sourceLabel(current.marketing_preference.source!) }}</p>
            }
          </div>
        </div>
      }
    </app-crm-section-card>
  `,
  styles: `
    :host { display: block; }
    .integration-summary, .preference-summary { display: grid; gap: .65rem; }
    .integration-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .detail-label, .explanation, .next-step, .prominent-warning, .loading-copy, .preference-value, .metadata { margin: 0; }
    .detail-label { color: var(--crm-text-muted); font-size: var(--crm-font-sm); }
    h3 { margin: 0; color: var(--crm-text-strong); font-size: var(--crm-font-md); }
    .explanation, .next-step, .loading-copy { color: var(--crm-text-secondary); line-height: 1.5; }
    .prominent-warning { padding: .75rem; border-left: 3px solid var(--crm-warning); background: var(--crm-warning-surface); color: var(--crm-text-strong); font-weight: 600; line-height: 1.5; }
    .metadata { display: flex; gap: .5rem; color: var(--crm-text-secondary); font-size: var(--crm-font-sm); }
    .metadata span { color: var(--crm-text-muted); font-weight: 600; }
    .preference-summary { margin-top: .65rem; padding-top: .85rem; border-top: 1px solid var(--crm-border); }
    .preference-value { color: var(--crm-text-strong); font-weight: 600; }
  `,
})
export class PersonBrevoIntegrationSectionComponent implements OnInit {
  readonly personId = input.required<number>();
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly inspection = signal<PersonBrevoIntegration | null>(null);

  ngOnInit(): void {
    this.peopleService.getPersonBrevoIntegration(this.personId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (inspection) => {
        this.inspection.set(inspection);
        this.loading.set(false);
      },
      error: (_error: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMessage.set('The current Brevo integration status could not be checked. Try again later.');
      },
    });
  }

  statusLabel(status: BrevoIntegrationStatus): string {
    return {
      CONNECTED: 'Connected',
      RESTRICTED: 'Marketing restricted in Brevo',
      CONTACT_MISSING: 'Brevo contact no longer exists',
      IDENTITY_CONFLICT: 'Brevo contact identity needs review',
      NOT_CONNECTED: 'Not connected to Brevo',
      UNKNOWN: 'Brevo status unavailable',
    }[status];
  }

  statusTone(status: BrevoIntegrationStatus): StatusBadgeTone {
    return status === 'CONNECTED' ? 'success' : status === 'UNKNOWN' || status === 'NOT_CONNECTED' ? 'neutral' : 'warning';
  }

  preferenceLabel(state: PersonBrevoIntegration['marketing_preference']['state']): string {
    return { UNKNOWN: 'Not recorded', OPTED_IN: 'Opted in', OPTED_OUT: 'Opted out' }[state];
  }

  sourceLabel(source: NonNullable<PersonBrevoIntegration['marketing_preference']['source']>): string {
    return {
      MEMBERSHIP_FORM: 'Membership form', WEBSITE_SIGNUP: 'Website signup', STAFF_RECORDED: 'Staff recorded',
      HISTORICAL_IMPORT: 'Historical import', MAILCHIMP: 'Mailchimp', BREVO: 'Brevo', OTHER: 'Other',
    }[source] ?? 'Other';
  }

  identityNextStep(reasonCode: string | null): string {
    return {
      BREVO_CRM_EMAIL_MISSING: "Review the person's CRM email before attempting further Brevo reconciliation.",
      BREVO_EMAIL_IDENTITY_MISMATCH: "Verify the person's current email and the linked Brevo contact before making any identity changes.",
      BREVO_CONTACT_LINKED_TO_OTHER_PERSON: 'Escalate this record for administrative review.',
      BREVO_CONTACT_IDENTITY_CONFLICT: 'Escalate this record for administrative review.',
    }[reasonCode ?? ''] ?? 'Escalate this record for administrative review.';
  }
}
