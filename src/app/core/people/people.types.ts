export type PersonRecordState = 'active' | 'archived' | 'all';

export type PeopleOrdering =
  | 'first_name'
  | '-first_name'
  | 'last_name'
  | '-last_name'
  | 'created_at'
  | '-created_at'
  | 'updated_at'
  | '-updated_at';

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

export interface EndMembershipRequest {
  ended_at: string;
}

export interface PersonOverview {
  person: PersonListItem;
  relationship: PersonRelationship;
  membership: PersonMembership | null;
  professional_profile: ProfessionalProfile | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PeopleListQueryState {
  q: string;
  record_state: PersonRecordState;
  ordering: PeopleOrdering;
  page: number;
  page_size: PeoplePageSize;
}
