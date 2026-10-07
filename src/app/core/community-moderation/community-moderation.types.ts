export type ModerationReason = 'OFF_TOPIC' | 'SPAM_OR_EXCESSIVE_PROMOTION' | 'INAPPROPRIATE_OR_ABUSIVE' | 'MISLEADING_OR_SUSPICIOUS' | 'OTHER';
export type ReportStatus = 'OPEN' | 'DISMISSED' | 'RESOLVED';
export type ContentStatus = 'ACTIVE' | 'AUTHOR_DELETED' | 'MODERATOR_REMOVED';
export type ModerationTargetType = 'POST' | 'REPLY';

export interface ModerationIdentity {
  directory_id: string | null;
  first_name: string;
  last_name: string;
  location: string;
  job_title: string;
}

export interface ModerationParentPost {
  public_id: string;
  headline: string;
  body: string;
}

export interface ModerationTarget {
  type: ModerationTargetType;
  public_id: string;
  status: ContentStatus;
  headline: string;
  body: string;
  author: ModerationIdentity;
  parent_post: ModerationParentPost | null;
}

export interface ModerationReport {
  report_id: string;
  reason: ModerationReason;
  details: string;
  status: ReportStatus;
  created_at: string;
  resolved_at: string | null;
  reporter: ModerationIdentity;
  target: ModerationTarget;
}

export interface ModerationReportPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: ModerationReport[];
}

