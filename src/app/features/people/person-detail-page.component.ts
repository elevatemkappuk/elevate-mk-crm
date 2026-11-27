import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

import { canManagePeople, hasStaffCrmAccess, hasStaffRole } from '../../core/auth/auth-access';
import { AuthService } from '../../core/auth/auth.service';
import { StaffAccessService } from '../../core/auth/staff-access.service';
import { formatForbiddenError } from '../../core/http/forbidden-error';
import { PeopleService } from '../../core/people/people.service';
import { membershipSourceLabel } from '../../core/people/membership-source';
import { ageRangeLabel, genderLabel } from '../../core/people/person-demographics';
import {
  EndMembershipRequest,
  InterestSummary,
  Industry,
  MakeMembershipRequest,
  MarketingPreference,
  PersonListItem,
  PersonRecordType,
  PersonMembership,
  PersonOverview,
  ProfessionalProfile,
  ProfessionalProfileCareerStage,
  ProfessionalProfileWriteRequest,
  SkillSummary,
  TagSummary,
} from '../../core/people/people.types';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';
import { PersonWritePageComponent } from './person-write-page.component';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { DetailListComponent, DetailListItem } from '../../shared/ui/detail-list.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { PersonAuditHistorySectionComponent } from './person-audit-history-section.component';
import { PersonPrivacyAuditSectionComponent } from './person-privacy-audit-section.component';
import { PersonMarketingPreferenceSectionComponent } from './person-marketing-preference-section.component';
import { PersonBrevoIntegrationSectionComponent } from './person-brevo-integration-section.component';
import { PersonCommunityAccountSectionComponent } from './person-community-account-section.component';
import { PersonNotesSectionComponent } from './person-notes-section.component';
import { PersonProfileHeaderComponent } from './person-profile-header.component';
import { redactOverviewAfterAccessLoss } from '../../core/people/person-privacy';

type ProfessionalProfileFormMode = 'create' | 'edit' | null;
type SkillRemovalState = number | null;
type InterestRemovalState = number | null;
type TagRemovalState = number | null;

interface ProfessionalProfileFormValue {
  job_title: string;
  company: string;
  industry: string;
  career_stage: string;
  linkedin_url: string;
}
interface AssignSkillFormValue {
  skill: string;
}

@Component({
  selector: 'app-person-detail-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CrmSectionCardComponent,
    DetailListComponent,
    StateMessageComponent,
    StatusBadgeComponent,
    PersonAuditHistorySectionComponent,
    PersonPrivacyAuditSectionComponent,
    PersonMarketingPreferenceSectionComponent,
    PersonBrevoIntegrationSectionComponent,
    PersonCommunityAccountSectionComponent,
    PersonNotesSectionComponent,
    PersonProfileHeaderComponent,
    CrmDrawerComponent,
    PersonWritePageComponent,
  ],
  templateUrl: './person-detail-page.component.html',
  styleUrl: './person-detail-page.component.scss',
})
export class PersonDetailPageComponent {
  readonly editPersonOpen = signal(false);
  readonly activeTab = signal('overview');
  readonly profileTabs = computed(() => [
    { id: 'overview', label: 'Overview' }, { id: 'membership', label: 'Membership' },
    ...(this.canAccessInternalNotes() ? [{ id: 'notes', label: 'Notes' }] : []),
    ...(this.canAccessAuditHistory() ? [{ id: 'history', label: 'History' }] : []),
    ...(this.canAccessPrivacyAudit() ? [{ id: 'privacy', label: 'Privacy Audit' }] : []),
  ]);
  readonly selectedTab = computed(() => this.profileTabs().some(tab => tab.id === this.activeTab()) ? this.activeTab() : 'overview');
  readonly initials = computed(() => ((this.person()?.first_name?.[0] ?? '') + (this.person()?.last_name?.[0] ?? '')).toUpperCase());
  readonly returnCampaignId = signal<number | null>(null);

  personSaved(person: PersonListItem): void {
    this.overview.update(overview => overview ? { ...overview, person } : overview);
    this.editPersonOpen.set(false);
  }

  marketingPreferenceChanged(preference: MarketingPreference): void {
    this.overview.update(overview => overview ? { ...overview, marketing_preference: preference } : overview);
  }

