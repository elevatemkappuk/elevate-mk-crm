import { redactOverviewAfterAccessLoss, redactPersonAfterAccessLoss } from './person-privacy';

describe('Person privacy redaction', () => {
  const createPerson = () => ({
    id: 10,
    first_name: 'UAT',
    last_name: 'Subject',
    primary_email: 'uat@example.invalid',
    mobile: '+44 7000 000001',
    age_range: '30_34',
    gender: 'FEMALE',
    privacy: { contact_restricted: false, demographic_restricted: false },
  } as any);

  it.each([
    { contactLost: false, demographicLost: false, contact: 'uat@example.invalid', demographic: '30_34' },
    { contactLost: true, demographicLost: false, contact: 'Restricted', demographic: '30_34' },
    { contactLost: false, demographicLost: true, contact: 'uat@example.invalid', demographic: 'Restricted' },
    { contactLost: true, demographicLost: true, contact: 'Restricted', demographic: 'Restricted' },
  ])('preserves stable identity for contactLost=$contactLost and demographicLost=$demographicLost', ({ contactLost, demographicLost, contact, demographic }) => {
    const person = createPerson();
    const redacted = redactPersonAfterAccessLoss(person, contactLost, demographicLost);

    expect(redacted.primary_email).toBe(contact);
    expect(redacted.age_range).toBe(demographic);
    expect(redactPersonAfterAccessLoss(redacted, contactLost, demographicLost)).toBe(redacted);
  });

  it('preserves a backend-projected partial contact mask', () => {
    const masked = {
      ...createPerson(),
      primary_email: 'u***@example.invalid',
      mobile: '******02',
      privacy: { contact_restricted: true, demographic_restricted: true },
      age_range: 'Restricted',
      gender: 'Restricted',
    } as any;

    expect(redactPersonAfterAccessLoss(masked, true, true)).toBe(masked);
  });

  it('preserves missing contact values while restricting raw values after revocation', () => {
    const missing = { ...createPerson(), primary_email: null, mobile: '', privacy: { contact_restricted: true, demographic_restricted: false } } as any;
    expect(redactPersonAfterAccessLoss(missing, true, false)).toBe(missing);

    const revoked = createPerson();
    const redacted = redactPersonAfterAccessLoss(revoked, true, false);
    expect(redacted.primary_email).toBe('Restricted');
    expect(redacted.mobile).toBe('Restricted');
    expect(redactPersonAfterAccessLoss(redacted, true, false)).toBe(redacted);
  });

  it('fails closed for malformed or insufficient masked contact values', () => {
    const malformed = {
      ...createPerson(),
      primary_email: 'not-an-email',
      mobile: '12',
      privacy: { contact_restricted: true, demographic_restricted: false },
    } as any;

    const redacted = redactPersonAfterAccessLoss(malformed, true, false);
    expect(redacted.primary_email).toBe('Restricted');
    expect(redacted.mobile).toBe('Restricted');
  });

  it('preserves the original person when no capability was lost', () => {
    const person = createPerson();
    expect(redactPersonAfterAccessLoss(person, false, false)).toBe(person);
  });

  it('does not allocate a new overview after demographic redaction stabilizes', () => {
    const person = createPerson();
    const overview = { person, community_account: null } as any;
    const redacted = redactOverviewAfterAccessLoss(overview, false, true);

    expect(redactOverviewAfterAccessLoss(redacted, false, true)).toBe(redacted);
  });

  it('does not repeatedly replace an already restricted community account', () => {
    const person = createPerson();
    const account = { account_email: 'member@example.invalid', setup_email: 'setup@example.invalid' };
    const overview = { person, community_account: account } as any;
    const redacted = redactOverviewAfterAccessLoss(overview, true, true);

    expect(redacted.person.primary_email).toBe('Restricted');
    expect(redacted.person.age_range).toBe('Restricted');
    expect(redacted.community_account.account_email).toBe('Restricted');
    expect(redacted.community_account.setup_email).toBe('Restricted');
    expect(redactOverviewAfterAccessLoss(redacted, true, true)).toBe(redacted);
  });

  it('does not allocate a new overview when contact restriction is already stable', () => {
    const person = createPerson();
    const overview = {
      person,
      community_account: { account_email: 'Restricted', setup_email: 'Restricted' },
    } as any;
    const redacted = redactOverviewAfterAccessLoss(overview, true, false);

    expect(redactOverviewAfterAccessLoss(redacted, true, false)).toBe(redacted);
  });

  it('does not allocate a new overview when no capability was lost', () => {
    const person = createPerson();
    const overview = { person, community_account: null } as any;

    expect(redactOverviewAfterAccessLoss(overview, false, false)).toBe(overview);
  });
});
