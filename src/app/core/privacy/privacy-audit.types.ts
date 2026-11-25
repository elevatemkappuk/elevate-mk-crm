export interface PrivacyAuditActor {
  readonly kind: 'SYSTEM' | 'USER';
  readonly id: number | null;
  readonly display_name: string;
  readonly email: string | null;
  readonly contact_restricted: boolean;
}

export interface PrivacyAuditHistoryEvent {
  readonly id: string;
  readonly action: string;
  readonly description: string;
  readonly occurred_at: string;
  readonly entity_type: string;
  readonly actor: PrivacyAuditActor;
  readonly outcome: string;
  readonly superuser_operation: boolean;
  readonly capability: string | null;
}

export interface PaginatedPrivacyAuditHistoryResponse {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly PrivacyAuditHistoryEvent[];
}

export interface PrivacyAuditHistoryQuery {
  readonly page?: number;
  readonly page_size?: 25 | 50 | 100;
  readonly occurred_from?: string;
  readonly occurred_to?: string;
  readonly activity_type?: string;
  readonly outcome?: string;
  readonly superuser_operation?: boolean;
}
