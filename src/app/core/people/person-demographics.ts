export type AgeRange =
  | 'UNDER_25'
  | '25_29'
  | '30_34'
  | '35_39'
  | '40_45'
  | 'OVER_45';

export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'TRANSGENDER' | 'OTHER';

export interface DemographicOption<T extends string> {
  value: T;
  label: string;
}

export const AGE_RANGE_OPTIONS: readonly DemographicOption<AgeRange>[] = [
  { value: 'UNDER_25', label: 'Under 25' },
  { value: '25_29', label: '25 - 29' },
  { value: '30_34', label: '30 - 34' },
  { value: '35_39', label: '35 - 39' },
  { value: '40_45', label: '40 - 45' },
  { value: 'OVER_45', label: 'Over 45' },
];

export const GENDER_OPTIONS: readonly DemographicOption<Gender>[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'NON_BINARY', label: 'Non-Binary' },
  { value: 'TRANSGENDER', label: 'Transgender' },
  { value: 'OTHER', label: 'Other' },
];

export function toAgeRange(value: string | null | undefined): AgeRange | '' {
  return AGE_RANGE_OPTIONS.some((option) => option.value === value) ? (value as AgeRange) : '';
}

export function toGender(value: string | null | undefined): Gender | '' {
  return GENDER_OPTIONS.some((option) => option.value === value) ? (value as Gender) : '';
}

export function ageRangeLabel(value: string | null | undefined): string {
  return AGE_RANGE_OPTIONS.find((option) => option.value === value)?.label ?? value ?? '';
}

export function genderLabel(value: string | null | undefined): string {
  return GENDER_OPTIONS.find((option) => option.value === value)?.label ?? value ?? '';
}
