import { ContentStatus, ModerationReason, ReportStatus } from '../../core/community-moderation/community-moderation.types';

export function reasonLabel(reason: ModerationReason): string {
  return ({ OFF_TOPIC: 'Off topic', SPAM_OR_EXCESSIVE_PROMOTION: 'Spam or excessive promotion', INAPPROPRIATE_OR_ABUSIVE: 'Inappropriate or abusive', MISLEADING_OR_SUSPICIOUS: 'Misleading or suspicious', OTHER: 'Other' })[reason];
}

export function contentStatusLabel(status: ContentStatus): string {
  return ({ ACTIVE: 'Active', AUTHOR_DELETED: 'Deleted by author', MODERATOR_REMOVED: 'Removed by moderator' })[status];
}

export function reportStatusLabel(status: ReportStatus): string {
  return ({ OPEN: 'Open', DISMISSED: 'Dismissed', RESOLVED: 'Resolved' })[status];
}