  readonly careerStageOptions = CAREER_STAGE_OPTIONS;

  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly staffAccess = inject(StaffAccessService, { optional: true });
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly overview = signal<PersonOverview | null>(null);
  readonly showMakeMemberForm = signal(false);
  readonly makeMemberSubmitting = signal(false);
  readonly makeMemberErrorMessage = signal<string | null>(null);
  readonly showEndMembershipForm = signal(false);
  readonly endMembershipSubmitting = signal(false);
  readonly endMembershipErrorMessage = signal<string | null>(null);
  readonly showClassificationCorrection = signal(false);
  readonly classificationCorrectionSubmitting = signal(false);
  readonly classificationCorrectionErrorMessage = signal<string | null>(null);
  readonly personLifecycleSubmitting = signal(false);
  readonly personLifecycleErrorMessage = signal<string | null>(null);
  readonly industries = signal<Industry[]>([]);
  readonly industriesLoaded = signal(false);
  readonly industriesLoading = signal(false);
  readonly industriesLoadErrorMessage = signal<string | null>(null);
  readonly professionalProfileFormMode = signal<ProfessionalProfileFormMode>(null);
  readonly professionalProfileSubmitting = signal(false);
  readonly professionalProfileErrorMessage = signal<string | null>(null);
  readonly skillsCatalog = signal<SkillSummary[]>([]);
  readonly skillsCatalogLoaded = signal(false);
  readonly skillsCatalogLoading = signal(false);
  readonly skillsCatalogErrorMessage = signal<string | null>(null);
  readonly interestsCatalog = signal<InterestSummary[]>([]);
  readonly interestsCatalogLoaded = signal(false);
  readonly interestsCatalogLoading = signal(false);
  readonly interestsCatalogErrorMessage = signal<string | null>(null);
  readonly tagsCatalog = signal<TagSummary[]>([]);
  readonly tagsCatalogLoaded = signal(false);
  readonly tagsCatalogLoading = signal(false);
  readonly tagsCatalogErrorMessage = signal<string | null>(null);
  readonly showAddSkillForm = signal(false);
  readonly assigningSkill = signal(false);
  readonly skillWriteErrorMessage = signal<string | null>(null);
  readonly confirmingSkillRemovalId = signal<SkillRemovalState>(null);
  readonly removingSkillId = signal<SkillRemovalState>(null);
  readonly showAddInterestForm = signal(false);
  readonly assigningInterest = signal(false);
  readonly interestWriteErrorMessage = signal<string | null>(null);
  readonly confirmingInterestRemovalId = signal<InterestRemovalState>(null);
  readonly removingInterestId = signal<InterestRemovalState>(null);
  readonly showAddTagForm = signal(false);
  readonly assigningTag = signal(false);
  readonly tagWriteErrorMessage = signal<string | null>(null);
  readonly confirmingTagRemovalId = signal<TagRemovalState>(null);
  readonly removingTagId = signal<TagRemovalState>(null);
  readonly person = computed<PersonListItem | null>(() => this.overview()?.person ?? null);
  readonly canManagePeople = computed(() => canManagePeople(this.auth.currentUser()));
  readonly canCorrectClassification = computed(() => hasStaffRole(this.auth.currentUser(), 'CRM_ADMIN'));
  readonly classificationOptions: ReadonlyArray<{ value: PersonRecordType; label: string }> = [
    { value: 'COMMUNITY', label: 'Community' }, { value: 'STAFF', label: 'Staff' }, { value: 'TECHNICAL', label: 'Technical' },
  ];
  readonly membership = computed<PersonMembership | null>(() => this.overview()?.membership ?? null);
  readonly professionalProfile = computed<ProfessionalProfile | null>(() => this.overview()?.professional_profile ?? null);
  readonly skills = computed<SkillSummary[]>(() => this.overview()?.skills ?? []);
  readonly interests = computed<InterestSummary[]>(() => this.overview()?.interests ?? []);
  readonly tags = computed<TagSummary[]>(() => this.overview()?.tags ?? []);
  readonly marketingPreference = computed<MarketingPreference | null>(() => this.overview()?.marketing_preference ?? null);
  readonly relationshipLabel = computed(() => this.overview()?.relationship.label ?? 'Contact');
  readonly canMakeMember = computed(() => {
    const overview = this.overview();
    const person = overview?.person;
    const currentUser = this.auth.currentUser();

    if (!overview || !person || person.archived_at || overview.membership !== null || overview.relationship.type !== 'CONTACT') {
      return false;
    }

    return hasStaffRole(currentUser, 'CRM_ADMIN') || hasStaffRole(currentUser, 'CRM_MANAGER');
  });
  readonly canEndMembership = computed(() => {
    const overview = this.overview();
    const person = overview?.person;
    const membership = overview?.membership ?? null;
    const currentUser = this.auth.currentUser();

    if (
      !overview ||
      !person ||
      person.archived_at ||
      overview.relationship.type !== 'ACTIVE_MEMBER' ||
      membership === null ||
      membership.status !== 'ACTIVE'
    ) {
      return false;
    }

    return hasStaffRole(currentUser, 'CRM_ADMIN') || hasStaffRole(currentUser, 'CRM_MANAGER');
  });
  readonly canManageProfessionalProfile = computed(() => {
    const person = this.person();
    const currentUser = this.auth.currentUser();

    if (!person || person.archived_at) {
      return false;
    }

    return hasStaffRole(currentUser, 'CRM_ADMIN') || hasStaffRole(currentUser, 'CRM_MANAGER');
  });
  readonly canAddProfessionalProfile = computed(() => this.canManageProfessionalProfile() && this.professionalProfile() === null);
  readonly canEditProfessionalProfile = computed(() => this.canManageProfessionalProfile() && this.professionalProfile() !== null);
  readonly showProfessionalProfileForm = computed(() => this.professionalProfileFormMode() !== null);
  readonly canManageSkills = computed(() => {
    const person = this.person();
    const currentUser = this.auth.currentUser();

    if (!person || person.archived_at) {
      return false;
    }

    return hasStaffRole(currentUser, 'CRM_ADMIN') || hasStaffRole(currentUser, 'CRM_MANAGER');
  });
  readonly canManageInterests = computed(() => {
    const person = this.person();
    const currentUser = this.auth.currentUser();

    if (!person || person.archived_at) {
      return false;
    }

    return hasStaffRole(currentUser, 'CRM_ADMIN') || hasStaffRole(currentUser, 'CRM_MANAGER');
  });
  readonly canManageTags = computed(() => {
    const person = this.person();
    const currentUser = this.auth.currentUser();

    if (!person || person.archived_at) {
      return false;
    }

    return hasStaffRole(currentUser, 'CRM_ADMIN') || hasStaffRole(currentUser, 'CRM_MANAGER');
  });
  readonly canAccessInternalNotes = computed(() => {
    const currentUser = this.auth.currentUser();

    return hasStaffRole(currentUser, 'CRM_ADMIN') || hasStaffRole(currentUser, 'CRM_MANAGER');
  });
  readonly canMutateInternalNotes = computed(() => {
    const person = this.person();

    return Boolean(person && !person.archived_at && this.canAccessInternalNotes());
  });
  readonly canAccessAuditHistory = computed(() => hasStaffCrmAccess(this.auth.currentUser()));
  readonly canAccessPrivacyAudit = computed(() => this.auth.hasPrivacyAuditRead());
  readonly availableSkills = computed<SkillSummary[]>(() => {
    const assignedSkillIds = new Set(this.skills().map((skill) => skill.id));
    return this.skillsCatalog().filter((skill) => !assignedSkillIds.has(skill.id));
  });
  readonly availableInterests = computed<InterestSummary[]>(() => {
    const assignedInterestIds = new Set(this.interests().map((interest) => interest.id));
    return this.interestsCatalog().filter((interest) => !assignedInterestIds.has(interest.id));
  });
  readonly availableTags = computed<TagSummary[]>(() => {
    const assignedTagIds = new Set(this.tags().map((tag) => tag.id));
    return this.tagsCatalog().filter((tag) => !assignedTagIds.has(tag.id));
  });
  readonly pendingSkillRemoval = computed<SkillSummary | null>(() => {
    const skillId = this.confirmingSkillRemovalId();
    if (skillId === null) {
      return null;
    }

    return this.skills().find((skill) => skill.id === skillId) ?? null;
  });
  readonly pendingInterestRemoval = computed<InterestSummary | null>(() => {
    const interestId = this.confirmingInterestRemovalId();
    if (interestId === null) {
      return null;
    }

    return this.interests().find((interest) => interest.id === interestId) ?? null;
  });
  readonly pendingTagRemoval = computed<TagSummary | null>(() => {
    const tagId = this.confirmingTagRemovalId();
    if (tagId === null) {
      return null;
    }

    return this.tags().find((tag) => tag.id === tagId) ?? null;
  });
  readonly professionalProfileLinkedInUrl = computed(() => {
    const value = this.professionalProfile()?.linkedin_url ?? '';
    return value.trim() ? value : null;
  });

