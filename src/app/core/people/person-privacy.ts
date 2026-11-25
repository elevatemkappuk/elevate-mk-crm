import { PersonListItem, PersonOverview } from './people.types';

export function redactPersonAfterAccessLoss<T extends PersonListItem>(
  person: T,
  contactLost: boolean,
  demographicLost: boolean,
): T {
  return {
    ...person,
    ...(contactLost ? { primary_email: 'Restricted', mobile: 'Restricted' } : {}),
    ...(demographicLost ? { age_range: 'Restricted', gender: 'Restricted' } : {}),
    privacy: {
      contact_restricted: contactLost || Boolean(person.privacy?.contact_restricted),
      demographic_restricted: demographicLost || Boolean(person.privacy?.demographic_restricted),
    },
  } as T;
}

export function redactOverviewAfterAccessLoss(
  overview: PersonOverview,
  contactLost: boolean,
  demographicLost: boolean,
): PersonOverview {
  return {
    ...overview,
    person: redactPersonAfterAccessLoss(overview.person, contactLost, demographicLost),
    community_account: contactLost
      ? { ...overview.community_account, account_email: 'Restricted', setup_email: 'Restricted' }
      : overview.community_account,
  };
}
