export interface GovernanceCapabilityState {
  readonly assignment_state: string | null;
  readonly restriction_active: boolean;
  readonly effective: boolean;
  readonly effective_explanation: {
    readonly effective: boolean;
    readonly sources: readonly string[];
    readonly reason: string;
    readonly pending_change: { readonly operation: string; readonly status: string } | null;
  };
  readonly permitted_actions: readonly string[];
  readonly permitted_action_modes: Readonly<Record<string, 'DIRECT' | 'PROPOSAL' | 'DIRECT_SUPERUSER'>>;
}

export interface GovernanceTargetDetail {
  readonly target_user_id: number;
  readonly person_id: number;
  readonly is_active: boolean;
  readonly record_type: string;
  readonly staff_roles: readonly { id: number; code: string; is_active: boolean }[];
  readonly capabilities: Readonly<Record<string, GovernanceCapabilityState>>;
}

export interface GovernanceStaffSummary {
  readonly user_id: number;
  readonly display_name: string;
  readonly record_type: string;
  readonly is_active: boolean;
  readonly role_codes: readonly string[];
  readonly eligible: boolean;
  readonly can_manage_privacy_permissions: boolean;
}

export interface GovernanceStaffDirectory {
  readonly count: number;
  readonly page: number;
  readonly page_size: number;
  readonly results: readonly GovernanceStaffSummary[];
}

export interface GovernanceRoleDefaults {
  readonly policy_version: number;
  readonly role_defaults: readonly {
    id: number | null;
    role_id: number;
    role_code: string;
    capability: string;
    is_enabled: boolean;
    permitted_actions: readonly string[];
    execution_mode: 'PROPOSAL' | 'DIRECT_SUPERUSER';
  }[];
}

export interface GovernanceProposal {
  readonly public_id: string;
  readonly operation: string;
  readonly status: string;
  readonly role_id: number | null;
  readonly role_code: string | null;
  readonly target_user_id: number | null;
  readonly capability: string;
  readonly proposed_by_id: number;
  readonly reason: string;
  readonly policy_version: number;
  readonly expires_at: string;
  readonly created_at: string;
  readonly resolved_at: string | null;
  readonly resolution_reason: string;
  readonly permitted_actions: readonly ('approve' | 'reject' | 'cancel')[];
  readonly history_entry_type?: 'proposal' | 'audit';
  readonly actor_user_id?: number | null;
  readonly timestamp?: string;
  readonly target_label?: string;
  readonly proposed_state?: Record<string, unknown> | null;
  readonly resulting_state?: Record<string, unknown> | null;
  readonly superuser_operation?: boolean;
  readonly decision: {
    readonly outcome: string;
    readonly decided_by_id: number;
    readonly reason: string;
    readonly policy_version: number;
    readonly created_at: string;
  } | null;
}