  readonly makeMemberForm = this.fb.nonNullable.group({
    joined_at: [getLocalTodayDateInputValue(), Validators.required],
  });
  readonly endMembershipForm = this.fb.nonNullable.group({
    ended_at: [getLocalTodayDateInputValue(), Validators.required],
  });
  readonly professionalProfileForm = this.fb.nonNullable.group({
    job_title: [''],
    company: [''],
    industry: [''],
    career_stage: [''],
    linkedin_url: [''],
  });
  readonly assignSkillForm = this.fb.nonNullable.group({
    skill: ['', Validators.required],
  });
  readonly assignInterestForm = this.fb.nonNullable.group({
    interest: ['', Validators.required],
  });
  readonly assignTagForm = this.fb.nonNullable.group({
    tag: ['', Validators.required],
  });
  readonly classificationCorrectionForm = this.fb.nonNullable.group({
    record_type: ['COMMUNITY' as PersonRecordType, Validators.required],
    reason: ['', [Validators.required, Validators.maxLength(500)]],
    confirmed: [false, Validators.requiredTrue],
  });

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
      { label: 'Age range', value: ageRangeLabel(person.age_range) },
      { label: 'Gender', value: genderLabel(person.gender) },
    ];
  });

  readonly classificationDetails = computed<DetailListItem[]>(() => [{
    label: 'Person classification',
    value: this.classificationLabel(this.person()?.record_type),
  }]);

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

  readonly professionalProfileDetails = computed<DetailListItem[]>(() => {
    const profile = this.professionalProfile();
    if (!profile) {
      return [];
    }

    return [
      { label: 'Job title', value: profile.job_title },
      { label: 'Company', value: profile.company },
      { label: 'Industry', value: profile.industry?.name ?? null },
      { label: 'Career stage', value: getCareerStageLabel(profile.career_stage) },
    ];
  });

  readonly membershipDetails = computed<DetailListItem[]>(() => {
    const membership = this.membership();
    if (!membership) {
      return [];
    }

    const items: DetailListItem[] = [
      { label: 'Status', value: membership.status === 'ACTIVE' ? 'Active' : 'Former' },
      { label: 'Joined', value: formatBusinessDate(membership.joined_at) },
    ];

    if (membership.ended_at) {
      items.push({ label: 'Ended', value: formatBusinessDate(membership.ended_at) });
    }

    items.push({ label: 'Source', value: membershipSourceLabel(membership.membership_source) });

    return items;
  });

  constructor() {
    effect(() => {
      const staffAccess = this.staffAccess;
      if (!staffAccess?.isReady()) return;
      const contactLost = !staffAccess.hasCapability('PERSON_CONTACT_READ');
      const demographicLost = !staffAccess.hasCapability('PERSON_DEMOGRAPHIC_READ');
      if (!contactLost && !demographicLost) return;
      const overview = this.overview();
      if (overview) {
        const redacted = redactOverviewAfterAccessLoss(overview, contactLost, demographicLost);
        if (redacted !== overview) untracked(() => this.overview.set(redacted));
      }
    });
    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(fragment => this.activeTab.set(fragment || 'overview'));
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.returnCampaignId.set(parseCampaignReturnId(params.get('campaign')));
    });
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

        this.loadOverview(personId);
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

  openCreateProfessionalProfileForm(): void {
    if (!this.canAddProfessionalProfile()) {
      return;
    }

    this.professionalProfileFormMode.set('create');
    this.professionalProfileErrorMessage.set(null);
    this.professionalProfileForm.reset(getProfessionalProfileFormValue(null));
    this.ensureIndustriesLoaded();
  }

  openEditProfessionalProfileForm(): void {
    const profile = this.professionalProfile();
    if (!profile || !this.canEditProfessionalProfile()) {
      return;
    }

    this.professionalProfileFormMode.set('edit');
    this.professionalProfileErrorMessage.set(null);
    this.professionalProfileForm.reset(getProfessionalProfileFormValue(profile));
    this.ensureIndustriesLoaded();
  }

  cancelProfessionalProfileForm(): void {
    this.professionalProfileFormMode.set(null);
    this.professionalProfileSubmitting.set(false);
    this.professionalProfileErrorMessage.set(null);
    this.professionalProfileForm.reset(getProfessionalProfileFormValue(this.professionalProfile()));
  }

  openAddSkillForm(): void {
    if (!this.canManageSkills()) {
      return;
    }

    this.showAddSkillForm.set(true);
    this.skillWriteErrorMessage.set(null);
    this.confirmingSkillRemovalId.set(null);
    this.assignSkillForm.reset({ skill: '' });
    this.ensureSkillsCatalogLoaded();
  }

  cancelAddSkillForm(): void {
    this.showAddSkillForm.set(false);
    this.assigningSkill.set(false);
    this.skillWriteErrorMessage.set(null);
    this.assignSkillForm.reset({ skill: '' });
  }

  openSkillRemovalConfirmation(skillId: number): void {
    if (!this.canManageSkills()) {
      return;
    }

    this.showAddSkillForm.set(false);
    this.assigningSkill.set(false);
    this.skillWriteErrorMessage.set(null);
    this.assignSkillForm.reset({ skill: '' });
    this.confirmingSkillRemovalId.set(skillId);
  }

  cancelSkillRemoval(): void {
    this.confirmingSkillRemovalId.set(null);
    this.removingSkillId.set(null);
    this.skillWriteErrorMessage.set(null);
  }

  openAddInterestForm(): void {
    if (!this.canManageInterests()) {
      return;
    }

    this.showAddInterestForm.set(true);
    this.interestWriteErrorMessage.set(null);
    this.confirmingInterestRemovalId.set(null);
    this.assignInterestForm.reset({ interest: '' });
    this.ensureInterestsCatalogLoaded();
  }

  cancelAddInterestForm(): void {
    this.showAddInterestForm.set(false);
    this.assigningInterest.set(false);
    this.interestWriteErrorMessage.set(null);
    this.assignInterestForm.reset({ interest: '' });
  }

  openInterestRemovalConfirmation(interestId: number): void {
    if (!this.canManageInterests()) {
      return;
    }

    this.showAddInterestForm.set(false);
    this.assigningInterest.set(false);
    this.interestWriteErrorMessage.set(null);
    this.assignInterestForm.reset({ interest: '' });
    this.confirmingInterestRemovalId.set(interestId);
  }

  cancelInterestRemoval(): void {
    this.confirmingInterestRemovalId.set(null);
    this.removingInterestId.set(null);
    this.interestWriteErrorMessage.set(null);
  }

  openAddTagForm(): void {
    if (!this.canManageTags()) {
      return;
    }

    this.showAddTagForm.set(true);
    this.tagWriteErrorMessage.set(null);
    this.confirmingTagRemovalId.set(null);
    this.assignTagForm.reset({ tag: '' });
    this.ensureTagsCatalogLoaded();
  }

  cancelAddTagForm(): void {
    this.showAddTagForm.set(false);
    this.assigningTag.set(false);
    this.tagWriteErrorMessage.set(null);
    this.assignTagForm.reset({ tag: '' });
  }

  openTagRemovalConfirmation(tagId: number): void {
    if (!this.canManageTags()) {
      return;
    }

    this.showAddTagForm.set(false);
    this.assigningTag.set(false);
    this.tagWriteErrorMessage.set(null);
    this.assignTagForm.reset({ tag: '' });
    this.confirmingTagRemovalId.set(tagId);
  }

  cancelTagRemoval(): void {
    this.confirmingTagRemovalId.set(null);
    this.removingTagId.set(null);
    this.tagWriteErrorMessage.set(null);
  }

  openMakeMemberForm(): void {
    this.showMakeMemberForm.set(true);
    this.makeMemberErrorMessage.set(null);
    this.showEndMembershipForm.set(false);
    this.endMembershipErrorMessage.set(null);
    this.makeMemberForm.reset({
      joined_at: getLocalTodayDateInputValue(),
    });
  }

  cancelMakeMember(): void {
    this.showMakeMemberForm.set(false);
    this.makeMemberErrorMessage.set(null);
    this.makeMemberSubmitting.set(false);
    this.makeMemberForm.reset({
      joined_at: getLocalTodayDateInputValue(),
    });
  }

  openEndMembershipForm(): void {
    this.showEndMembershipForm.set(true);
    this.endMembershipErrorMessage.set(null);
    this.showMakeMemberForm.set(false);
    this.makeMemberErrorMessage.set(null);
    this.endMembershipForm.reset({
      ended_at: getLocalTodayDateInputValue(),
    });
  }

  cancelEndMembership(): void {
    this.showEndMembershipForm.set(false);
    this.endMembershipErrorMessage.set(null);
    this.endMembershipSubmitting.set(false);
    this.endMembershipForm.reset({
      ended_at: getLocalTodayDateInputValue(),
    });
  }

  openClassificationCorrection(): void {
    const current = this.person()?.record_type ?? 'COMMUNITY';
    this.classificationCorrectionForm.reset({ record_type: current, reason: '', confirmed: false });
    this.classificationCorrectionErrorMessage.set(null);
    this.showClassificationCorrection.set(true);
  }

  cancelClassificationCorrection(): void {
    this.showClassificationCorrection.set(false);
    this.classificationCorrectionSubmitting.set(false);
    this.classificationCorrectionErrorMessage.set(null);
    this.classificationCorrectionForm.reset({ record_type: this.person()?.record_type ?? 'COMMUNITY', reason: '', confirmed: false });
  }

  submitClassificationCorrection(): void {
    const person = this.person();
    if (!person || !this.canCorrectClassification() || this.classificationCorrectionSubmitting()) { return; }
    this.classificationCorrectionForm.markAllAsTouched();
    if (this.classificationCorrectionForm.invalid) { return; }
    this.classificationCorrectionSubmitting.set(true);
    this.classificationCorrectionErrorMessage.set(null);
    const payload = {
      record_type: this.classificationCorrectionForm.controls.record_type.value,
      reason: this.classificationCorrectionForm.controls.reason.value.trim(),
    };
    this.peopleService.correctClassification(person.id, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updatedPerson) => {
        this.overview.update(overview => overview ? { ...overview, person: updatedPerson } : overview);
        this.classificationCorrectionSubmitting.set(false);
        this.showClassificationCorrection.set(false);
      },
      error: (error: HttpErrorResponse) => this.handleClassificationCorrectionError(error),
    });
  }

  private handleClassificationCorrectionError(error: HttpErrorResponse): void {
    this.classificationCorrectionSubmitting.set(false);
    if (error.status === 401) {
      this.auth.handleSessionExpired();
      this.classificationCorrectionErrorMessage.set('Your staff session expired. Sign in again to continue.');
      return;
    }
    if (error.status === 403) {
      this.classificationCorrectionErrorMessage.set(formatForbiddenError(error, 'Only CRM administrators can correct classifications.'));
      return;
    }
    if (error.status === 409) {
      this.classificationCorrectionErrorMessage.set(error.error?.detail ?? 'This classification conflicts with the current identity state. Refresh and review the record.');
      return;
    }
    if (error.status === 400) {
      const fields = error.error?.record_type || error.error?.reason;
      this.classificationCorrectionErrorMessage.set(typeof fields === 'string' ? fields : 'The correction was rejected by the backend. Review the target and reason.');
      return;
    }
    this.classificationCorrectionErrorMessage.set('The classification correction could not be completed right now. Try again.');
  }

  classificationLabel(value: string | undefined): string {
    return this.classificationOptions.find(option => option.value === value)?.label ?? 'Unknown';
  }

  archivePerson(): void {
    const person = this.person();
    if (!person || person.archived_at || !this.canManagePeople() || this.personLifecycleSubmitting()) { return; }
    this.personLifecycleSubmitting.set(true);
    this.personLifecycleErrorMessage.set(null);
    this.peopleService.archivePerson(person.id).pipe(switchMap(() => this.peopleService.getPersonOverview(person.id)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (overview) => { this.overview.set(overview); this.personLifecycleSubmitting.set(false); },
      error: (error: HttpErrorResponse) => { this.handlePersonLifecycleError(error, person.id); },
    });
  }

  restorePerson(): void {
    const person = this.person();
    if (!person || !person.archived_at || !this.canManagePeople() || this.personLifecycleSubmitting()) { return; }
    this.personLifecycleSubmitting.set(true);
    this.personLifecycleErrorMessage.set(null);
    this.peopleService.restorePerson(person.id).pipe(switchMap(() => this.peopleService.getPersonOverview(person.id)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (overview) => { this.overview.set(overview); this.personLifecycleSubmitting.set(false); },
      error: (error: HttpErrorResponse) => { this.handlePersonLifecycleError(error, person.id); },
    });
  }

  private handlePersonLifecycleError(error: HttpErrorResponse, personId: number): void {
    this.personLifecycleSubmitting.set(false);
    if (error.status === 404) { void this.router.navigate(['/people']); return; }
    if (error.status === 409) {
      this.personLifecycleErrorMessage.set('This Person lifecycle state changed. The record has been refreshed.');
      this.loadOverview(personId);
      return;
    }
    this.personLifecycleErrorMessage.set(error.status === 403
      ? formatForbiddenError(error, 'You no longer have permission to manage this Person.')
      : 'The Person lifecycle change could not be completed right now. Try again.');
  }

  showEndMembershipRequiredError(): boolean {
    return this.endMembershipForm.controls.ended_at.hasError('required') && this.endMembershipForm.touched;
  }

  showEndMembershipBeforeJoinedError(): boolean {
    if (!this.endMembershipForm.touched) {
      return false;
    }

    const membership = this.membership();
    const endedAt = this.endMembershipForm.controls.ended_at.value;
    return Boolean(membership && endedAt && endedAt < membership.joined_at);
  }

  showAssignSkillRequiredError(): boolean {
    return this.assignSkillForm.controls.skill.hasError('required') && this.assignSkillForm.touched;
  }

  showAssignInterestRequiredError(): boolean {
    return this.assignInterestForm.controls.interest.hasError('required') && this.assignInterestForm.touched;
  }

  showAssignTagRequiredError(): boolean {
    return this.assignTagForm.controls.tag.hasError('required') && this.assignTagForm.touched;
  }

  submitAssignSkill(): void {
    const person = this.person();
    if (
      !person ||
      !this.canManageSkills() ||
      !this.showAddSkillForm() ||
      this.assigningSkill() ||
      this.skillsCatalogLoading() ||
      this.skillsCatalogErrorMessage()
    ) {
      return;
    }

    if (this.assignSkillForm.invalid) {
      this.assignSkillForm.markAllAsTouched();
      return;
    }

    const skillId = Number(this.assignSkillForm.getRawValue().skill);
    if (!Number.isInteger(skillId) || skillId <= 0) {
      this.assignSkillForm.markAllAsTouched();
      return;
    }

    this.assigningSkill.set(true);
    this.skillWriteErrorMessage.set(null);

    let writeSucceeded = false;
    this.peopleService
      .assignSkill(person.id, skillId)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.peopleService.getPersonOverview(person.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.showAddSkillForm.set(false);
          this.assignSkillForm.reset({ skill: '' });
        },
        error: (error: HttpErrorResponse) => {
          this.skillWriteErrorMessage.set(formatAssignSkillError(error, writeSucceeded));
          this.assigningSkill.set(false);
        },
        complete: () => {
          this.assigningSkill.set(false);
        },
      });
  }

  confirmSkillRemoval(): void {
    const person = this.person();
    const skill = this.pendingSkillRemoval();

    if (!person || !skill || !this.canManageSkills() || this.removingSkillId() === skill.id) {
      return;
    }

    this.removingSkillId.set(skill.id);
    this.skillWriteErrorMessage.set(null);

    let writeSucceeded = false;
    this.peopleService
      .removeSkill(person.id, skill.id)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.peopleService.getPersonOverview(person.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.confirmingSkillRemovalId.set(null);
        },
        error: (error: HttpErrorResponse) => {
          this.skillWriteErrorMessage.set(formatRemoveSkillError(error, writeSucceeded));
          this.removingSkillId.set(null);
        },
        complete: () => {
          this.removingSkillId.set(null);
        },
      });
  }

  submitAssignInterest(): void {
    const person = this.person();
    if (
      !person ||
      !this.canManageInterests() ||
      !this.showAddInterestForm() ||
      this.assigningInterest() ||
      this.interestsCatalogLoading() ||
      this.interestsCatalogErrorMessage()
    ) {
      return;
    }

    if (this.assignInterestForm.invalid) {
      this.assignInterestForm.markAllAsTouched();
      return;
    }

    const interestId = Number(this.assignInterestForm.getRawValue().interest);
    if (!Number.isInteger(interestId) || interestId <= 0) {
      this.assignInterestForm.markAllAsTouched();
      return;
    }

    this.assigningInterest.set(true);
    this.interestWriteErrorMessage.set(null);

    let writeSucceeded = false;
    this.peopleService
      .assignInterest(person.id, interestId)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.peopleService.getPersonOverview(person.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.showAddInterestForm.set(false);
          this.assignInterestForm.reset({ interest: '' });
        },
        error: (error: HttpErrorResponse) => {
          this.interestWriteErrorMessage.set(formatAssignInterestError(error, writeSucceeded));
          this.assigningInterest.set(false);
        },
        complete: () => {
          this.assigningInterest.set(false);
        },
      });
  }

  confirmInterestRemoval(): void {
    const person = this.person();
    const interest = this.pendingInterestRemoval();

    if (!person || !interest || !this.canManageInterests() || this.removingInterestId() === interest.id) {
      return;
    }

    this.removingInterestId.set(interest.id);
    this.interestWriteErrorMessage.set(null);

    let writeSucceeded = false;
    this.peopleService
      .removeInterest(person.id, interest.id)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.peopleService.getPersonOverview(person.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.confirmingInterestRemovalId.set(null);
        },
        error: (error: HttpErrorResponse) => {
          this.interestWriteErrorMessage.set(formatRemoveInterestError(error, writeSucceeded));
          this.removingInterestId.set(null);
        },
        complete: () => {
          this.removingInterestId.set(null);
        },
      });
  }

  submitAssignTag(): void {
    const person = this.person();
    if (
      !person ||
      !this.canManageTags() ||
      !this.showAddTagForm() ||
      this.assigningTag() ||
      this.tagsCatalogLoading() ||
      this.tagsCatalogErrorMessage()
    ) {
      return;
    }

    if (this.assignTagForm.invalid) {
      this.assignTagForm.markAllAsTouched();
      return;
    }

    const tagId = Number(this.assignTagForm.getRawValue().tag);
    if (!Number.isInteger(tagId) || tagId <= 0) {
      this.assignTagForm.markAllAsTouched();
      return;
    }

    this.assigningTag.set(true);
    this.tagWriteErrorMessage.set(null);

    let writeSucceeded = false;
    this.peopleService
      .assignTag(person.id, tagId)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.peopleService.getPersonOverview(person.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.showAddTagForm.set(false);
          this.assignTagForm.reset({ tag: '' });
        },
        error: (error: HttpErrorResponse) => {
          this.tagWriteErrorMessage.set(formatAssignTagError(error, writeSucceeded));
          this.assigningTag.set(false);
        },
        complete: () => {
          this.assigningTag.set(false);
        },
      });
  }

  confirmTagRemoval(): void {
    const person = this.person();
    const tag = this.pendingTagRemoval();

    if (!person || !tag || !this.canManageTags() || this.removingTagId() === tag.id) {
      return;
    }

    this.removingTagId.set(tag.id);
    this.tagWriteErrorMessage.set(null);

    let writeSucceeded = false;
    this.peopleService
      .removeTag(person.id, tag.id)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.peopleService.getPersonOverview(person.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.confirmingTagRemovalId.set(null);
        },
        error: (error: HttpErrorResponse) => {
          this.tagWriteErrorMessage.set(formatRemoveTagError(error, writeSucceeded));
          this.removingTagId.set(null);
        },
        complete: () => {
          this.removingTagId.set(null);
        },
      });
  }

  submitProfessionalProfile(): void {
    const person = this.person();
    const profile = this.professionalProfile();

    if (
      !person ||
      !this.canManageProfessionalProfile() ||
      !this.showProfessionalProfileForm() ||
      this.professionalProfileSubmitting() ||
      this.industriesLoading() ||
      this.industriesLoadErrorMessage()
    ) {
      return;
    }

    this.professionalProfileSubmitting.set(true);
    this.professionalProfileErrorMessage.set(null);

    const payload = buildProfessionalProfileWriteRequest(this.professionalProfileForm.getRawValue());
    const request$ = profile
      ? this.peopleService.updateProfessionalProfile(person.id, payload)
      : this.peopleService.createProfessionalProfile(person.id, payload);

    request$
      .pipe(switchMap(() => this.peopleService.getPersonOverview(person.id)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.professionalProfileFormMode.set(null);
        },
        error: (error: HttpErrorResponse) => {
          this.professionalProfileErrorMessage.set(formatProfessionalProfileError(error));
          this.professionalProfileSubmitting.set(false);
        },
        complete: () => {
          this.professionalProfileSubmitting.set(false);
        },
      });
  }

  submitMakeMember(): void {
    const person = this.person();
    if (!person || !this.canMakeMember() || this.makeMemberSubmitting()) {
      return;
    }

    if (this.makeMemberForm.invalid) {
      this.makeMemberForm.markAllAsTouched();
      return;
    }

    this.makeMemberSubmitting.set(true);
    this.makeMemberErrorMessage.set(null);

    const payload: MakeMembershipRequest = {
      joined_at: this.makeMemberForm.getRawValue().joined_at,
      membership_source: 'STAFF',
    };

    this.peopleService
      .makeMember(person.id, payload)
      .pipe(switchMap(() => this.peopleService.getPersonOverview(person.id)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.showMakeMemberForm.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.makeMemberErrorMessage.set(formatMakeMemberError(error));
          this.makeMemberSubmitting.set(false);
        },
        complete: () => {
          this.makeMemberSubmitting.set(false);
        },
      });
  }

  submitEndMembership(): void {
    const person = this.person();
    const membership = this.membership();

    if (!person || !membership || !this.canEndMembership() || this.endMembershipSubmitting()) {
      return;
    }

    if (this.endMembershipForm.invalid) {
      this.endMembershipForm.markAllAsTouched();
      return;
    }

    const payload: EndMembershipRequest = {
      ended_at: this.endMembershipForm.getRawValue().ended_at,
    };

    if (payload.ended_at < membership.joined_at) {
      this.endMembershipForm.markAllAsTouched();
      this.endMembershipErrorMessage.set(null);
      return;
    }

    this.endMembershipSubmitting.set(true);
    this.endMembershipErrorMessage.set(null);

    this.peopleService
      .endMembership(person.id, payload)
      .pipe(switchMap(() => this.peopleService.getPersonOverview(person.id)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.showEndMembershipForm.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.endMembershipErrorMessage.set(formatEndMembershipError(error));
          this.endMembershipSubmitting.set(false);
        },
        complete: () => {
          this.endMembershipSubmitting.set(false);
        },
      });
  }

  private ensureIndustriesLoaded(): void {
    if (this.industriesLoaded() || this.industriesLoading()) {
      return;
    }

    this.industriesLoading.set(true);
    this.industriesLoadErrorMessage.set(null);

    this.peopleService
      .getIndustries()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (industries) => {
          this.industries.set(industries);
          this.industriesLoaded.set(true);
        },
        error: () => {
          this.industriesLoading.set(false);
          this.industriesLoadErrorMessage.set('Industry options could not be loaded right now. Try again.');
        },
        complete: () => {
          this.industriesLoading.set(false);
        },
      });
  }

  private ensureSkillsCatalogLoaded(): void {
    if (this.skillsCatalogLoaded() || this.skillsCatalogLoading()) {
      return;
    }

    this.skillsCatalogLoading.set(true);
    this.skillsCatalogErrorMessage.set(null);

    this.peopleService
      .getSkills()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (skills) => {
          this.skillsCatalog.set(skills);
          this.skillsCatalogLoaded.set(true);
        },
        error: () => {
          this.skillsCatalogLoading.set(false);
          this.skillsCatalogErrorMessage.set('Skill options could not be loaded right now. Try again.');
        },
        complete: () => {
          this.skillsCatalogLoading.set(false);
        },
      });
  }

  private ensureInterestsCatalogLoaded(): void {
    if (this.interestsCatalogLoaded() || this.interestsCatalogLoading()) {
      return;
    }

    this.interestsCatalogLoading.set(true);
    this.interestsCatalogErrorMessage.set(null);

    this.peopleService
      .getInterests()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (interests) => {
          this.interestsCatalog.set(interests);
          this.interestsCatalogLoaded.set(true);
        },
        error: () => {
          this.interestsCatalogLoading.set(false);
          this.interestsCatalogErrorMessage.set('Interest options could not be loaded right now. Try again.');
        },
        complete: () => {
          this.interestsCatalogLoading.set(false);
        },
      });
  }

  private ensureTagsCatalogLoaded(): void {
    if (this.tagsCatalogLoaded() || this.tagsCatalogLoading()) {
      return;
    }

    this.tagsCatalogLoading.set(true);
    this.tagsCatalogErrorMessage.set(null);

    this.peopleService
      .getTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => {
          this.tagsCatalog.set(tags);
          this.tagsCatalogLoaded.set(true);
        },
        error: () => {
          this.tagsCatalogLoading.set(false);
          this.tagsCatalogErrorMessage.set('Tag options could not be loaded right now. Try again.');
        },
        complete: () => {
          this.tagsCatalogLoading.set(false);
        },
      });
  }

  private loadOverview(personId: number): void {
    this.editPersonOpen.set(false);
    this.loading.set(true);
    this.notFound.set(false);
    this.errorMessage.set(null);
    this.overview.set(null);
    this.professionalProfileFormMode.set(null);
    this.professionalProfileSubmitting.set(false);
    this.professionalProfileErrorMessage.set(null);
    this.professionalProfileForm.reset(getProfessionalProfileFormValue(null));
    this.showAddSkillForm.set(false);
    this.assigningSkill.set(false);
    this.skillWriteErrorMessage.set(null);
    this.confirmingSkillRemovalId.set(null);
    this.removingSkillId.set(null);
    this.assignSkillForm.reset({ skill: '' });
    this.showAddInterestForm.set(false);
    this.assigningInterest.set(false);
    this.interestWriteErrorMessage.set(null);
    this.confirmingInterestRemovalId.set(null);
    this.removingInterestId.set(null);
    this.assignInterestForm.reset({ interest: '' });
    this.showAddTagForm.set(false);
    this.assigningTag.set(false);
    this.tagWriteErrorMessage.set(null);
    this.confirmingTagRemovalId.set(null);
    this.removingTagId.set(null);
    this.assignTagForm.reset({ tag: '' });
    this.showMakeMemberForm.set(false);
    this.makeMemberSubmitting.set(false);
    this.makeMemberErrorMessage.set(null);
    this.showEndMembershipForm.set(false);
    this.endMembershipSubmitting.set(false);
    this.endMembershipErrorMessage.set(null);

    this.peopleService
      .getPersonOverview(personId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.overview.set(overview);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.overview.set(null);
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
    this.overview.set(null);
    this.errorMessage.set(null);
    this.notFound.set(true);
  }
}
function parseCampaignReturnId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/u.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

