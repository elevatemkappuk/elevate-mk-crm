import { contentStatusLabel, reasonLabel, reportStatusLabel } from './moderation-helpers';

describe('moderation labels', () => {
  it('maps every backend reason and lifecycle state to staff-facing labels', () => {
    expect(reasonLabel('OFF_TOPIC')).toBe('Off topic');
    expect(reasonLabel('SPAM_OR_EXCESSIVE_PROMOTION')).toBe('Spam or excessive promotion');
    expect(reasonLabel('INAPPROPRIATE_OR_ABUSIVE')).toBe('Inappropriate or abusive');
    expect(reasonLabel('MISLEADING_OR_SUSPICIOUS')).toBe('Misleading or suspicious');
    expect(reasonLabel('OTHER')).toBe('Other');
    expect(contentStatusLabel('AUTHOR_DELETED')).toBe('Deleted by author');
    expect(contentStatusLabel('MODERATOR_REMOVED')).toBe('Removed by moderator');
    expect(reportStatusLabel('DISMISSED')).toBe('Dismissed');
  });
});
