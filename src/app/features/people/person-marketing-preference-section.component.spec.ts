import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_CONFIG } from '../../core/http/api-config';
import { MarketingPreference } from '../../core/people/people.types';
import { PersonMarketingPreferenceSectionComponent } from './person-marketing-preference-section.component';

describe('PersonMarketingPreferenceSectionComponent', () => {
  let fixture: ComponentFixture<PersonMarketingPreferenceSectionComponent>;
  let http: HttpTestingController;
  const apiBaseUrl = 'http://localhost:8000/api/v1';

  const preference = (state: MarketingPreference['state'], source: MarketingPreference['source'] = null): MarketingPreference => ({
    channel: 'EMAIL',
    state,
    source,
    recorded_at: source ? '2026-09-10T14:30:00Z' : null,
    recorded_by_id: source ? 7 : null,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonMarketingPreferenceSectionComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonMarketingPreferenceSectionComponent);
    fixture.componentRef.setInput('personId', 30);
    fixture.componentRef.setInput('preference', preference('UNKNOWN'));
    fixture.componentRef.setInput('canEdit', false);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it.each([
    ['UNKNOWN', 'Not recorded', 'neutral'],
    ['OPTED_IN', 'Opted in', 'success'],
    ['OPTED_OUT', 'Opted out', 'warning'],
  ] as const)('labels %s without exposing enum values', (state, label, tone) => {
    fixture.componentRef.setInput('preference', preference(state));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain(label);
    expect(host.querySelector(`[data-tone="${tone}"]`)).not.toBeNull();
    expect(host.textContent).not.toContain(state);
  });

  it('shows source and recorded date metadata', () => {
    fixture.componentRef.setInput('preference', preference('OPTED_IN', 'STAFF_RECORDED'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Staff recorded');
    expect(fixture.nativeElement.textContent).toContain('10 Sep 2026, 14:30');
  });

  it.each([
    ['CRM admin', true],
    ['CRM manager', true],
    ['CRM viewer', false],
  ])('%s edit access is represented by the backend-authorized input', (_role, canEdit) => {
    fixture.componentRef.setInput('canEdit', canEdit);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(canEdit ? 'Change preference' : 'Marketing Preferences');
    expect(fixture.nativeElement.textContent).not.toContain(canEdit ? 'Record an explicit' : 'Change preference');
  });

  it('records opted in using the backend contract and updates the display', () => {
    fixture.componentRef.setInput('canEdit', true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));

    const request = http.expectOne(`${apiBaseUrl}/people/30/marketing-preference/`);
    expect(request.request.body).toEqual({ state: 'OPTED_IN' });
    request.flush({ preference: preference('OPTED_IN', 'STAFF_RECORDED'), changed: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Marketing preference saved.');
  });

  it('records opted out', () => {
    fixture.componentRef.setInput('canEdit', true);
    fixture.componentRef.setInput('preference', preference('OPTED_IN', 'STAFF_RECORDED'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('input[value="OPTED_OUT"]') as HTMLInputElement).click();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));

    const request = http.expectOne(`${apiBaseUrl}/people/30/marketing-preference/`);
    expect(request.request.body).toEqual({ state: 'OPTED_OUT' });
    request.flush({ preference: preference('OPTED_OUT', 'STAFF_RECORDED'), changed: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Marketing preference saved.');
  });

  it('shows a safe message when the preference API fails', () => {
    fixture.componentRef.setInput('canEdit', true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    http.expectOne(`${apiBaseUrl}/people/30/marketing-preference/`).flush(
      { detail: 'Temporary failure' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Marketing preference could not be saved right now. Try again.');
  });
});
