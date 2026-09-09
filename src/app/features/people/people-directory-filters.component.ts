import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PeopleService } from '../../core/people/people.service';
import { Industry, InterestSummary, PeopleDirectoryQuery, PersonRelationshipFilter, ProfessionalProfileCareerStage, SkillSummary, TagSummary } from '../../core/people/people.types';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';
import { FilterMultiselectComponent } from './filter-multiselect.component';

const RELATIONSHIPS: ReadonlyArray<{ value: PersonRelationshipFilter; label: string }> = [
  { value: 'CONTACT', label: 'Contact' }, { value: 'ACTIVE_MEMBER', label: 'Active Member' }, { value: 'FORMER_MEMBER', label: 'Former Member' },
];
const CAREER_STAGES: ReadonlyArray<{ value: ProfessionalProfileCareerStage; label: string }> = [
  { value: 'STUDENT', label: 'Student' }, { value: 'EARLY_CAREER', label: 'Early Career' }, { value: 'MID_CAREER', label: 'Mid Career' }, { value: 'SENIOR', label: 'Senior' }, { value: 'LEADERSHIP', label: 'Leadership' }, { value: 'FOUNDER_BUSINESS_OWNER', label: 'Founder / Business Owner' }, { value: 'OTHER', label: 'Other' },
];

type FilterDraft = Pick<PeopleDirectoryQuery, 'relationship' | 'location' | 'industry' | 'career_stage' | 'interest' | 'skill' | 'tag'>;
type CatalogKey = 'industry' | 'interest' | 'skill' | 'tag';
interface AppliedChip { key: string; label: string; patch: Partial<PeopleDirectoryQuery>; }
let nextFilterDrawerId = 0;