const CAREER_STAGE_OPTIONS: ReadonlyArray<{ value: ProfessionalProfileCareerStage; label: string }> = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'EARLY_CAREER', label: 'Early Career' },
  { value: 'MID_CAREER', label: 'Mid Career' },
  { value: 'SENIOR', label: 'Senior' },
  { value: 'LEADERSHIP', label: 'Leadership' },
  { value: 'FOUNDER_BUSINESS_OWNER', label: 'Founder / Business Owner' },
  { value: 'OTHER', label: 'Other' },
];

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

function formatBusinessDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getCareerStageLabel(value: ProfessionalProfile['career_stage']): string | null {
  if (!value) {
    return null;
  }

  return (
    CAREER_STAGE_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

function getProfessionalProfileFormValue(profile: ProfessionalProfile | null): ProfessionalProfileFormValue {
  return {
    job_title: profile?.job_title ?? '',
    company: profile?.company ?? '',
    industry: profile?.industry ? String(profile.industry.id) : '',
    career_stage: profile?.career_stage ?? '',
    linkedin_url: profile?.linkedin_url ?? '',
  };
}

function buildProfessionalProfileWriteRequest(
  value: ProfessionalProfileFormValue,
): ProfessionalProfileWriteRequest {
  return {
    job_title: value.job_title,
    company: value.company,
    industry: value.industry ? Number(value.industry) : null,
    career_stage: value.career_stage ? (value.career_stage as ProfessionalProfileCareerStage) : '',
    linkedin_url: value.linkedin_url,
  };
}

function getLocalTodayDateInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMakeMemberError(error: HttpErrorResponse): string {
  if (error.status === 400 && error.error && typeof error.error === 'object' && !Array.isArray(error.error)) {
    const entries = Object.entries(error.error as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([field, value]) => `${getMakeMemberFieldLabel(field)}: ${String((value as unknown[])[0])}`);

    if (entries.length > 0) {
      return entries.join(' ');
    }

    return 'Membership details need to be corrected before this person can be made a member.';
  }

  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to make this person a member.');
  }

  if (error.status === 409) {
    return 'This membership could not be created because the person is no longer eligible for Make Member.';
  }

  return 'Membership could not be created right now. Try again.';
}

function formatEndMembershipError(error: HttpErrorResponse): string {
  if (error.status === 400 && error.error && typeof error.error === 'object' && !Array.isArray(error.error)) {
    const entries = Object.entries(error.error as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([field, value]) => `${getEndMembershipFieldLabel(field)}: ${String((value as unknown[])[0])}`);

    if (entries.length > 0) {
      return entries.join(' ');
    }

    return 'Membership end details need to be corrected before this change can be saved.';
  }

  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to end this membership.');
  }

  if (error.status === 409) {
    return 'This membership can no longer be ended from the current person state.';
  }

  return 'Membership could not be ended right now. Try again.';
}

