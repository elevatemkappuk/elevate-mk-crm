import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { canManagePeople } from '../../core/auth/auth-access';
import { DashboardService } from '../../core/dashboard/dashboard.service';
import { DashboardProjection } from '../../core/dashboard/dashboard.types';
import { DEFAULT_PEOPLE_DIRECTORY_QUERY, serializePeopleDirectoryQuery } from '../../core/people/people-directory-query';
import { PersonRelationshipFilter } from '../../core/people/people.types';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { AddPersonDrawerComponent } from '../people/add-person-drawer.component';
import { MembershipFormUploadComponent } from '../imports/membership-form-upload.component';
import { CommunityGrowthComponent } from './community-growth.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, CrmSectionCardComponent, StateMessageComponent, StatusBadgeComponent, AddPersonDrawerComponent, MembershipFormUploadComponent, CommunityGrowthComponent],
  template: `
    <section class="dashboard crm-page">
      <header class="crm-page-heading"><h1 class="crm-page-heading__title">Dashboard</h1></header>
      @if (loading()) {
        <div class="loading" aria-busy="true"><app-state-message title="Loading Dashboard" message="Retrieving your CRM overview." /><div class="overview skeleton" aria-hidden="true">@for (card of overview; track card.key) { <div></div> }</div><div class="panels skeleton" aria-hidden="true"><div></div><div></div></div></div>
      } @else if (error()) {
        <app-state-message title="Dashboard unavailable" message="The Dashboard could not be loaded. Please try again." tone="error"><button class="crm-button crm-button--secondary" type="button" (click)="load()">Retry</button></app-state-message>
      } @else if (data(); as dashboard) {
        <div class="overview">
          @for (card of overview; track card.key) {
            <a class="metric" routerLink="/people" [queryParams]="card.params"><span>{{ card.label }}</span><strong>{{ dashboard.overview[card.key] }}</strong><span class="affordance" aria-hidden="true">&rarr;</span></a>
          }
        </div>
        <div class="panels">
          <app-crm-section-card><h2>Community growth</h2><app-community-growth [growth]="dashboard.growth" /></app-crm-section-card>
          <app-crm-section-card><h2>Community profile</h2><div class="profile-grid">
            @for (section of profileSections; track section.key) {
              <section class="profile"><h3>{{ section.label }}</h3><dl>@for (item of dashboard.community_profile[section.key]; track $index) { <div><dt>{{ item.label }}</dt><dd>{{ item.count }}</dd></div> } @empty { <p>{{ section.empty }}</p> }</dl></section>
            }
          </div></app-crm-section-card>
          <app-crm-section-card><h2>Events</h2><div class="events-placeholder"><app-status-badge label="Coming soon" tone="neutral" /><p class="muted">Event activity and participation will appear here.</p></div></app-crm-section-card>
          <app-crm-section-card><h2>Needs attention</h2>
            @if (auth.isCrmAdmin()) { <a class="attention" routerLink="/imports"><span>Historical imports needing review</span><strong>{{ dashboard.attention.imports_needing_review }}</strong><span aria-hidden="true">&rarr;</span></a> }
            @else { <div class="attention"><span>Historical imports needing review</span><strong>{{ dashboard.attention.imports_needing_review }}</strong></div> }
            <a class="attention" routerLink="/people" [queryParams]="archivedParams"><span>Archived people</span><strong>{{ dashboard.attention.archived_people }}</strong><span aria-hidden="true">&rarr;</span></a>
          </app-crm-section-card>
        </div>
      }
      <app-crm-section-card><h2>Quick actions</h2><div class="quick-actions">
        @if (canManage()) { <button class="crm-button brand-action" type="button" (click)="addOpen.set(true)">Add person</button> }
        <a class="crm-button crm-button--secondary" routerLink="/people">View People</a>
        @if (auth.isCrmAdmin()) { <button class="crm-button crm-button--secondary" type="button" (click)="uploadOpen.set(true)">Upload historical records</button> }
      </div></app-crm-section-card>
      @if (addOpen() && canManage()) { <app-add-person-drawer (closed)="addOpen.set(false); load()" /> }
      @if (uploadOpen() && auth.isCrmAdmin()) { <app-historical-import-upload (cancelled)="uploadOpen.set(false)" (completed)="uploaded()" /> }
    </section>
  `,
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly canManage = computed(() => canManagePeople(this.auth.currentUser()));
  readonly data = signal<DashboardProjection | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly addOpen = signal(false);
  readonly uploadOpen = signal(false);
  readonly archivedParams = serializePeopleDirectoryQuery({ ...DEFAULT_PEOPLE_DIRECTORY_QUERY, record_state: 'archived' });
  private relationship(value?: PersonRelationshipFilter) { return serializePeopleDirectoryQuery({ ...DEFAULT_PEOPLE_DIRECTORY_QUERY, relationship: value ? [value] : [] }); }
  readonly overview = [
    { key: 'total_people', label: 'People', params: this.relationship() },
    { key: 'active_members', label: 'Active Members', params: this.relationship('ACTIVE_MEMBER') },
    { key: 'contacts', label: 'Contacts', params: this.relationship('CONTACT') },
    { key: 'former_members', label: 'Former Members', params: this.relationship('FORMER_MEMBER') },
  ] as const;
  readonly profileSections = [
    { key: 'top_locations', label: 'Top locations', empty: 'No location data yet.' },
    { key: 'top_industries', label: 'Top industries', empty: 'No industry data yet.' },
    { key: 'age_ranges', label: 'Age range', empty: 'No age range data yet.' },
  ] as const;
  constructor() { this.load(); }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true); this.error.set(false);
    this.api.getDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { this.data.set(data); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }
  uploaded(): void { this.uploadOpen.set(false); void this.router.navigate(['/imports']); }
}
