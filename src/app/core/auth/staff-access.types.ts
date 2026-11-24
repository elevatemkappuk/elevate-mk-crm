export interface StaffAccessProjection {
  readonly capability_codes: readonly string[];
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
