import { CommonModule } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PeopleService } from '../../core/people/people.service';
import { Industry, InterestSummary, PeopleDirectoryQuery, PersonRelationshipFilter, ProfessionalProfileCareerStage, SkillSummary, TagSummary } from '../../core/people/people.types';

const RELATIONSHIPS: ReadonlyArray<{ value: PersonRelationshipFilter; label: string }> = [
  { value: 'CONTACT', label: 'Contact' }, { value: 'ACTIVE_MEMBER', label: 'Active Member' }, { value: 'FORMER_MEMBER', label: 'Former Member' },
];
const CAREER_STAGES: ReadonlyArray<{ value: ProfessionalProfileCareerStage; label: string }> = [
  { value: 'STUDENT', label: 'Student' }, { value: 'EARLY_CAREER', label: 'Early Career' }, { value: 'MID_CAREER', label: 'Mid Career' }, { value: 'SENIOR', label: 'Senior' }, { value: 'LEADERSHIP', label: 'Leadership' }, { value: 'FOUNDER_BUSINESS_OWNER', label: 'Founder / Business Owner' }, { value: 'OTHER', label: 'Other' },
];

@Component({
  selector: 'app-people-directory-filters',
  imports: [CommonModule],
  template: `
    <section class="filters" aria-label="People directory filters">
      <div class="topline">
        <form (submit)="submitSearch($event)" class="search"><label for="people-search">Search</label><input id="people-search" [value]="searchValue()" (input)="searchValue.set($any($event.target).value)" placeholder="Name, email, mobile, job title, or company" /><button type="submit">Search</button></form>
        <button type="button" class="toggle" [attr.aria-expanded]="expanded()" (click)="expanded.update((value) => !value)">Filters ({{ activeFilterCount() }})</button>
      </div>
      @if (expanded()) {
        <div class="panel">
          <fieldset><legend>Relationship</legend>@for (option of relationships; track option.value) { <label><input type="checkbox" [checked]="query().relationship.includes(option.value)" (change)="toggleRelationship(option.value)" />{{ option.label }}</label> }</fieldset>
          <fieldset><legend>Location</legend><div class="location-entry"><input [value]="locationValue()" (input)="locationValue.set($any($event.target).value)" placeholder="Exact location" /><button type="button" (click)="addLocation()">Add</button></div>@for (location of query().location; track location) { <button type="button" class="chip" (click)="removeLocation(location)">{{ location }} ×</button> }</fieldset>
          <fieldset><legend>Industry</legend>@for (option of industries(); track option.id) { <label><input type="checkbox" [checked]="query().industry.includes(option.id)" (change)="toggleNumber('industry', option.id)" />{{ option.name }}</label> } @for (id of unresolvedIds('industry'); track id) { <button type="button" class="chip" (click)="toggleNumber('industry', id)">Industry #{{ id }} ×</button> }</fieldset>
          <fieldset><legend>Career stage</legend>@for (option of careerStages; track option.value) { <label><input type="checkbox" [checked]="query().career_stage.includes(option.value)" (change)="toggleCareerStage(option.value)" />{{ option.label }}</label> }</fieldset>
          <fieldset><legend>Interests</legend>@for (option of interests(); track option.id) { <label><input type="checkbox" [checked]="query().interest.includes(option.id)" (change)="toggleNumber('interest', option.id)" />{{ option.name }}</label> } @for (id of unresolvedIds('interest'); track id) { <button type="button" class="chip" (click)="toggleNumber('interest', id)">Interest #{{ id }} ×</button> }</fieldset>
          <fieldset><legend>Skills</legend>@for (option of skills(); track option.id) { <label><input type="checkbox" [checked]="query().skill.includes(option.id)" (change)="toggleNumber('skill', option.id)" />{{ option.name }}</label> } @for (id of unresolvedIds('skill'); track id) { <button type="button" class="chip" (click)="toggleNumber('skill', id)">Skill #{{ id }} ×</button> }</fieldset>
          <fieldset><legend>Tags</legend>@for (option of tags(); track option.id) { <label><input type="checkbox" [checked]="query().tag.includes(option.id)" (change)="toggleNumber('tag', option.id)" />{{ option.name }}</label> } @for (id of unresolvedIds('tag'); track id) { <button type="button" class="chip" (click)="toggleNumber('tag', id)">Tag #{{ id }} ×</button> }</fieldset>
          @if (catalogError()) { <p class="catalog-error">Some filter options could not be loaded. Existing URL filters remain active.</p> }
          <button type="button" class="clear" (click)="cleared.emit()">Clear filters</button>
        </div>
      }
    </section>
  `,
  styles: `
    .filters,.topline,.search,.panel,.location-entry { display:grid; gap:.8rem; } .topline { grid-template-columns:minmax(0,1fr) auto; align-items:end; } .search { grid-template-columns:1fr auto; } .search label { grid-column:1/-1; font-weight:700; color:#345165; } input,button { font:inherit; } input { min-width:0; padding:.65rem .75rem; border:1px solid #b7c7d4; border-radius:.7rem; } button { border:0; border-radius:999px; padding:.65rem .9rem; font-weight:700; cursor:pointer; color:#234257; background:#edf3f6; } .panel { grid-template-columns:repeat(3,minmax(0,1fr)); padding-top:.2rem; } fieldset { display:grid; align-content:start; gap:.45rem; min-width:0; padding:.8rem; border:1px solid rgba(22,39,53,.1); border-radius:.75rem; } legend { font-weight:700; color:#294456; } label { display:flex; align-items:center; gap:.45rem; color:#496576; } label input { min-width:auto; padding:0; } .chip { width:fit-content; padding:.35rem .55rem; font-size:.85rem; } .clear { width:fit-content; } .catalog-error { grid-column:1/-1; margin:0; color:#9b1c1c; } @media(max-width:850px){.panel{grid-template-columns:repeat(2,minmax(0,1fr));}} @media(max-width:580px){.topline,.search,.panel{grid-template-columns:1fr;}.toggle{width:fit-content;}}
  `,
})
export class PeopleDirectoryFiltersComponent {
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);
  readonly query = input.required<PeopleDirectoryQuery>();
  readonly changed = output<Partial<PeopleDirectoryQuery>>();
  readonly cleared = output<void>();
  readonly expanded = signal(false);
  readonly searchValue = signal('');
  readonly locationValue = signal('');
  readonly industries = signal<Industry[]>([]); readonly interests = signal<InterestSummary[]>([]); readonly skills = signal<SkillSummary[]>([]); readonly tags = signal<TagSummary[]>([]);
  readonly catalogError = signal(false);
  readonly relationships = RELATIONSHIPS; readonly careerStages = CAREER_STAGES;

  constructor() {
    effect(() => this.searchValue.set(this.query().q));
    this.loadCatalogs();
  }

  activeFilterCount(): number { const query = this.query(); return Number(Boolean(query.q)) + query.relationship.length + query.location.length + query.industry.length + query.career_stage.length + query.interest.length + query.skill.length + query.tag.length + Number(query.record_state !== 'active') + Number(query.ordering !== 'last_name'); }
  submitSearch(event: SubmitEvent): void { event.preventDefault(); this.changed.emit({ q: this.searchValue().trim() }); }
  toggleRelationship(value: PersonRelationshipFilter): void { this.changed.emit({ relationship: toggle(this.query().relationship, value) }); }
  toggleCareerStage(value: ProfessionalProfileCareerStage): void { this.changed.emit({ career_stage: toggle(this.query().career_stage, value) }); }
  toggleNumber(kind: 'industry' | 'interest' | 'skill' | 'tag', id: number): void { this.changed.emit({ [kind]: toggle(this.query()[kind], id) }); }
  addLocation(): void { const location = this.locationValue().trim(); if (location && !this.query().location.includes(location)) { this.changed.emit({ location: [...this.query().location, location] }); } this.locationValue.set(''); }
  removeLocation(location: string): void { this.changed.emit({ location: this.query().location.filter((item) => item !== location) }); }
  unresolvedIds(kind: 'industry' | 'interest' | 'skill' | 'tag'): number[] { const ids = this.query()[kind]; const options = kind === 'industry' ? this.industries() : kind === 'interest' ? this.interests() : kind === 'skill' ? this.skills() : this.tags(); return ids.filter((id) => !options.some((option) => option.id === id)); }

  private loadCatalogs(): void {
    this.peopleService.getIndustries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.industries.set(value), error: () => this.catalogError.set(true) });
    this.peopleService.getInterests().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.interests.set(value), error: () => this.catalogError.set(true) });
    this.peopleService.getSkills().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.skills.set(value), error: () => this.catalogError.set(true) });
    this.peopleService.getTags().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.tags.set(value), error: () => this.catalogError.set(true) });
  }
}

function toggle<T>(values: T[], value: T): T[] { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
