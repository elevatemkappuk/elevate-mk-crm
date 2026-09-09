import { Component, computed, input, output } from '@angular/core';
import { PersonListItem } from '../../core/people/people.types';
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';
import { PersonLifecycleActionsComponent } from './person-lifecycle-actions.component';

@Component({
  selector: 'app-person-profile-header',
  imports: [StatusBadgeComponent, PersonLifecycleActionsComponent],
  template: `
        <header class="identity-card">
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <div class="identity-copy">
            <div class="identity-heading">
              <h1>{{ fullName() }}</h1>
              <app-status-badge [label]="relationshipLabel()" [tone]="relationshipTone()" />
              @if (person()!.archived_at) { <app-status-badge label="Archived" tone="muted" /> }
            </div>
            <div class="identity-meta">
              @if (jobTitle()) { <span>{{ jobTitle() }}</span> }
              @if (person()!.location) { <span>{{ person()!.location }}</span> }
            </div>
            <div class="identity-meta">
              <span>Email: {{ displayValue(person()!.primary_email) }}</span>
              <span>Mobile: {{ displayValue(person()!.mobile) }}</span>
            </div>
          </div>
          @if (canManagePeople()) {
            <div class="profile-actions">
              @if (!person()!.archived_at) {
                <button type="button" class="button-primary edit-person" (click)="edit.emit()">Edit person</button>
              }
              <app-person-lifecycle-actions [person]="person()!" [submitting]="submitting()" [errorMessage]="errorMessage()" (archive)="archive.emit()" (restore)="restore.emit()" />
            </div>
          }
        </header>
  `,
  styleUrl: './person-profile-header.component.scss',
})
export class PersonProfileHeaderComponent {
  readonly person = input.required<PersonListItem>();
  readonly relationshipLabel = input.required<string>();
  readonly relationshipTone = input<StatusBadgeTone>('neutral');
  readonly jobTitle = input('');
  readonly canManagePeople = input(false);
  readonly submitting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly edit = output<void>();
  readonly archive = output<void>();
  readonly restore = output<void>();
  readonly fullName = computed(() => this.person().first_name + ' ' + this.person().last_name);
  readonly initials = computed(() => ((this.person().first_name?.[0] ?? '') + (this.person().last_name?.[0] ?? '')).toUpperCase());
  displayValue(value: string | null | undefined): string { return value && value.trim() ? value : 'Not provided'; }
}