function formatProfessionalProfileError(error: HttpErrorResponse): string {
  if (error.status === 400 && error.error && typeof error.error === 'object' && !Array.isArray(error.error)) {
    const entries = Object.entries(error.error as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([field, value]) => `${getProfessionalProfileFieldLabel(field)}: ${String((value as unknown[])[0])}`);

    if (entries.length > 0) {
      return entries.join(' ');
    }

    return 'Professional Profile details need to be corrected before this change can be saved.';
  }

  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to change this professional profile.');
  }

  if (error.status === 404) {
    return 'This person record is no longer available in the CRM People domain.';
  }

  if (error.status === 409) {
    return 'This professional profile could not be saved because the person state changed or a profile already exists.';
  }

  return 'Professional Profile could not be saved right now. Try again.';
}

function formatAssignSkillError(error: HttpErrorResponse, refreshFailedAfterSuccess: boolean): string {
  if (refreshFailedAfterSuccess) {
    return 'The skill change was saved, but the refreshed overview could not be loaded right now.';
  }

  if (error.status === 400 && error.error && typeof error.error === 'object' && !Array.isArray(error.error)) {
    const entries = Object.entries(error.error as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([field, value]) => `${getAssignSkillFieldLabel(field)}: ${String((value as unknown[])[0])}`);

    if (entries.length > 0) {
      return entries.join(' ');
    }

    return 'Skill details need to be corrected before this change can be saved.';
  }

  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to assign skills.');
  }

  if (error.status === 404) {
    return 'This person record is no longer available in the CRM People domain.';
  }

  if (error.status === 409) {
    return 'This skill is already assigned.';
  }

  return 'Skill could not be assigned right now. Try again.';
}

