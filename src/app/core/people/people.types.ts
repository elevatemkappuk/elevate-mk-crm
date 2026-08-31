export type PersonRecordState = 'active' | 'archived' | 'all';
export type NoteRecordState = 'active' | 'archived' | 'all';

export type PeopleOrdering =
  | 'name'
  | '-name'
  | 'first_name'
  | '-first_name'
  | 'last_name'
  | '-last_name'
  | 'created_at'
  | '-created_at'
  | 'updated_at'
  | '-updated_at'
  | 'membership_joined_at'
  | '-membership_joined_at';

export type PeoplePageSize = 25 | 50 | 100;

export interface PersonListItem {
  id: number;
  first_name: string;
  last_name: string;
  primary_email: string | null;
  mobile: string;
  location: string;
  age_range: string;
  gender: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonRelationship {
  type: 'CONTACT' | 'ACTIVE_MEMBER' | 'FORMER_MEMBER';
  label: 'Contact' | 'Active Member' | 'Former Member';
}

export interface PersonMembership {
  id: number;
  status: 'ACTIVE' | 'FORMER';
  joined_at: string;
  ended_at: string | null;
  membership_source: 'WEBSITE_FORM' | 'STAFF' | 'COMMUNITY_PLATFORM' | 'OTHER';
  created_at: string;
  updated_at: string;
}

export interface Industry {
  id: number;
  name: string;
  slug: string;
}

export interface SkillSummary {
  id: number;
  name: string;
  slug: string;
}

export interface InterestSummary {
  id: number;
  name: string;
  slug: string;
}

export interface TagSummary {
  id: number;
  name: string;
  slug: string;
}

export interface InternalNoteUserSummary {
  id: number;
  email: string;
}

export interface InternalNote {
  id: number;
  body: string;
  created_by: InternalNoteUserSummary;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archived_by: InternalNoteUserSummary | null;
  archive_reason: string;
}

export interface PersonAuditActor {
  id: number;
  email: string;
}

export type PersonAuditChangeValue = string | number | boolean | null;

export interface PersonAuditFieldChange {
  from?: PersonAuditChangeValue;
  to?: PersonAuditChangeValue;
  changed?: boolean;
}

export interface PersonAuditHistoryEvent {
  id: number;
  action: string;
  description: string;
  actor: PersonAuditActor | null;
  occurred_at: string;
  entity_type: string;
  changes: Record<string, PersonAuditFieldChange | unknown>;
}

export type ProfessionalProfileCareerStage =
  | 'STUDENT'
  | 'EARLY_CAREER'
  | 'MID_CAREER'
  | 'SENIOR'
  | 'LEADERSHIP'
  | 'FOUNDER_BUSINESS_OWNER'
  | 'OTHER';

export interface ProfessionalProfile {
  id: number;
  job_title: string;
  company: string;
  industry: Industry | null;
  career_stage: ProfessionalProfileCareerStage | '' | null;
  linkedin_url: string;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalProfileWriteRequest {
  job_title: string;
  company: string;
  industry: number | null;
  career_stage: ProfessionalProfileCareerStage | '' | null;
  linkedin_url: string;
}

export interface MakeMembershipRequest {
  joined_at: string;
  membership_source: 'STAFF';
}

export interface PersonWriteFields {
  first_name: string;
  last_name: string;
  primary_email?: string | null;
  mobile?: string;
  location?: string;
  age_range?: string;
  gender?: string;
}

export interface CreateContactRequest extends PersonWriteFields {}

export interface CreateMemberRequest extends PersonWriteFields {
  joined_at: string;
  membership_source: 'STAFF';
}

export interface UpdatePersonRequest extends Partial<PersonWriteFields> {}

export interface DuplicatePersonMatch {
  id: number;
  first_name: string;
  last_name: string;
  primary_email: string | null;
  mobile: string;
  archived_at: string | null;
}

export interface DuplicatePersonConflict {
  detail: string;
  code: 'duplicate_person';
  matches: DuplicatePersonMatch[];
}

export interface EndMembershipRequest {
  ended_at: string;
}

export interface AssignSkillRequest {
  skill: number;
}

export interface AssignInterestRequest {
  interest: number;
}

export interface AssignTagRequest {
  tag: number;
}

export interface NotesListQuery {
  page: number;
  page_size: 25 | 50 | 100;
  record_state: NoteRecordState;
}

export interface CreateInternalNoteRequest {
  body: string;
}

export interface UpdateInternalNoteRequest {
  body: string;
}

export interface ArchiveInternalNoteRequest {
  archive_reason: string;
}

export interface PersonOverview {
  person: PersonListItem;
  relationship: PersonRelationship;
  membership: PersonMembership | null;
  professional_profile: ProfessionalProfile | null;
  skills: SkillSummary[];
  interests: InterestSummary[];
  tags: TagSummary[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type PersonRelationshipFilter = 'CONTACT' | 'ACTIVE_MEMBER' | 'FORMER_MEMBER';

export interface PeopleDirectoryQuery {
  q: string;
  relationship: PersonRelationshipFilter[];
  location: string[];
  industry: number[];
  career_stage: ProfessionalProfileCareerStage[];
  interest: number[];
  skill: number[];
  tag: number[];
  record_state: PersonRecordState;
  ordering: PeopleOrdering;
  page: number;
  page_size: PeoplePageSize;
}

// Kept as an alias while existing People callers migrate to the canonical name.
export type PeopleListQueryState = PeopleDirectoryQuery;

export type PaginatedPersonAuditHistoryResponse = PaginatedResponse<PersonAuditHistoryEvent>;
