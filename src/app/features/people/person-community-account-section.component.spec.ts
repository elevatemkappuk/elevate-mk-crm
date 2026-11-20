import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommunityAccount } from '../../core/people/people.types';
import { PersonCommunityAccountSectionComponent } from './person-community-account-section.component';

describe('PersonCommunityAccountSectionComponent', () => {
  let fixture: ComponentFixture<PersonCommunityAccountSectionComponent>;

  const account = (overrides: Partial<CommunityAccount> = {}): CommunityAccount => ({
    status: 'ACTIVE',
    account_email: 'member@example.com',
    setup_email: null,
    account_created_at: '2026-09-30T10:00:00Z',
    last_login_at: '2026-09-30T21:47:00Z',
    invitation_sent_at: null,
    invitation_expires_at: null,
    invitation_delivery_status: null,
    ...overrides,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PersonCommunityAccountSectionComponent] }).compileComponents();
    fixture = TestBed.createComponent(PersonCommunityAccountSectionComponent);
  });

  function render(value: CommunityAccount): HTMLElement {
    fixture.componentRef.setInput('account', value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders active account metadata and badge', () => {
    const host = render(account());
    expect(host.textContent).toContain('Community account');
    expect(host.textContent).toContain('Active');
    expect(host.textContent).toContain('member@example.com');
    expect(host.textContent).toContain('Account created');
    expect(host.textContent).toContain('Last sign in');
    expect(host.querySelector('[data-tone="success"]')).not.toBeNull();
  });

  it('renders pending delivery states without exposing technical fields', () => {
    const host = render(account({
      status: 'SETUP_PENDING', account_email: null, setup_email: 'setup@example.com', account_created_at: null,
      last_login_at: null, invitation_sent_at: null, invitation_expires_at: '2026-10-03T20:00:00Z', invitation_delivery_status: 'DELIVERY_UNCERTAIN',
    }));
    expect(host.textContent).toContain('Setup pending');
    expect(host.textContent).toContain('Setup email');
    expect(host.textContent).toContain('Delivery uncertain');
    expect(host.textContent).toContain('Invitation expires');
    expect(host.textContent).not.toContain('token');
    expect(host.textContent).not.toContain('profile');
    expect(host.querySelector('button')).toBeNull();
  });

  it('renders not-set-up without an account email or invitation details', () => {
    const host = render(account({ status: 'NOT_SET_UP', account_email: null, account_created_at: null, last_login_at: null }));
    expect(host.textContent).toContain('Not set up');
    expect(host.textContent).not.toContain('Account email');
    expect(host.textContent).not.toContain('Setup email');
    expect(host.textContent).not.toContain('Invitation');
  });

  it('renders access unavailable account metadata', () => {
    const host = render(account({ status: 'ACCESS_UNAVAILABLE' }));
    expect(host.textContent).toContain('Access unavailable');
    expect(host.textContent).toContain('Account email');
    expect(host.querySelector('[data-tone="error"]')).not.toBeNull();
  });
});