function formatRemoveSkillError(error: HttpErrorResponse, refreshFailedAfterSuccess: boolean): string {
  if (refreshFailedAfterSuccess) {
    return 'The skill change was saved, but the refreshed overview could not be loaded right now.';
  }

  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to remove skills.');
  }

  if (error.status === 404) {
    return 'This skill assignment is no longer available.';
  }

  if (error.status === 409) {
    return 'This person can no longer receive skill changes.';
  }

  return 'Skill could not be removed right now. Try again.';
}

function formatAssignInterestError(error: HttpErrorResponse, refreshFailedAfterSuccess: boolean): string {
  if (refreshFailedAfterSuccess) {
    return 'The interest change was saved, but the refreshed overview could not be loaded right now.';
  }

  if (error.status === 400 && error.error && typeof error.error === 'object' && !Array.isArray(error.error)) {
    const entries = Object.entries(error.error as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([field, value]) => `${getAssignInterestFieldLabel(field)}: ${String((value as unknown[])[0])}`);

    if (entries.length > 0) {
      return entries.join(' ');
    }

    return 'Interest details need to be corrected before this change can be saved.';
  }

  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to assign interests.');
  }

  if (error.status === 404) {
    return 'This person record is no longer available in the CRM People domain.';
  }

  if (error.status === 409) {
    return 'This interest is already assigned.';
  }

  return 'Interest could not be assigned right now. Try again.';
}

