export type MembershipSource =
  | 'WEBSITE_FORM'
  | 'MEMBERSHIP_FORM'
  | 'STAFF'
  | 'COMMUNITY_PLATFORM'
  | 'OTHER';

export function membershipSourceLabel(value: MembershipSource | string | null | undefined): string {
  switch (value) {
    case 'WEBSITE_FORM':
      return 'Website Form';
    case 'MEMBERSHIP_FORM':
      return 'Membership Form';
    case 'STAFF':
      return 'Staff';
    case 'COMMUNITY_PLATFORM':
      return 'Community Platform';
    case 'OTHER':
      return 'Other';
    default:
      return 'Not provided';
  }
}
