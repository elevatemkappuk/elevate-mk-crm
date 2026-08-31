import { convertToParamMap } from '@angular/router';

import { DEFAULT_PEOPLE_DIRECTORY_QUERY, parsePeopleDirectoryQuery, serializePeopleDirectoryQuery, withPeopleDirectoryQueryChange } from './people-directory-query';

describe('People directory query helpers', () => {
  it('parses repeated canonical filters while safely ignoring malformed IDs', () => {
    const query = parsePeopleDirectoryQuery(convertToParamMap({
      q: ' engineer ', relationship: ['CONTACT', 'ACTIVE_MEMBER'], location: ['London', 'Milton Keynes'],
      industry: ['5', 'no'], career_stage: ['SENIOR', 'INVALID'], interest: ['2', '8'], skill: ['4'], tag: ['6', 'bad'],
      record_state: 'archived', ordering: '-membership_joined_at', page: '3', page_size: '50',
    }));
    expect(query).toEqual({ q: 'engineer', relationship: ['CONTACT', 'ACTIVE_MEMBER'], location: ['London', 'Milton Keynes'], industry: [5], career_stage: ['SENIOR'], interest: [2, 8], skill: [4], tag: [6], record_state: 'archived', ordering: '-membership_joined_at', page: 3, page_size: 50 });
  });

  it('omits defaults and serializes repeated values as arrays rather than comma-separated strings', () => {
    const params = serializePeopleDirectoryQuery({ ...DEFAULT_PEOPLE_DIRECTORY_QUERY, relationship: ['CONTACT', 'ACTIVE_MEMBER'], interest: [2, 8], skill: [4] });
    expect(params['relationship']).toEqual(['CONTACT', 'ACTIVE_MEMBER']);
    expect(params['interest']).toEqual(['2', '8']);
    expect(params['skill']).toEqual(['4']);
    expect(params['page']).toBeNull();
    expect(params['ordering']).toBeNull();
  });

  it('preserves unrelated state and resets page for filter changes only', () => {
    const query = { ...DEFAULT_PEOPLE_DIRECTORY_QUERY, page: 4, page_size: 50, tag: [6] };
    expect(withPeopleDirectoryQueryChange(query, { interest: [2] })).toEqual({ ...query, interest: [2], page: 1 });
    expect(withPeopleDirectoryQueryChange(query, { page: 3 }, false)).toEqual({ ...query, page: 3 });
  });
});
