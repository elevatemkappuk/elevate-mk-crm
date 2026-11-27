import { PersonListItem, PersonOverview } from './people.types';

export function redactPersonAfterAccessLoss<T extends PersonListItem>(
  person: T,
  contactLost: boolean,
  demographicLost: boolean,
): T {
  const serverContactRestricted = Boolean(person.privacy?.contact_restricted);
  const serverDemographicRestricted = Boolean(person.privacy?.demographic_restricted);
  const contactRestricted = contactLost || serverContactRestricted;
  const demographicRestricted = demographicLost || serverDemographicRestricted;
  const safeContactProjection = serverContactRestricted && isSafeContactProjection(person);
  const shouldRedactContact = (contactLost || serverContactRestricted) && !safeContactProjection;
  const shouldRedactDemographics = demographicLost && !serverDemographicRestricted;
  const alreadyRedacted =
    (!shouldRedactContact || isSafeContactProjection(person)) &&
    (!shouldRedactDemographics || (person.age_range === 'Restricted' && person.gender === 'Restricted')) &&
    person.privacy?.contact_restricted === contactRestricted &&
    person.privacy?.demographic_restricted === demographicRestricted;
  if (alreadyRedacted) return person;

  return {
    ...person,
    ...(shouldRedactContact ? { primary_email: redactContactValue(person.primary_email), mobile: redactContactValue(person.mobile) } : {}),
    ...(shouldRedactDemographics ? { age_range: 'Restricted', gender: 'Restricted' } : {}),
    privacy: {
      contact_restricted: contactRestricted,
      demographic_restricted: demographicRestricted,
    },
  } as T;
}

function redactContactValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim() === '') return value ?? null;
  return 'Restricted';
}

function isSafeContactProjection(person: Pick<PersonListItem, 'primary_email' | 'mobile'>): boolean {
  return isSafeMaskedEmail(person.primary_email) && isSafeMaskedMobile(person.mobile);
}

function isSafeMaskedEmail(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.trim() === '') return true;
  return value === 'Restricted' || /^[^*@\s]\*{3}[^@\s]*@[^@\s]+$/u.test(value);
}

function isSafeMaskedMobile(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.trim() === '') return true;
  return value === 'Restricted' || /^\*{6}\d{2}$/u.test(value);
}

export function redactOverviewAfterAccessLoss(
  overview: PersonOverview,
  contactLost: boolean,
  demographicLost: boolean,
): PersonOverview {
  const person = redactPersonAfterAccessLoss(overview.person, contactLost, demographicLost);
  const account = overview.community_account;
  const communityAccount = contactLost && (account.account_email !== 'Restricted' || account.setup_email !== 'Restricted')
    ? { ...account, account_email: 'Restricted', setup_email: 'Restricted' }
    : account;
  if (person === overview.person && communityAccount === overview.community_account) return overview;

  return {
    ...overview,
    person,
    community_account: communityAccount,
  };
}