function formatRemoveInterestError(error: HttpErrorResponse, refreshFailedAfterSuccess: boolean): string {
  if (refreshFailedAfterSuccess) {
    return 'The interest change was saved, but the refreshed overview could not be loaded right now.';
  }

  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to remove interests.');
  }

  if (error.status === 404) {
    return 'This interest assignment is no longer available.';
  }

  if (error.status === 409) {
    return 'This person can no longer receive interest changes.';
  }

  return 'Interest could not be removed right now. Try again.';
}

function formatAssignTagError(error: HttpErrorResponse, refreshFailedAfterSuccess: boolean): string {
  if (refreshFailedAfterSuccess) {
    return 'The tag change was saved, but the refreshed overview could not be loaded right now.';
  }

  if (error.status === 400 && error.error && typeof error.error === 'object' && !Array.isArray(error.error)) {
    const entries = Object.entries(error.error as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([field, value]) => `${getAssignTagFieldLabel(field)}: ${String((value as unknown[])[0])}`);

    if (entries.length > 0) {
      return entries.join(' ');
    }

    return 'Tag details need to be corrected before this change can be saved.';
  }

  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to assign tags.');
  }

  if (error.status === 404) {
    return 'This person record is no longer available in the CRM People domain.';
  }

  if (error.status === 409) {
    return 'This tag is already assigned.';
  }

  return 'Tag could not be assigned right now. Try again.';
}

