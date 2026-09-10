import { membershipSourceLabel } from './membership-source';

describe('membershipSourceLabel', () => {
  it('labels Membership Form records clearly', () => {
    expect(membershipSourceLabel('MEMBERSHIP_FORM')).toBe('Membership Form');
  });

  it('preserves labels for existing membership sources', () => {
    expect(membershipSourceLabel('WEBSITE_FORM')).toBe('Website Form');
    expect(membershipSourceLabel('STAFF')).toBe('Staff');
    expect(membershipSourceLabel('COMMUNITY_PLATFORM')).toBe('Community Platform');
    expect(membershipSourceLabel('OTHER')).toBe('Other');
  });

  it('uses the existing fallback for missing sources', () => {
    expect(membershipSourceLabel(null)).toBe('Not provided');
    expect(membershipSourceLabel('')).toBe('Not provided');
  });
});
