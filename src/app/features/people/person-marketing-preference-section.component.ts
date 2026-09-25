import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';

import { formatForbiddenError } from '../../core/http/forbidden-error';
import { PeopleService } from '../../core/people/people.service';
import { MarketingPreference, MarketingPreferenceState } from '../../core/people/people.types';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-person-marketing-preference-section',
  imports: [CommonModule, CrmSectionCardComponent, StatusBadgeComponent],
  template: `
    <app-crm-section-card title="Marketing Preferences">
      <div class="preference-summary">
        <div class="preference-heading">
          <p class="detail-label">Email marketing preference</p>
          <app-status-badge [label]="stateLabel(preference().state)" [tone]="stateTone(preference().state)" />
        </div>

        @if (preference().source) {
          <p class="metadata"><span>Source</span>{{ sourceLabel(preference().source!) }}</p>
        }
        @if (preference().recorded_at) {
          <p class="metadata"><span>Recorded</span>{{ preference().recorded_at | date: 'd MMM y, HH:mm' }}</p>
        }
        @if (!preference().source && !preference().recorded_at) {
          <p class="empty-copy">No email marketing preference has been recorded.</p>
        }
      </div>

      @if (canEdit() && !editing()) {
        <div class="section-actions">
          <button type="button" class="button-secondary" (click)="beginEdit()">Change preference</button>
        </div>
      }

      @if (editing()) {
        <form class="preference-form" (submit)="$event.preventDefault(); save()">
          <fieldset>
            <legend>Record an explicit email marketing preference</legend>
            <p class="form-note">
              Opted in means this Person has given permission for marketing email. Opted out means marketing email must not be sent.
            </p>
            <label class="choice">
              <input type="radio" name="marketing-preference" value="OPTED_IN"
                [checked]="selectedState() === 'OPTED_IN'" (change)="selectedState.set('OPTED_IN')" />
              <span>Opted in</span>
            </label>
            <label class="choice">
              <input type="radio" name="marketing-preference" value="OPTED_OUT"
                [checked]="selectedState() === 'OPTED_OUT'" (change)="selectedState.set('OPTED_OUT')" />
              <span>Opted out</span>
            </label>
          </fieldset>

          @if (errorMessage()) {
            <p class="form-error" role="alert">{{ errorMessage() }}</p>
          }
          <div class="form-actions">
            <button type="submit" class="button-primary" [disabled]="submitting()">
              {{ submitting() ? 'Saving...' : 'Save preference' }}
            </button>
            <button type="button" class="button-secondary" [disabled]="submitting()" (click)="cancelEdit()">Cancel</button>
          </div>
        </form>
      }

      @if (successMessage()) {
        <p class="success-message" role="status">{{ successMessage() }}</p>
      }
    </app-crm-section-card>
  `,
  styles: `
    :host { display: block; }
    .preference-summary { display: grid; gap: .65rem; }
    .preference-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .detail-label, .metadata, .empty-copy, .form-note, .success-message { margin: 0; }
    .detail-label { color: var(--crm-text-muted); font-size: var(--crm-font-sm); }
    .metadata { display: flex; gap: .5rem; flex-wrap: wrap; color: var(--crm-text-secondary); font-size: var(--crm-font-sm); }
    .metadata span { color: var(--crm-text-muted); font-weight: 600; }
    .empty-copy, .form-note { color: var(--crm-text-secondary); line-height: 1.5; }
    .section-actions, .form-actions { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: 1rem; }
    .preference-form { display: grid; gap: 1rem; margin-top: 1rem; }
    fieldset { display: grid; gap: .7rem; min-width: 0; padding: 0; border: 0; }
    legend { margin-bottom: .25rem; color: var(--crm-text-strong); font-weight: 600; }
    .choice { display: flex; align-items: center; gap: .6rem; color: var(--crm-text-strong); }
    input { width: 1rem; height: 1rem; accent-color: var(--crm-action); }
    button { min-height: 2.75rem; width: fit-content; padding: .65rem 1rem; border: 1px solid var(--crm-border); border-radius: var(--crm-radius-sm); font: inherit; font-weight: 600; cursor: pointer; }
    .button-primary { background: var(--crm-action); color: var(--crm-on-action); border-color: transparent; }
    .button-secondary { background: var(--crm-surface); color: var(--crm-text-strong); }
    button:disabled { cursor: wait; opacity: .6; }
    .form-error { color: var(--crm-error); font-weight: 600; line-height: 1.5; }
    .success-message { color: var(--crm-success); font-weight: 600; }
    :is(button, input):focus-visible { outline: 2px solid var(--crm-focus-ring); outline-offset: 3px; }
    @media(max-width: 42.5rem) { .preference-heading { align-items: flex-start; flex-direction: column; } button { width: 100%; } }
  `,
})
export class PersonMarketingPreferenceSectionComponent {
  readonly personId = input.required<number>();
  readonly preference = input.required<MarketingPreference>();
  readonly canEdit = input(false);
  readonly preferenceChanged = output<MarketingPreference>();

  readonly editing = signal(false);
  readonly submitting = signal(false);
  readonly selectedState = signal<Exclude<MarketingPreferenceState, 'UNKNOWN'>>('OPTED_IN');
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  private readonly peopleService = inject(PeopleService);

  stateLabel(state: MarketingPreferenceState): string {
    switch (state) {
      case 'OPTED_IN': return 'Opted in';
      case 'OPTED_OUT': return 'Opted out';
      default: return 'Not recorded';
    }
  }

  stateTone(state: MarketingPreferenceState): StatusBadgeTone {
    switch (state) {
      case 'OPTED_IN': return 'success';
      case 'OPTED_OUT': return 'warning';
      default: return 'neutral';
    }
  }

  sourceLabel(source: NonNullable<MarketingPreference['source']>): string {
    switch (source) {
      case 'STAFF_RECORDED': return 'Staff recorded';
      case 'MEMBERSHIP_FORM': return 'Membership form';
      case 'WEBSITE_SIGNUP': return 'Website signup';
      case 'HISTORICAL_IMPORT': return 'Historical import';
      case 'MAILCHIMP': return 'Mailchimp';
      case 'BREVO': return 'Brevo';
      default: return 'Other';
    }
  }

  beginEdit(): void {
    this.selectedState.set(this.preference().state === 'OPTED_OUT' ? 'OPTED_OUT' : 'OPTED_IN');
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editing.set(true);
  }

  cancelEdit(): void {
    if (!this.submitting()) this.editing.set(false);
  }

  save(): void {
    if (!this.canEdit() || this.submitting()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.peopleService.updateMarketingPreference(this.personId(), { state: this.selectedState() }).subscribe({
      next: (response) => {
        this.preferenceChanged.emit(response.preference);
        this.editing.set(false);
        this.submitting.set(false);
        this.successMessage.set('Marketing preference saved.');
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(formatMarketingPreferenceError(error));
      },
    });
  }
}

function formatMarketingPreferenceError(error: HttpErrorResponse): string {
  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to change marketing preferences.');
  }
  if (error.status === 400) return 'Choose a valid marketing preference and try again.';
  if (error.status === 404) return 'This Person is no longer available for preference changes.';
  return 'Marketing preference could not be saved right now. Try again.';
}
