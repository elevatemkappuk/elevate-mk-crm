import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../../core/http/api-config';
import { PersonBrevoIntegrationSectionComponent } from './person-brevo-integration-section.component';

describe('PersonBrevoIntegrationSectionComponent', () => {
  let fixture: ComponentFixture<PersonBrevoIntegrationSectionComponent>;
  let http: HttpTestingController;
  const base = 'http://localhost:8000/api/v1';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonBrevoIntegrationSectionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_CONFIG, useValue: { apiBaseUrl: base } }],
    }).compileComponents();
    fixture = TestBed.createComponent(PersonBrevoIntegrationSectionComponent);
    fixture.componentRef.setInput('personId', 30);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const response = (status: string, canReconcile = false) => ({
    provider: 'BREVO',
    marketing_preference: { channel: 'EMAIL', state: 'OPTED_IN', source: 'STAFF_RECORDED', recorded_at: null, recorded_by_id: null },
    integration: { status, reason_code: status, title: 'Safe title', explanation: 'Safe explanation', can_reconcile: canReconcile },
  });

  it.each([
    ['CONNECTED', 'Connected'], ['RESTRICTED', 'Marketing restricted in Brevo'],
    ['CONTACT_MISSING', 'Brevo contact no longer exists'], ['IDENTITY_CONFLICT', 'Brevo contact identity needs review'],
    ['NOT_CONNECTED', 'Not connected to Brevo'], ['UNKNOWN', 'Brevo status unavailable'],
  ])('renders the human-readable %s status', (status, label) => {
    http.expectOne(`${base}/people/30/brevo-integration/`).flush(response(status));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(label);
    expect(fixture.nativeElement.textContent).not.toContain(status);
  });

  it('shows restrictive guidance without mutation controls', () => {
    http.expectOne(`${base}/people/30/brevo-integration/`).flush({
      ...response('RESTRICTED'),
      integration: { status: 'RESTRICTED', reason_code: 'BREVO_CONTACT_RESTRICTED', title: 'Marketing restricted in Brevo', explanation: 'Brevo currently prevents marketing email for this contact.', can_reconcile: false },
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('will not automatically unblock or resubscribe');
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
    expect(text).not.toContain('Reconcile');
  });

  it.each([
    ['BREVO_CRM_EMAIL_MISSING', 'CRM email required', "Review the person's CRM email before attempting further Brevo reconciliation."],
    ['BREVO_EMAIL_IDENTITY_MISMATCH', 'CRM and Brevo email identities differ', "Verify the person's current email and the linked Brevo contact before making any identity changes."],
    ['BREVO_CONTACT_LINKED_TO_OTHER_PERSON', 'Brevo contact is linked elsewhere', 'Escalate this record for administrative review.'],
    ['BREVO_CONTACT_IDENTITY_CONFLICT', 'Brevo contact identity needs review', 'Escalate this record for administrative review.'],
  ])('renders actionable identity guidance for %s without identities or repair controls', (reasonCode, title, nextStep) => {
    http.expectOne(`${base}/people/30/brevo-integration/`).flush({
      ...response('IDENTITY_CONFLICT'),
      integration: { status: 'IDENTITY_CONFLICT', reason_code: reasonCode, title, explanation: title === 'CRM and Brevo email identities differ' ? "The Brevo contact linked to this person uses a different email identity from the person's current CRM email." : 'Safe identity explanation.', can_reconcile: false },
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain(title);
    expect(text).toContain(nextStep);
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
    expect(text).not.toContain('example.com');
    expect(text).not.toContain('42');
    expect(text).not.toContain('Reconcile');
  });

  it('shows administrator missing-contact guidance but no reconciliation button', () => {
    http.expectOne(`${base}/people/30/brevo-integration/`).flush(response('CONTACT_MISSING', true));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('An administrator can reconcile this Brevo connection.');
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('does not show administrator guidance for a non-admin missing contact', () => {
    http.expectOne(`${base}/people/30/brevo-integration/`).flush(response('CONTACT_MISSING', false));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('An administrator can reconcile');
  });

  it('keeps the section usable when inspection fails', () => {
    http.expectOne(`${base}/people/30/brevo-integration/`).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('current Brevo integration status could not be checked');
  });
});
