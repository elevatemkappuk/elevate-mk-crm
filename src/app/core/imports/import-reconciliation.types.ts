export interface ImportBatchSummary {
  id: number;
  source_type: string;
  source_filename: string;
  status: string;
  created_at: string;
  total_records: number;
  review_required_count: number;
  invalid_count: number;
  resolved_count: number;
  committed_count?: number;
}

export interface ImportCandidate {
  person_id: number;
  matched_on: string[];
  name_agreement: boolean | null;
  mobile_agreement: boolean | null;
  email_agreement: boolean | null;
  person_record_state: string;
  contradiction_codes: string[];
  person?: {
    first_name: string;
    last_name: string;
    primary_email: string | null;
    mobile: string;
    location: string;
  };
}

export interface ImportReviewRecord {
  id: number;
  batch_id: number;
  normalized_data: Record<string, string | null>;
  resolution_reason: string | null;
  match_candidates: ImportCandidate[];
  match_evidence: Record<string, unknown>;
}

export interface ImportBatchDetail extends ImportBatchSummary {}

export interface ImportReviewQueue {
  count: number;
  results: ImportReviewRecord[];
}
