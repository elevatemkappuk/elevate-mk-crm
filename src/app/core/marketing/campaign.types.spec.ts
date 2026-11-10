import { campaignStatusLabel, recipientReasonLabel, recipientReconciliationReason } from './campaign.types';

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

  it('maps reconciliation codes to safe staff-facing explanations', () => {
    expect(recipientReconciliationReason('BREVO_CONTACT_RESTRICTED').title).toBe('Blocked in Brevo');
    expect(recipientReconciliationReason('BREVO_CONTACT_NOT_FOUND_FOR_EXISTING_REFERENCE').title).toBe('Brevo contact needs review');
    expect(recipientReconciliationReason('BREVO_CONTACT_IDENTITY_CONFLICT').title).toBe('Brevo contact identity needs review');
    expect(recipientReconciliationReason('UNKNOWN_CODE').explanation).toBe('This recipient could not be safely reconciled with Brevo.');
  });
});
