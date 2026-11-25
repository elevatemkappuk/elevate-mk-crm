import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PeopleService } from '../../core/people/people.service';
import { Industry, InterestSummary, PeopleDirectoryQuery, PersonRecordType, PersonRelationshipFilter, ProfessionalProfileCareerStage, SkillSummary, TagSummary } from '../../core/people/people.types';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';
import { FilterMultiselectComponent } from './filter-multiselect.component';

const RELATIONSHIPS: ReadonlyArray<{ value: PersonRelationshipFilter; label: string }> = [
  { value: 'CONTACT', label: 'Contact' }, { value: 'ACTIVE_MEMBER', label: 'Active Member' }, { value: 'FORMER_MEMBER', label: 'Former Member' },
];
const CAREER_STAGES: ReadonlyArray<{ value: ProfessionalProfileCareerStage; label: string }> = [
  { value: 'STUDENT', label: 'Student' }, { value: 'EARLY_CAREER', label: 'Early Career' }, { value: 'MID_CAREER', label: 'Mid Career' }, { value: 'SENIOR', label: 'Senior' }, { value: 'LEADERSHIP', label: 'Leadership' }, { value: 'FOUNDER_BUSINESS_OWNER', label: 'Founder / Business Owner' }, { value: 'OTHER', label: 'Other' },
];
const RECORD_TYPES: ReadonlyArray<{ value: PersonRecordType; label: string }> = [
  { value: 'COMMUNITY', label: 'Community' }, { value: 'STAFF', label: 'Staff' }, { value: 'TECHNICAL', label: 'Technical' },
];

type FilterDraft = Omit<Pick<PeopleDirectoryQuery, 'q' | 'relationship' | 'location' | 'industry' | 'career_stage' | 'interest' | 'skill' | 'tag' | 'record_type'>, 'record_type'> & { record_type: PersonRecordType[] };
type CatalogKey = 'industry' | 'interest' | 'skill' | 'tag';
interface AppliedChip { key: string; label: string; patch: Partial<PeopleDirectoryQuery>; }
let nextFilterDrawerId = 0;

@Component({
  selector: 'app-people-directory-filters',
  imports: [CrmDrawerComponent, FilterMultiselectComponent],
  templateUrl: './people-directory-filters.component.html',
  styleUrl: './people-directory-filters.component.css',
})
export class PeopleDirectoryFiltersComponent {
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);
  readonly query = input.required<PeopleDirectoryQuery>();
  readonly contactSearchAllowed = input(false);
  readonly compact = input(false);
  readonly changed = output<Partial<PeopleDirectoryQuery>>();
  readonly cleared = output<void>();
  readonly draft = signal<FilterDraft | null>(null);
  readonly expanded = computed(() => this.draft() !== null);
  readonly drawerId = 'people-filter-drawer-' + nextFilterDrawerId++;
  readonly searchValue = signal('');
  readonly locationValue = signal('');
  readonly industries = signal<Industry[]>([]); readonly interests = signal<InterestSummary[]>([]); readonly skills = signal<SkillSummary[]>([]); readonly tags = signal<TagSummary[]>([]);
  readonly catalogError = signal(false);
  readonly relationships = RELATIONSHIPS; readonly careerStages = CAREER_STAGES; readonly recordTypes = RECORD_TYPES;

  constructor() {
    effect(() => {
      this.searchValue.set(this.query().q);
      // Back/forward or another URL change replaces the applied state and ends the old draft.
      this.closeDrawer();
    });
    this.loadCatalogs();
  }

  activeFilterCount(): number { const query = this.query(); return Number(Boolean(query.q)) + query.relationship.length + query.location.length + query.industry.length + query.career_stage.length + query.interest.length + query.skill.length + query.tag.length + (query.record_type ?? []).length + Number(query.record_state !== 'active') + Number(query.ordering !== 'last_name'); }
  submitSearch(event: SubmitEvent): void { event.preventDefault(); this.changed.emit({ q: this.searchValue().trim() }); }

  openDrawer(): void {
    const query = this.query();
    this.draft.set({ q: query.q, relationship: [...query.relationship], location: [...query.location], industry: [...query.industry], career_stage: [...query.career_stage], interest: [...query.interest], skill: [...query.skill], tag: [...query.tag], record_type: [...(query.record_type ?? [])] });
    this.locationValue.set('');
  }
  closeDrawer(): void { this.draft.set(null); this.locationValue.set(''); }
  clearDraft(): void {
    const draft = this.draft();
    if (draft) {
      this.draft.set({
        q: this.compact() ? '' : draft.q,
        relationship: [],
        location: [],
        industry: [],
        career_stage: [],
        interest: [],
        skill: [],
        tag: [],
        record_type: [],
      });
    }
    this.locationValue.set('');
  }
  applyFilters(): void { const draft = this.draft(); if (!draft) return; this.changed.emit(draft); this.closeDrawer(); }
  updateDraftSearch(value: string): void { this.searchValue.set(value); this.draft.update((draft) => draft ? { ...draft, q: value } : draft); }
  toggleRelationship(value: PersonRelationshipFilter): void { this.draft.update(draft => draft ? { ...draft, relationship: toggle(draft.relationship, value) } : null); }
  toggleCareerStage(value: ProfessionalProfileCareerStage): void { this.draft.update(draft => draft ? { ...draft, career_stage: toggle(draft.career_stage, value) } : null); }
  toggleRecordType(value: PersonRecordType): void { this.draft.update(draft => draft ? { ...draft, record_type: toggle(draft.record_type, value) } : null); }
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
    for (const value of query.record_type ?? []) chips.push({ key: 'record_type:' + value, label: RECORD_TYPES.find(option => option.value === value)!.label, patch: { record_type: (query.record_type ?? []).filter(item => item !== value) } });
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
  readonly criteriaChips = computed(() => this.activeChips().filter((chip) => chip.key !== 'record_state' && chip.key !== 'ordering'));

  private loadCatalogs(): void {
    this.peopleService.getIndustries().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.industries.set(value), error: () => this.catalogError.set(true) });
    this.peopleService.getInterests().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.interests.set(value), error: () => this.catalogError.set(true) });
    this.peopleService.getSkills().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.skills.set(value), error: () => this.catalogError.set(true) });
    this.peopleService.getTags().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => this.tags.set(value), error: () => this.catalogError.set(true) });
  }
}
function toggle<T>(values: T[], value: T): T[] { return values.includes(value) ? values.filter(item => item !== value) : [...values, value]; }