@Component({
  selector: 'app-people-directory-filters',
  imports: [CrmDrawerComponent, FilterMultiselectComponent],
  template: `
    <section class="filters" aria-label="People directory filters">
      <div class="topline">
        <form (submit)="submitSearch($event)" class="search">
          <label for="people-search">Search</label>
          <input id="people-search" class="crm-control" [value]="searchValue()" (input)="searchValue.set($any($event.target).value)" placeholder="Name, email, mobile, job title, or company" />
          <button type="submit" class="crm-button crm-button--secondary">Search</button>
        </form>
        <button type="button" class="toggle crm-button crm-button--secondary" aria-haspopup="dialog"
          [attr.aria-expanded]="expanded()" [attr.aria-controls]="expanded() ? drawerId : null" (click)="openDrawer()">Filters ({{ activeFilterCount() }})</button>
      </div>
      @if (activeChips().length) {
        <div class="applied-chips" aria-label="Applied filters">
          @for (chip of activeChips(); track chip.key) {
            <button type="button" class="crm-chip" [attr.aria-label]="'Remove ' + chip.label" (click)="changed.emit(chip.patch)">{{ chip.label }} <span aria-hidden="true">&times;</span></button>
          }
          <button type="button" class="clear crm-button crm-button--quiet" (click)="cleared.emit()">Clear filters</button>
        </div>
      }
    </section>
    @if (draft(); as values) {
      <app-crm-drawer title="Filters" description="Refine the People directory" [dialogId]="drawerId" (closed)="closeDrawer()">
        <div class="draft-panel">
          <fieldset>
            <legend>Relationship</legend>
            @for (option of relationships; track option.value) {
              <label class="choice"><input type="checkbox" class="crm-check" [checked]="values.relationship.includes(option.value)" (change)="toggleRelationship(option.value)" />{{ option.label }}</label>
            }
          </fieldset>
          <fieldset>
            <legend>Location</legend>
            <form class="location-entry" (submit)="$event.preventDefault(); addLocation()">
              <label for="filter-exact-location">Exact location</label>
              <input id="filter-exact-location" class="crm-control" [value]="locationValue()" (input)="locationValue.set($any($event.target).value)" placeholder="Exact location" />
              <button type="submit" class="crm-button crm-button--secondary">Add location</button>
            </form>
            <div class="chips">
              @for (location of values.location; track location) {
                <button type="button" class="crm-chip" [attr.aria-label]="'Remove location ' + location" (click)="removeLocation(location)">{{ location }} <span aria-hidden="true">&times;</span></button>
              }
            </div>
          </fieldset>
          <app-filter-multiselect label="Industry" fallbackLabel="Industry" [options]="industries()" [selected]="values.industry" (selectionChanged)="setSelection('industry', $event)" />
          <fieldset>
            <legend>Career stage</legend>
            @for (option of careerStages; track option.value) {
              <label class="choice"><input type="checkbox" class="crm-check" [checked]="values.career_stage.includes(option.value)" (change)="toggleCareerStage(option.value)" />{{ option.label }}</label>
            }
          </fieldset>
          <app-filter-multiselect label="Interests" fallbackLabel="Interest" [options]="interests()" [selected]="values.interest" (selectionChanged)="setSelection('interest', $event)" />
          <app-filter-multiselect label="Skills" fallbackLabel="Skill" [options]="skills()" [selected]="values.skill" (selectionChanged)="setSelection('skill', $event)" />
          <app-filter-multiselect label="Tags" fallbackLabel="Tag" [options]="tags()" [selected]="values.tag" (selectionChanged)="setSelection('tag', $event)" />
          @if (catalogError()) { <p class="catalog-error" role="status">Some filter options could not be loaded. Existing URL filters remain active.</p> }
        </div>
        <div drawerFooter class="drawer-actions">
          <button type="button" class="crm-button crm-button--quiet" (click)="clearDraft()">Clear all</button>
          <div class="footer-end">
            <button type="button" class="crm-button crm-button--secondary" (click)="closeDrawer()">Cancel</button>
            <button type="button" class="apply crm-button" (click)="applyFilters()">Apply filters</button>
          </div>
        </div>
      </app-crm-drawer>
    }
  `,
  styles: `
    :host { display:block; min-width:0; }
    .filters,.topline,.search,.location-entry { display:grid; gap:.8rem; min-width:0; }
    .topline { grid-template-columns:minmax(0,1fr) auto; align-items:end; }
    .search,.location-entry { grid-template-columns:minmax(0,1fr) auto; }
    .search label,.location-entry label { grid-column:1/-1; font-weight:600; }
    .applied-chips,.chips,.drawer-actions,.footer-end { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; }
    .crm-chip { max-width:100%; overflow-wrap:anywhere; text-align:left; cursor:pointer; }
    app-crm-drawer { --crm-drawer-width:34rem; }
    .draft-panel { display:grid; gap:1.75rem; padding-bottom:1.5rem; }
    fieldset { display:grid; gap:.4rem; min-width:0; margin:0; padding:0; border:0; }
    legend { padding:0; margin-bottom:.65rem; font-weight:600; }
    .choice { display:flex; align-items:center; gap:.65rem; min-height:2.5rem; cursor:pointer; }
    .drawer-actions { justify-content:space-between; }
    .footer-end { margin-left:auto; }
    .apply { background:var(--crm-shell-accent); color:var(--crm-text-strong); }
    .apply:hover { background:#f3c64c; }
    .catalog-error { margin:0; color:var(--crm-error); }
    :is(button,input):focus-visible { outline:2px solid var(--crm-focus-ring); outline-offset:2px; }
    @media(max-width:580px) { .topline { grid-template-columns:minmax(0,1fr); } .toggle { width:fit-content; } .location-entry { grid-template-columns:minmax(0,1fr); } }
  `,
})
export class PeopleDirectoryFiltersComponent {
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);
  readonly query = input.required<PeopleDirectoryQuery>();
  readonly changed = output<Partial<PeopleDirectoryQuery>>();
  readonly cleared = output<void>();
  readonly draft = signal<FilterDraft | null>(null);
  readonly expanded = computed(() => this.draft() !== null);
  readonly drawerId = 'people-filter-drawer-' + nextFilterDrawerId++;
  readonly searchValue = signal('');
  readonly locationValue = signal('');
  readonly industries = signal<Industry[]>([]); readonly interests = signal<InterestSummary[]>([]); readonly skills = signal<SkillSummary[]>([]); readonly tags = signal<TagSummary[]>([]);
  readonly catalogError = signal(false);
  readonly relationships = RELATIONSHIPS; readonly careerStages = CAREER_STAGES;

  constructor() {
    effect(() => {
      this.searchValue.set(this.query().q);
      // Back/forward or another URL change replaces the applied state and ends the old draft.
      this.closeDrawer();
    });
    this.loadCatalogs();
  }

  activeFilterCount(): number { const query = this.query(); return Number(Boolean(query.q)) + query.relationship.length + query.location.length + query.industry.length + query.career_stage.length + query.interest.length + query.skill.length + query.tag.length + Number(query.record_state !== 'active') + Number(query.ordering !== 'last_name'); }
  submitSearch(event: SubmitEvent): void { event.preventDefault(); this.changed.emit({ q: this.searchValue().trim() }); }

  openDrawer(): void {
    const query = this.query();
    this.draft.set({ relationship: [...query.relationship], location: [...query.location], industry: [...query.industry], career_stage: [...query.career_stage], interest: [...query.interest], skill: [...query.skill], tag: [...query.tag] });
    this.locationValue.set('');
  }
  closeDrawer(): void { this.draft.set(null); this.locationValue.set(''); }
  clearDraft(): void { if (this.draft()) this.draft.set({ relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [] }); this.locationValue.set(''); }
  applyFilters(): void { const draft = this.draft(); if (!draft) return; this.changed.emit(draft); this.closeDrawer(); }
  toggleRelationship(value: PersonRelationshipFilter): void { this.draft.update(draft => draft ? { ...draft, relationship: toggle(draft.relationship, value) } : null); }
  toggleCareerStage(value: ProfessionalProfileCareerStage): void { this.draft.update(draft => draft ? { ...draft, career_stage: toggle(draft.career_stage, value) } : null); }
  setSelection(kind: CatalogKey, values: number[]): void { this.draft.update(draft => draft ? { ...draft, [kind]: values } : null); }
  addLocation(): void {
    const location = this.locationValue().trim();
    this.draft.update(draft => draft && location && !draft.location.includes(location) ? { ...draft, location: [...draft.location, location] } : draft);
    this.locationValue.set('');
  }
  removeLocation(location: string): void { this.draft.update(draft => draft ? { ...draft, location: draft.location.filter(item => item !== location) } : null); }

  readonly activeChips = computed<AppliedChip[]>(() => {
    const query = this.query();
    const chips: AppliedChip[] = [];
    if (query.q) chips.push({ key: 'q', label: 'Search: ' + query.q, patch: { q: '' } });
    for (const value of query.relationship) chips.push({ key: 'relationship:' + value, label: RELATIONSHIPS.find(option => option.value === value)!.label, patch: { relationship: query.relationship.filter(item => item !== value) } });
    for (const value of query.location) chips.push({ key: 'location:' + value, label: value, patch: { location: query.location.filter(item => item !== value) } });
    for (const value of query.career_stage) chips.push({ key: 'career_stage:' + value, label: CAREER_STAGES.find(option => option.value === value)!.label, patch: { career_stage: query.career_stage.filter(item => item !== value) } });
    const catalogs = [
      { key: 'industry' as const, label: 'Industry', options: this.industries() },
      { key: 'interest' as const, label: 'Interest', options: this.interests() },
      { key: 'skill' as const, label: 'Skill', options: this.skills() },
      { key: 'tag' as const, label: 'Tag', options: this.tags() },
    ];
    for (const catalog of catalogs) for (const id of query[catalog.key]) chips.push({ key: catalog.key + ':' + id, label: catalog.options.find(option => option.id === id)?.name ?? catalog.label + ' #' + id, patch: { [catalog.key]: query[catalog.key].filter(value => value !== id) } });
    if (query.record_state !== 'active') chips.push({ key: 'record_state', label: query.record_state === 'all' ? 'All records' : 'Archived records', patch: { record_state: 'active' } });
    if (query.ordering !== 'last_name') {
      const field = query.ordering.replace(/^-/, '');
      const labels: Record<string, string> = { name: 'Name', first_name: 'First name', last_name: 'Last name', created_at: 'Created', updated_at: 'Updated', membership_joined_at: 'Membership join date' };
      chips.push({ key: 'ordering', label: 'Order: ' + labels[field] + (query.ordering.startsWith('-') ? ' (descending)' : ' (ascending)'), patch: { ordering: 'last_name' } });
    }
    return chips;
  });

  private loadCatalogs(): void {
    this.peopleService.getIndustries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.industries.set(value), error: () => this.catalogError.set(true) });
    this.peopleService.getInterests().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.interests.set(value), error: () => this.catalogError.set(true) });
    this.peopleService.getSkills().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.skills.set(value), error: () => this.catalogError.set(true) });
    this.peopleService.getTags().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.tags.set(value), error: () => this.catalogError.set(true) });
  }
}

function toggle<T>(values: T[], value: T): T[] { return values.includes(value) ? values.filter(item => item !== value) : [...values, value]; }
