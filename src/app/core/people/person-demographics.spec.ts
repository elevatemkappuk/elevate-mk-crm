import {
  AGE_RANGE_OPTIONS,
  GENDER_OPTIONS,
  ageRangeLabel,
  genderLabel,
  toAgeRange,
  toGender,
} from './person-demographics';

describe('Person demographics', () => {
  it('defines all canonical age-range options with their display labels', () => {
    expect(AGE_RANGE_OPTIONS).toEqual([
      { value: 'UNDER_25', label: 'Under 25' },
      { value: '25_29', label: '25 - 29' },
      { value: '30_34', label: '30 - 34' },
      { value: '35_39', label: '35 - 39' },
      { value: '40_45', label: '40 - 45' },
      { value: 'OVER_45', label: 'Over 45' },
    ]);
  });

  it('defines all canonical gender options with their display labels', () => {
    expect(GENDER_OPTIONS).toEqual([
      { value: 'MALE', label: 'Male' },
      { value: 'FEMALE', label: 'Female' },
      { value: 'NON_BINARY', label: 'Non-Binary' },
      { value: 'TRANSGENDER', label: 'Transgender' },
      { value: 'OTHER', label: 'Other' },
    ]);
  });

  it('renders canonical values as labels and preserves unexpected legacy display values safely', () => {
    expect(ageRangeLabel('25_29')).toBe('25 - 29');
    expect(genderLabel('NON_BINARY')).toBe('Non-Binary');
    expect(ageRangeLabel('25 - 29')).toBe('25 - 29');
    expect(genderLabel('Female')).toBe('Female');
  });

  it('allows only canonical values in write-form controls', () => {
    expect(toAgeRange('25_29')).toBe('25_29');
    expect(toGender('NON_BINARY')).toBe('NON_BINARY');
    expect(toAgeRange('25 - 29')).toBe('');
    expect(toGender('Non-Binary')).toBe('');
  });
});
