export type StaffRoleCode = 'CRM_ADMIN' | 'CRM_MANAGER' | 'CRM_VIEWER';
export type StaffState = 'ACTIVE' | 'FORMER' | 'PENDING' | 'DISABLED';

export interface StaffDirectoryRow {
  user_id: number | null;
  person_id: number | null;
  display_name: string;
  login_email: string | null;
  crm_role: StaffRoleCode | null;
  staff_access_state: StaffState;
  account_state: string | null;
  invitation_state: string | null;
  administrator_approval_state: string | null;
  protected_account: boolean;
  updated_at: string | null;
}

export interface StaffDirectoryResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: StaffDirectoryRow[];
}

export interface StaffDetail extends StaffDirectoryRow {
  person: { id: number; first_name: string; last_name: string; primary_email: string | null } | null;
  role_assignments: Array<{ id: number; role__code: string; role_family: string | null; is_active: boolean; assigned_at: string; revoked_at: string | null }>;
  invitations: Array<{ public_id: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; superseded_at: string | null; created_at: string }>;
  administrator_proposals: Array<{ public_id: string; operation: string; status: string; expires_at: string; created_at: string; decided_at: string | null; effected_at: string | null }>;
}

export interface StaffActivityEvent {
  id: number;
  event_type: string;
  occurred_at: string;
  actor: { id: number; email: string } | null;
  outcome: string | null;
  reason: string | null;
}

export interface StaffActivityResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: StaffActivityEvent[];
}
