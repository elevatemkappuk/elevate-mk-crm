import { ParamMap, Params } from '@angular/router';

import { PeopleDirectoryQuery, PeopleOrdering, PeoplePageSize, PersonRecordState, PersonRelationshipFilter, ProfessionalProfileCareerStage } from './people.types';

export const DEFAULT_PEOPLE_DIRECTORY_QUERY: PeopleDirectoryQuery = {
  q: '', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [],
  record_state: 'active', ordering: 'last_name', page: 1, page_size: 25,
};

const RECORD_STATES: PersonRecordState[] = ['active', 'archived', 'all'];
const ORDERINGS: PeopleOrdering[] = ['name', '-name', 'first_name', '-first_name', 'last_name', '-last_name', 'created_at', '-created_at', 'updated_at', '-updated_at', 'membership_joined_at', '-membership_joined_at'];
const PAGE_SIZES: PeoplePageSize[] = [25, 50, 100];
const RELATIONSHIPS: PersonRelationshipFilter[] = ['CONTACT', 'ACTIVE_MEMBER', 'FORMER_MEMBER'];
const CAREER_STAGES: ProfessionalProfileCareerStage[] = ['STUDENT', 'EARLY_CAREER', 'MID_CAREER', 'SENIOR', 'LEADERSHIP', 'FOUNDER_BUSINESS_OWNER', 'OTHER'];

export function parsePeopleDirectoryQuery(params: ParamMap): PeopleDirectoryQuery {
  return {
    q: (params.get('q') ?? '').trim(),
    relationship: parseEnumList(params.getAll('relationship'), RELATIONSHIPS),
    location: unique(params.getAll('location').map((value) => value.trim()).filter(Boolean)),
    industry: parseIdList(params.getAll('industry')),
    career_stage: parseEnumList(params.getAll('career_stage'), CAREER_STAGES),
    interest: parseIdList(params.getAll('interest')),
    skill: parseIdList(params.getAll('skill')),
    tag: parseIdList(params.getAll('tag')),
    record_state: parseEnum(params.get('record_state'), RECORD_STATES, DEFAULT_PEOPLE_DIRECTORY_QUERY.record_state),
    ordering: parseEnum(params.get('ordering'), ORDERINGS, DEFAULT_PEOPLE_DIRECTORY_QUERY.ordering),
    page: parsePositiveInt(params.get('page'), DEFAULT_PEOPLE_DIRECTORY_QUERY.page),
    page_size: parseEnum(Number(params.get('page_size')), PAGE_SIZES, DEFAULT_PEOPLE_DIRECTORY_QUERY.page_size),
  };
}

export function serializePeopleDirectoryQuery(query: PeopleDirectoryQuery): Params {
  return {
    q: query.q || null,
    relationship: query.relationship.length ? query.relationship : null,
    location: query.location.length ? query.location : null,
    industry: query.industry.length ? query.industry.map(String) : null,
    career_stage: query.career_stage.length ? query.career_stage : null,
    interest: query.interest.length ? query.interest.map(String) : null,
    skill: query.skill.length ? query.skill.map(String) : null,
    tag: query.tag.length ? query.tag.map(String) : null,
    record_state: query.record_state === DEFAULT_PEOPLE_DIRECTORY_QUERY.record_state ? null : query.record_state,
    ordering: query.ordering === DEFAULT_PEOPLE_DIRECTORY_QUERY.ordering ? null : query.ordering,
    page: query.page === DEFAULT_PEOPLE_DIRECTORY_QUERY.page ? null : String(query.page),
    page_size: query.page_size === DEFAULT_PEOPLE_DIRECTORY_QUERY.page_size ? null : String(query.page_size),
  };
}

export function withPeopleDirectoryQueryChange(query: PeopleDirectoryQuery, patch: Partial<PeopleDirectoryQuery>, resetPage = true): PeopleDirectoryQuery {
  return { ...query, ...patch, page: resetPage ? 1 : patch.page ?? query.page };
}

export function arePeopleDirectoryQueriesEqual(left: PeopleDirectoryQuery, right: PeopleDirectoryQuery): boolean {
  return left.q === right.q && left.record_state === right.record_state && left.ordering === right.ordering && left.page === right.page && left.page_size === right.page_size
    && arraysEqual(left.relationship, right.relationship) && arraysEqual(left.location, right.location) && arraysEqual(left.industry, right.industry)
    && arraysEqual(left.career_stage, right.career_stage) && arraysEqual(left.interest, right.interest) && arraysEqual(left.skill, right.skill) && arraysEqual(left.tag, right.tag);
}

function parseIdList(values: string[]): number[] { return unique(values.map(Number).filter((value) => Number.isInteger(value) && value > 0)); }
function parseEnum<T>(value: unknown, values: readonly T[], fallback: T): T { return values.includes(value as T) ? value as T : fallback; }
function parseEnumList<T extends string>(values: string[], allowed: readonly T[]): T[] { return unique(values.filter((value): value is T => allowed.includes(value as T))); }
function parsePositiveInt(value: string | null, fallback: number): number { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; }
function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function arraysEqual<T>(left: T[], right: T[]): boolean { return left.length === right.length && left.every((value, index) => value === right[index]); }
