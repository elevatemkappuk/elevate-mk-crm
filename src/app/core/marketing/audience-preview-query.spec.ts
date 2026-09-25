import { convertToParamMap } from '@angular/router';
import type { PeopleDirectoryQuery } from '../people/people.types';

import {
  audienceQueryFromPeopleDirectory,
  audienceSelection,
  areAudiencePreviewQueriesEqual,
  DEFAULT_AUDIENCE_PREVIEW_QUERY,
  parseAudiencePreviewQuery,
  serializeAudiencePreviewQuery,
  withAudiencePreviewChange,
} from './audience-preview-query';

describe('audience preview query state', () => {
  it('parses and serializes compatible selection filters without record state', () => {
    const query = parseAudiencePreviewQuery(convertToParamMap({
      q: 'mentor',
      relationship: ['ACTIVE_MEMBER'],
      location: ['London'],
      result: 'excluded',
      page: '2',
      page_size: '50',
      record_state: 'archived',
    }));

    expect(query.result).toBe('excluded');
    expect(query.page).toBe(2);
    expect(query.page_size).toBe(50);
    expect(query.relationship).toEqual(['ACTIVE_MEMBER']);
    expect(serializeAudiencePreviewQuery(query)['record_state']).toBeNull();
    expect(serializeAudiencePreviewQuery(query)['result']).toBe('excluded');
  });

  it('resets pagination when selection, result, or page size changes', () => {
    const query = { ...DEFAULT_AUDIENCE_PREVIEW_QUERY, page: 4 };

    expect(withAudiencePreviewChange(query, { q: 'new' }).page).toBe(1);
    expect(withAudiencePreviewChange(query, { result: 'eligible' }).page).toBe(1);
    expect(withAudiencePreviewChange(query, { page_size: 100 }).page).toBe(1);
    expect(withAudiencePreviewChange(query, { page: 2 }, false).page).toBe(2);
  });

  it('creates an audience query from directory filters without carrying directory page or state', () => {
    const query = audienceQueryFromPeopleDirectory({
      ...DEFAULT_AUDIENCE_PREVIEW_QUERY,
      record_state: 'archived',
      page: 5,
      q: 'artist',
      page_size: 50,
    } as PeopleDirectoryQuery);

    expect(query.q).toBe('artist');
    expect(query.page).toBe(1);
    expect(query.page_size).toBe(50);
    expect(audienceSelection(query)).toEqual({
      q: 'artist', relationship: [], location: [], industry: [], career_stage: [], interest: [], skill: [], tag: [],
    });
    expect(areAudiencePreviewQueriesEqual(query, { ...query })).toBe(true);
  });
});
