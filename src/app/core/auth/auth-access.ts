import { AuthenticatedUser } from './auth.types';

export const CRM_STAFF_ROLE_CODES = ['CRM_ADMIN', 'CRM_MANAGER', 'CRM_VIEWER'] as const;

export function hasStaffCrmAccess(user: AuthenticatedUser | null): boolean {
  if (!user) {
    return false;
  }

  const staffRoles = Array.isArray(user.staff_roles) ? user.staff_roles : [];

  return staffRoles.some((role) =>
    CRM_STAFF_ROLE_CODES.includes(role as (typeof CRM_STAFF_ROLE_CODES)[number]),
  );
}
