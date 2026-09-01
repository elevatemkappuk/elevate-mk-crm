export interface ImportBatchSummary {
  id: number;
  source_type: string;
  source_filename: string;
  status: string;
  created_at: string;
  total_count: number;
  review_required_count: number;
  invalid_count: number;
  resolved_count: number;
  committed_count?: number;
}

export interface ImportCandidate {
  id: number;
  first_name: string;
  last_name: string;
  primary_email: string | null;
  mobile: string;
  record_state: 'active' | 'archived';
  matched_on: string[];
  name_agreement: boolean | null;
  mobile_agreement: boolean | null;
  email_agreement: boolean | null;
  contradiction_codes: string[];
}

export interface ImportSourceRecord {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  location: string | null;
  industry: string | null;
  job_title: string | null;
  linkedin_url: string | null;
}

export interface ImportReviewRecord {
  id: number;
  batch_id: number;
  source_row_identifier: string;
  status: string;
  source: ImportSourceRecord;
  candidates: ImportCandidate[];
  resolution_reason: string | null;
  match_evidence?: Record<string, unknown>;
  validation_errors: unknown[];
}

export interface ImportReviewDetail extends ImportReviewRecord {
  batch: {
    id: number;
    source_type: string;
    source_filename: string;
    status: string;
  };
}

export interface ImportBatchDetail extends ImportBatchSummary {}

export interface ImportReviewQueue {
  count: number;
  results: ImportReviewRecord[];
}
