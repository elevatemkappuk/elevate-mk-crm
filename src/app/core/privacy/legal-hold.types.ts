export type LegalHoldExecutionMode = 'GOVERNED' | 'DIRECT_SUPERUSER';

export interface LegalHoldActor {
  readonly id: number | null;
  readonly display_name: string;
  readonly contact_restricted: boolean;
}

export interface LegalHold {
  readonly public_id: string;
  readonly scope: 'PERSON' | 'EVENT';
  readonly status: 'ACTIVE' | 'RELEASED';
  readonly person_id: number | null;
  readonly person_display_name: string | null;
  readonly audit_event_reference: string | null;
  readonly placed_by_id: number;
  readonly placed_by: LegalHoldActor;
  readonly placed_at: string;
  readonly released_by_id: number | null;
  readonly released_by: LegalHoldActor | null;
  readonly released_at: string | null;
  readonly justification: string | null;
  readonly permitted_actions: readonly string[];
  readonly execution_mode: LegalHoldExecutionMode;
  readonly release_requests: readonly LegalHoldReleaseRequest[];
}

export interface LegalHoldReleaseRequest {
  readonly public_id: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  readonly justification: string;
  readonly requested_by_id: number;
  readonly requested_by: LegalHoldActor;
  readonly requested_at: string;
  readonly approved_by_id: number | null;
  readonly approved_by: LegalHoldActor | null;
  readonly approved_at: string | null;
  readonly approval_justification: string | null;
  readonly rejected_by_id: number | null;
  readonly rejected_by: LegalHoldActor | null;
  readonly rejected_at: string | null;
  readonly rejection_reason: string | null;
  readonly cancelled_by_id: number | null;
  readonly cancelled_by: LegalHoldActor | null;
  readonly cancelled_at: string | null;
  readonly cancellation_reason: string | null;
  readonly permitted_actions: readonly ('approve' | 'reject' | 'cancel')[];
}

export interface PaginatedLegalHoldsResponse {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly LegalHold[];
}

export interface CreateLegalHoldRequest {
  readonly person_id?: number;
  readonly audit_event_reference?: string;
  readonly reason: string;
}

export interface LegalHoldReleaseRequestResult {
  readonly public_id: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  readonly permitted_actions?: readonly string[];
  readonly execution_mode?: LegalHoldExecutionMode;
}
