import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { PeopleService } from '../../core/people/people.service';
import { PersonListItem } from '../../core/people/people.types';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { DetailListComponent, DetailListItem } from '../../shared/ui/detail-list.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-person-detail-page',
  imports: [
    CommonModule,
    RouterLink,
    CrmSectionCardComponent,
    DetailListComponent,
    StateMessageComponent,
    StatusBadgeComponent,
  ],
  template: `
    <section class="detail-page">
      <a routerLink="/people" class="back-link">Back to People</a>

      @if (loading()) {
        <app-state-message
          title="Loading person"
          message="Retrieving the person record."
        />
      } @else if (notFound()) {
        <app-state-message
          title="Person not found"
          message="The requested person record is not available in the CRM People domain."
        >
          <a routerLink="/people" class="state-link">Return to People</a>
        </app-state-message>
      } @else if (errorMessage()) {
        <app-state-message
          title="Person could not be loaded"
          [message]="errorMessage()!"
          tone="error"
        >
          <a routerLink="/people" class="state-link">Return to People</a>
        </app-state-message>
      } @else if (person()) {
        <div class="detail-grid">
          <section class="identity-card">
            <div class="identity-topline">
              <div class="identity-copy">
                <h3>{{ fullName() }}</h3>
                <p>{{ primaryContactLine() }}</p>
              </div>

              @if (person()!.archived_at) {
                <app-status-badge label="Archived" tone="archived" />
              }
            </div>

            <div class="identity-meta">
              <p><span>Mobile</span>{{ displayValue(person()!.mobile) }}</p>
              <p><span>Location</span>{{ displayValue(person()!.location) }}</p>
            </div>
          </section>

          <app-crm-section-card title="Personal details">
            <app-detail-list [items]="personalDetails()" />
          </app-crm-section-card>

          <app-crm-section-card title="Record information">
            <app-detail-list [items]="recordInformation()" />
          </app-crm-section-card>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .detail-page {
      display: grid;
      gap: 0.9rem;
    }

    .detail-grid {
      display: grid;
      gap: 0.9rem;
    }

    .back-link,
    .state-link {
      width: fit-content;
      color: #1b546b;
      font-weight: 700;
      text-decoration: none;
    }

    .back-link:hover,
    .back-link:focus-visible,
    .state-link:hover,
    .state-link:focus-visible {
      text-decoration: underline;
      outline: none;
    }

    .identity-card {
      display: grid;
      gap: 1rem;
      padding: 1.2rem 1.25rem;
      border-radius: 1.1rem;
      border: 1px solid rgba(22, 39, 53, 0.08);
      background: rgba(255, 255, 255, 0.88);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.85),
        0 10px 24px rgba(17, 29, 40, 0.04);
    }

    .identity-topline {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .identity-copy {
      display: grid;
      gap: 0.35rem;
    }

    .identity-copy h3,
    .identity-copy p,
    .identity-meta p,
    .identity-meta span {
      margin: 0;
    }

    .identity-copy h3 {
      font-size: clamp(1.45rem, 3vw, 2rem);
      line-height: 1.1;
      color: #1a3142;
    }

    .identity-copy p,
    .identity-meta p {
      color: #4f697b;
      line-height: 1.5;
    }

    .identity-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem 1.2rem;
    }

    .identity-meta p {
      display: grid;
      gap: 0.18rem;
    }

    .identity-meta span {
      font-size: 0.8rem;
      font-weight: 700;
      color: #617b8c;
    }

    @media (max-width: 680px) {
      .identity-meta {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PersonDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly person = signal<PersonListItem | null>(null);

  readonly fullName = computed(() => {
    const person = this.person();
    return person ? `${person.first_name} ${person.last_name}` : 'Person';
  });

  readonly personalDetails = computed<DetailListItem[]>(() => {
    const person = this.person();
    if (!person) {
      return [];
    }

    return [
      { label: 'First name', value: person.first_name },
      { label: 'Last name', value: person.last_name },
      { label: 'Email', value: person.primary_email },
      { label: 'Mobile', value: person.mobile },
      { label: 'Location', value: person.location },
      { label: 'Age range', value: person.age_range },
      { label: 'Gender', value: person.gender },
    ];
  });

  readonly recordInformation = computed<DetailListItem[]>(() => {
    const person = this.person();
    if (!person) {
      return [];
    }

    return [
      { label: 'Status', value: person.archived_at ? 'Archived' : 'Active' },
      { label: 'Created', value: formatDateTime(person.created_at) },
      { label: 'Last updated', value: formatDateTime(person.updated_at) },
      { label: 'Archived on', value: person.archived_at ? formatDateTime(person.archived_at) : null },
    ];
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((personId) => {
        if (!Number.isInteger(personId) || personId <= 0) {
          this.showNotFound();
          return;
        }

        this.loadPerson(personId);
      });
  }

  primaryContactLine(): string {
    const person = this.person();
    if (!person) {
      return 'Not provided';
    }

    if (person.primary_email) {
      return person.primary_email;
    }

    if (person.mobile.trim()) {
      return person.mobile;
    }

    return 'Not provided';
  }

  displayValue(value: string | null | undefined): string {
    return value && value.trim() ? value : 'Not provided';
  }

  private loadPerson(personId: number): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.errorMessage.set(null);
    this.person.set(null);

    this.peopleService
      .getPerson(personId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (person) => {
          this.person.set(person);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.person.set(null);
          this.loading.set(false);

          if (error.status === 404) {
            this.showNotFound();
            return;
          }

          this.errorMessage.set('The person record could not be loaded right now.');
        },
      });
  }

  private showNotFound(): void {
    this.loading.set(false);
    this.person.set(null);
    this.errorMessage.set(null);
    this.notFound.set(true);
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
