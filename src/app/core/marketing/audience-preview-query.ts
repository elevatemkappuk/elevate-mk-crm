import { ParamMap, Params } from '@angular/router';

import {
  arePeopleDirectoryQueriesEqual,
  parsePeopleDirectoryQuery,
  serializePeopleDirectoryQuery,
} from '../people/people-directory-query';
import { PeopleDirectoryQuery } from '../people/people.types';
import {
  AudiencePreviewQuery,
  AudienceResultView,
  AudienceSelectionPatch,
} from './audience.types';

const RESULTS: AudienceResultView[] = ['all', 'eligible', 'excluded'];

export const DEFAULT_AUDIENCE_PREVIEW_QUERY: AudiencePreviewQuery = {
  q: '',
  relationship: [],
  location: [],
  industry: [],
  career_stage: [],
  interest: [],
  skill: [],
  tag: [],
  result: 'all',
  ordering: 'last_name',
  page: 1,
  page_size: 25,
};

export function parseAudiencePreviewQuery(params: ParamMap): AudiencePreviewQuery {
  const peopleQuery = parsePeopleDirectoryQuery(params);
  const result = params.get('result');

  return {
    ...peopleQuery,
    record_state: 'active',
    result: RESULTS.includes(result as AudienceResultView) ? result as AudienceResultView : 'all',
  } as AudiencePreviewQuery;
}

export function serializeAudiencePreviewQuery(query: AudiencePreviewQuery): Params {
  const peopleQuery: PeopleDirectoryQuery = {
    ...query,
    record_state: 'active',
  };
  const params = serializePeopleDirectoryQuery(peopleQuery);
  return {
    ...params,
    result: query.result === 'all' ? null : query.result,
  };
}

export function withAudiencePreviewChange(
  query: AudiencePreviewQuery,
  patch: AudienceSelectionPatch & Partial<Pick<AudiencePreviewQuery, 'result' | 'ordering' | 'page' | 'page_size'>>,
  resetPage = true,
): AudiencePreviewQuery {
  return {
    ...query,
    ...patch,
    page: resetPage ? 1 : patch.page ?? query.page,
  };
}

export function audienceSelection(query: AudiencePreviewQuery) {
  return {
    q: query.q,
    relationship: query.relationship,
    location: query.location,
    industry: query.industry,
    career_stage: query.career_stage,
    interest: query.interest,
    skill: query.skill,
    tag: query.tag,
  };
}

export function areAudiencePreviewQueriesEqual(left: AudiencePreviewQuery, right: AudiencePreviewQuery): boolean {
  const leftPeople = { ...left, record_state: 'active' } as PeopleDirectoryQuery;
  const rightPeople = { ...right, record_state: 'active' } as PeopleDirectoryQuery;
  return left.result === right.result && arePeopleDirectoryQueriesEqual(leftPeople, rightPeople);
}

export function audienceQueryFromPeopleDirectory(query: PeopleDirectoryQuery): AudiencePreviewQuery {
  return {
    ...DEFAULT_AUDIENCE_PREVIEW_QUERY,
    q: query.q,
    relationship: [...query.relationship],
    location: [...query.location],
    industry: [...query.industry],
    career_stage: [...query.career_stage],
    interest: [...query.interest],
    skill: [...query.skill],
    tag: [...query.tag],
    ordering: query.ordering,
    page_size: query.page_size,
  };
}
