export type StaffCapabilityCode =
  | 'STAFF_CAPABILITY_ADMIN'
  | 'PRIVACY_AUDIT_READ'
  | 'LEGAL_HOLD_ADMIN';

export interface StaffAccessProjection {
  readonly capability_codes: readonly StaffCapabilityCode[];
  readonly policy_version: number;
}

export type StaffAccessStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unauthenticated'
  | 'forbidden'
  | 'error';

export interface StaffAccessState {
  readonly status: StaffAccessStatus;
  readonly projection: StaffAccessProjection | null;
  readonly error: string | null;
}