function formatRemoveTagError(error: HttpErrorResponse, refreshFailedAfterSuccess: boolean): string {
  if (refreshFailedAfterSuccess) {
    return 'The tag change was saved, but the refreshed overview could not be loaded right now.';
  }

  if (error.status === 403) {
    return formatForbiddenError(error, 'You no longer have permission to remove tags.');
  }

  if (error.status === 404) {
    return 'This tag assignment is no longer available.';
  }

  if (error.status === 409) {
    return 'This person can no longer receive tag changes.';
  }

  return 'Tag could not be removed right now. Try again.';
}

function getMakeMemberFieldLabel(field: string): string {
  switch (field) {
    case 'joined_at':
      return 'Join date';
    case 'membership_source':
      return 'Membership source';
    default:
      return 'Membership';
  }
}

function getEndMembershipFieldLabel(field: string): string {
  switch (field) {
    case 'ended_at':
      return 'End date';
    default:
      return 'Membership';
  }
}

function getProfessionalProfileFieldLabel(field: string): string {
  switch (field) {
    case 'job_title':
      return 'Job title';
    case 'company':
      return 'Company';
    case 'industry':
      return 'Industry';
    case 'career_stage':
      return 'Career stage';
    case 'linkedin_url':
      return 'LinkedIn URL';
    default:
      return 'Professional Profile';
  }
}

function getAssignSkillFieldLabel(field: string): string {
  switch (field) {
    case 'skill':
      return 'Skill';
    default:
      return 'Skill';
  }
}

function getAssignInterestFieldLabel(field: string): string {
  switch (field) {
    case 'interest':
      return 'Interest';
    default:
      return 'Interest';
  }
}

function getAssignTagFieldLabel(field: string): string {
  switch (field) {
    case 'tag':
      return 'Tag';
    default:
      return 'Tag';
  }
}
