import { campaignStatusLabel, recipientReasonLabel } from './campaign.types';

describe('campaign display labels', () => {
  it('keeps provider states staff-facing and translates recipient reasons', () => {
    expect(campaignStatusLabel('SNAPSHOT_READY')).toBe('Recipients ready');
    expect(campaignStatusLabel('PROVIDER_PREPARING')).toBe('Preparing in Brevo');
    expect(campaignStatusLabel('PREPARED')).toBe('Ready in Brevo');
    expect(recipientReasonLabel('EXCLUDED_OPTED_OUT')).toBe('Opted out');
    expect(recipientReasonLabel('EXCLUDED_CONSENT_UNKNOWN')).toBe('Consent unknown');
    expect(recipientReasonLabel('EXCLUDED_NO_EMAIL')).toBe('No email address');
    expect(recipientReasonLabel('UNEXPECTED_REASON')).toBe('unexpected reason');
  });
});
