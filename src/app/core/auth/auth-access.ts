import { AuthenticatedUser } from './auth.types';

export const CRM_STAFF_ROLE_CODES = ['CRM_ADMIN', 'CRM_MANAGER', 'CRM_VIEWER'] as const;
export const CRM_ADMIN_ROLE_CODE = 'CRM_ADMIN' as const;

export function getStaffRoles(user: AuthenticatedUser | null): string[] {
  if (!user || !Array.isArray(user.staff_roles)) {
    return [];
  }

  return user.staff_roles;
}

export function hasStaffCrmAccess(user: AuthenticatedUser | null): boolean {
  return getStaffRoles(user).some((role) =>
    CRM_STAFF_ROLE_CODES.includes(role as (typeof CRM_STAFF_ROLE_CODES)[number]),
  );
}

export function hasStaffRole(user: AuthenticatedUser | null, roleCode: string): boolean {
  return getStaffRoles(user).includes(roleCode);
}

export function isCrmAdmin(user: AuthenticatedUser | null): boolean {
  return hasStaffRole(user, CRM_ADMIN_ROLE_CODE);
}
