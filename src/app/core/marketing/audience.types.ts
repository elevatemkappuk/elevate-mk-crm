import {
  PeopleDirectoryQuery,
  PeopleOrdering,
  PeoplePageSize,
  PersonRelationshipFilter,
  ProfessionalProfileCareerStage,
} from '../people/people.types';

export type AudienceResultView = 'all' | 'eligible' | 'excluded';
export type AudienceExclusionReason =
  | 'EXCLUDED_OPTED_OUT'
  | 'EXCLUDED_CONSENT_UNKNOWN'
  | 'EXCLUDED_NO_EMAIL';
export type AudienceClassification = 'ELIGIBLE' | AudienceExclusionReason;

export interface AudienceSelection {
  q: string;
  relationship: PersonRelationshipFilter[];
  location: string[];
  industry: number[];
  career_stage: ProfessionalProfileCareerStage[];
  interest: number[];
  skill: number[];
  tag: number[];
}

export interface AudiencePreviewQuery extends AudienceSelection {
  result: AudienceResultView;
  ordering: PeopleOrdering;
  page: number;
  page_size: PeoplePageSize;
}

export interface AudiencePreviewRequest {
  selection: AudienceSelection;
  result: AudienceResultView;
  ordering: PeopleOrdering;
  page: number;
  page_size: PeoplePageSize;
}

export interface AudiencePreviewPerson {
  id: number;
  first_name: string;
  last_name: string;
  primary_email: string | null;
  classification: AudienceClassification;
  exclusion_reasons: AudienceExclusionReason[];
}

export interface AudiencePreviewResults {
  count: number;
  page: number;
  page_size: PeoplePageSize;
  next_page: number | null;
  previous_page: number | null;
  next: number | null;
  previous: number | null;
  results: AudiencePreviewPerson[];
}

export interface AudiencePreviewResponse {
  selection: AudienceSelection & { record_state: 'active' };
  selected_count: number;
  eligible_count: number;
  excluded_count: number;
  exclusion_counts: Record<AudienceExclusionReason, number>;
  results: AudiencePreviewResults;
}

export type AudienceSelectionPatch = Partial<
  Pick<PeopleDirectoryQuery, 'q' | 'relationship' | 'location' | 'industry' | 'career_stage' | 'interest' | 'skill' | 'tag'>
>;
