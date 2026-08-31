import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiCredentialsInterceptor, csrfHeaderInterceptor } from '../../core/http/auth-http.interceptors';
import { API_CONFIG } from '../../core/http/api-config';
import { PersonAuditHistorySectionComponent } from './person-audit-history-section.component';

const apiBaseUrl = 'http://localhost:8000/api/v1';

describe('PersonAuditHistorySectionComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonAuditHistorySectionComponent],
      providers: [
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(PersonAuditHistorySectionComponent);
    fixture.componentRef.setInput('personId', 12);
    fixture.detectChanges();
    return fixture;
  }

  it('loads audit history on first render without a page query parameter', () => {
    const fixture = createComponent();

    const request = httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          action: 'TAG_ASSIGNED',
          description: 'Tag assigned',
          actor: { id: 1, email: 'admin@example.com' },
          occurred_at: '2026-08-31T18:35:00Z',
          entity_type: 'PersonTag',
          changes: {},
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Audit History');
    expect(fixture.nativeElement.textContent).toContain('Tag assigned');
  });

  it('renders backend description, actor email, and a date-time timestamp', () => {
    const fixture = createComponent();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 2,
          action: 'PROFESSIONAL_PROFILE_UPDATED',
          description: 'Professional profile updated',
          actor: { id: 2, email: 'manager@example.com' },
          occurred_at: '2026-08-31T18:42:00Z',
          entity_type: 'ProfessionalProfile',
          changes: {},
        },
      ],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Professional profile updated');
    expect(text).toContain('manager@example.com');
    expect(text).toMatch(/31 Aug 2026/);
    expect(text).toMatch(/\d{2}:\d{2}/);
  });

  it('renders System when actor is null', () => {
    const fixture = createComponent();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 3,
          action: 'MEMBERSHIP_CREATED',
          description: 'Membership created',
          actor: null,
          occurred_at: '2026-08-31T17:00:00Z',
          entity_type: 'Membership',
          changes: {},
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('System');
  });

  it('renders the empty state when no visible audit events are returned', () => {
    const fixture = createComponent();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({
      count: 0,
      next: null,
      previous: null,
      results: [],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No audit history recorded.');
  });

  it('renders a safe error state and retries the current page', () => {
    const fixture = createComponent();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("We couldn't load audit history.");

    const retryButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button: HTMLButtonElement) =>
      button.textContent?.trim() === 'Retry',
    ) as HTMLButtonElement | undefined;

    retryButton?.click();
    fixture.detectChanges();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 4,
          action: 'SKILL_ASSIGNED',
          description: 'Skill assigned',
          actor: { id: 1, email: 'admin@example.com' },
          occurred_at: '2026-08-31T16:20:00Z',
          entity_type: 'PersonSkill',
          changes: {},
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Skill assigned');
  });

  it('renders safe change rows for strings, booleans, nulls, numbers, and readable field labels', () => {
    const fixture = createComponent();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 5,
          action: 'PROFESSIONAL_PROFILE_UPDATED',
          description: 'Professional profile updated',
          actor: { id: 1, email: 'admin@example.com' },
          occurred_at: '2026-08-31T18:42:00Z',
          entity_type: 'ProfessionalProfile',
          changes: {
            job_title: { from: 'Software Engineer', to: 'Senior Software Engineer' },
            is_active: { from: false, to: true },
            industry_id: { from: null, to: 25 },
          },
        },
      ],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Job title');
    expect(text).toContain('Software Engineer');
    expect(text).toContain('Senior Software Engineer');
    expect(text).toContain('Is active');
    expect(text).toContain('No');
    expect(text).toContain('Yes');
    expect(text).toContain('Industry id');
    expect(text).toContain('None');
    expect(text).toContain('25');
  });

  it('omits empty or unexpected nested changes without rendering raw json', () => {
    const fixture = createComponent();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 6,
          action: 'NOTE_UPDATED',
          description: 'Internal note updated',
          actor: { id: 1, email: 'admin@example.com' },
          occurred_at: '2026-08-31T18:50:00Z',
          entity_type: 'InternalNote',
          changes: {
            body: { changed: true },
            nested: { from: { unsafe: 'x' }, to: { unsafe: 'y' } },
          },
        },
      ],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Internal note updated');
    expect(text).not.toContain('body');
    expect(text).not.toContain('unsafe');
    expect(text).not.toContain('[object Object]');
    expect(fixture.nativeElement.querySelector('.audit-changes')).toBeNull();
  });

  it('uses backend-driven previous and next availability when paginating', () => {
    const fixture = createComponent();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({
      count: 30,
      next: `${apiBaseUrl}/people/12/audit-history/?page=2`,
      previous: null,
      results: [
        {
          id: 7,
          action: 'TAG_ASSIGNED',
          description: 'Tag assigned',
          actor: { id: 1, email: 'admin@example.com' },
          occurred_at: '2026-08-31T18:35:00Z',
          entity_type: 'PersonTag',
          changes: {},
        },
      ],
    });
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.audit-pagination button')) as HTMLButtonElement[];
    const previousButton = buttons.find((button) => button.textContent?.trim() === 'Previous');
    const nextButton = buttons.find((button) => button.textContent?.trim() === 'Next');

    expect(previousButton?.disabled).toBe(true);
    expect(nextButton?.disabled).toBe(false);

    nextButton?.click();
    fixture.detectChanges();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/?page=2`).flush({
      count: 30,
      next: null,
      previous: `${apiBaseUrl}/people/12/audit-history/`,
      results: [
        {
          id: 8,
          action: 'MEMBERSHIP_ENDED',
          description: 'Membership ended',
          actor: null,
          occurred_at: '2026-08-30T17:35:00Z',
          entity_type: 'Membership',
          changes: {},
        },
      ],
    });
    fixture.detectChanges();

    const updatedButtons = Array.from(fixture.nativeElement.querySelectorAll('.audit-pagination button')) as HTMLButtonElement[];
    const previousAfterNext = updatedButtons.find((button) => button.textContent?.trim() === 'Previous');
    const nextAfterNext = updatedButtons.find((button) => button.textContent?.trim() === 'Next');

    expect(previousAfterNext?.disabled).toBe(false);
    expect(nextAfterNext?.disabled).toBe(true);

    previousAfterNext?.click();
    fixture.detectChanges();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({
      count: 30,
      next: `${apiBaseUrl}/people/12/audit-history/?page=2`,
      previous: null,
      results: [
        {
          id: 7,
          action: 'TAG_ASSIGNED',
          description: 'Tag assigned',
          actor: { id: 1, email: 'admin@example.com' },
          occurred_at: '2026-08-31T18:35:00Z',
          entity_type: 'PersonTag',
          changes: {},
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tag assigned');
  });

  it('does not render mutation controls or trigger note requests for audit history rows', () => {
    const fixture = createComponent();

    httpTesting.expectOne(`${apiBaseUrl}/people/12/audit-history/`).flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 9,
          action: 'NOTE_UPDATED',
          description: 'Internal note updated',
          actor: { id: 2, email: 'manager@example.com' },
          occurred_at: '2026-08-31T18:45:00Z',
          entity_type: 'InternalNote',
          changes: {},
        },
      ],
    });
    fixture.detectChanges();

    httpTesting.expectNone((candidate) => candidate.url.includes('/notes/'));

    const buttonLabels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((button: HTMLButtonElement) =>
      button.textContent?.trim(),
    );

    expect(buttonLabels).not.toContain('Edit');
    expect(buttonLabels).not.toContain('Delete');
    expect(buttonLabels).not.toContain('Archive');
    expect(buttonLabels).not.toContain('Restore');
  });
});
