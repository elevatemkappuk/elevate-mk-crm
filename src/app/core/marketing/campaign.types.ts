import { AudienceSelection } from './audience.types';

export type CampaignStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'SNAPSHOT_READY'
  | 'PREPARED'
  | 'RECONCILIATION_REQUIRED'
  | 'PROVIDER_FAILED'
  | 'NO_READY_RECIPIENTS';

export type CampaignPreparationStatus =
  | 'PREPARING'
  | 'SNAPSHOT_READY'
  | 'FAILED'
  | 'PROVIDER_PREPARING'
  | 'PREPARED'
  | 'RECONCILIATION_REQUIRED'
  | 'PROVIDER_FAILED'
  | 'NO_READY_RECIPIENTS';

export type CampaignRecipientDecision = 'INCLUDED' | 'EXCLUDED';
export type CampaignRecipientOutcome =
  | 'CONTACT_READY'
  | 'ADDED_TO_CAMPAIGN_LIST'
  | 'RECONCILIATION_REQUIRED'
  | 'PROVIDER_FAILED'
  | 'SKIPPED_CURRENT_CONSENT'
  | null;

export interface CampaignPreparation {
  id: number;
  attempt_number: number;
  status: CampaignPreparationStatus;
  started_at: string;
  completed_at: string | null;
  selected_count: number;
  included_count: number;
  excluded_count: number;
  provider_ready_count: number;
  provider_issue_count: number;
  can_start_provider_preparation: boolean;
  can_retry_provider_preparation: boolean;
  brevo_list_id: number | null;
  brevo_campaign_id: number | null;
  brevo_editor_url: string | null;
  provider_error_code: string | null;
  provider_error_message: string | null;
}

export interface Campaign {
  id: number;
  name: string;
  status: CampaignStatus;
  audience_selection: AudienceSelection;
  audience_ordering: string;
  audience_schema_version: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  current_preparation: CampaignPreparation | null;
}

export interface CampaignCreateRequest {
  name: string;
  audience_selection: AudienceSelection;
  audience_ordering: string;
}

export interface CampaignRecipientSnapshot {
  id: number;
  person: number;
  first_name_snapshot: string;
  last_name_snapshot: string;
  consent_state_snapshot: string;
  decision: CampaignRecipientDecision;
  exclusion_reason: string | null;
  captured_at: string;
  provider_outcome: CampaignRecipientOutcome;
  provider_error_code: string | null;
}

export interface CampaignRecipientPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: CampaignRecipientSnapshot[];
}

export interface CampaignPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Campaign[];
}

export function campaignStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    PREPARING: 'Preparing recipients',
    SNAPSHOT_READY: 'Recipients ready',
    PROVIDER_PREPARING: 'Preparing in Brevo',
    PREPARED: 'Ready in Brevo',
    PROVIDER_FAILED: 'Brevo preparation failed',
    RECONCILIATION_REQUIRED: 'Needs attention',
    NO_READY_RECIPIENTS: 'No recipients ready',
  };
  return labels[status] || 'Needs review';
}

export function campaignStatusTone(status: string): 'default' | 'info' | 'warning' | 'success' | 'neutral' {
  if (status === 'PREPARED' || status === 'SNAPSHOT_READY') return 'success';
  if (status === 'PROVIDER_FAILED' || status === 'RECONCILIATION_REQUIRED') return 'warning';
  if (status === 'NO_READY_RECIPIENTS') return 'neutral';
  return status === 'DRAFT' ? 'default' : 'info';
}

export function recipientDecisionLabel(decision: CampaignRecipientDecision): string {
  return decision === 'INCLUDED' ? 'Included' : 'Excluded';
}

export function recipientReasonLabel(reason: string | null): string {
  const labels: Record<string, string> = {
    EXCLUDED_OPTED_OUT: 'Opted out',
    EXCLUDED_CONSENT_UNKNOWN: 'Consent unknown',
    EXCLUDED_NO_EMAIL: 'No email address',
  };
  return reason ? labels[reason] || reason.replaceAll('_', ' ').toLowerCase() : '—';
}

export function campaignCriteriaSummary(selection: AudienceSelection): string[] {
  const summary: string[] = [];
  if (selection.q) summary.push(`Search: ${selection.q}`);
  if (selection.relationship.length) summary.push(`Relationships: ${selection.relationship.join(', ')}`);
  if (selection.location.length) summary.push(`Locations: ${selection.location.join(', ')}`);
  if (selection.industry.length) summary.push(`Industries: ${selection.industry.join(', ')}`);
  if (selection.career_stage.length) summary.push(`Career stages: ${selection.career_stage.join(', ')}`);
  if (selection.interest.length) summary.push(`Interests: ${selection.interest.join(', ')}`);
  if (selection.skill.length) summary.push(`Skills: ${selection.skill.join(', ')}`);
  if (selection.tag.length) summary.push(`Tags: ${selection.tag.join(', ')}`);
  return summary.length ? summary : ['All active People'];
}
