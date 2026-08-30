import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService } from '../../core/auth/auth.service';
import { AuthenticatedUser } from '../../core/auth/auth.types';
import { apiCredentialsInterceptor, csrfHeaderInterceptor } from '../../core/http/auth-http.interceptors';
import { API_CONFIG } from '../../core/http/api-config';
import { PersonDetailPageComponent } from './person-detail-page.component';

const apiBaseUrl = 'http://localhost:8000/api/v1';

const viewerUser: AuthenticatedUser = {
  id: 3,
  email: 'viewer@example.com',
  person: {
    id: 9,
    first_name: 'Viewer',
    last_name: 'User',
    primary_email: 'viewer@example.com',
  },
  staff_roles: ['CRM_VIEWER'],
};

const adminUser: AuthenticatedUser = {
  ...viewerUser,
  id: 1,
  email: 'admin@example.com',
  person: {
    ...viewerUser.person,
    id: 7,
    first_name: 'Admin',
    primary_email: 'admin@example.com',
  },
  staff_roles: ['CRM_ADMIN'],
};

const managerUser: AuthenticatedUser = {
  ...viewerUser,
  id: 2,
  email: 'manager@example.com',
  person: {
    ...viewerUser.person,
    id: 8,
    first_name: 'Manager',
    primary_email: 'manager@example.com',
  },
  staff_roles: ['CRM_MANAGER'],
};

const nonStaffUser: AuthenticatedUser = {
  ...viewerUser,
  id: 4,
  email: 'member@example.com',
  person: {
    ...viewerUser.person,
    id: 10,
    first_name: 'Member',
    primary_email: 'member@example.com',
  },
  staff_roles: [],
};

const contactOverview = {
  person: {
    id: 11,
    first_name: 'Ama',
    last_name: 'Amoah',
    primary_email: 'ama@example.com',
    mobile: '0991000001',
    location: 'Lilongwe',
    age_range: '25-34',
    gender: 'Female',
    archived_at: null,
    created_at: '2026-08-30T09:00:00Z',
    updated_at: '2026-08-30T09:15:00Z',
  },
  relationship: {
    type: 'CONTACT',
    label: 'Contact',
  },
  membership: null,
};

const activeMemberOverview = {
  person: {
    id: 12,
    first_name: 'Kwame',
    last_name: 'Mensah',
    primary_email: 'kwame@example.com',
    mobile: '0991000002',
    location: 'Mzuzu',
    age_range: '',
    gender: '',
    archived_at: null,
    created_at: '2026-08-01T08:00:00Z',
    updated_at: '2026-08-28T10:45:00Z',
  },
  relationship: {
    type: 'ACTIVE_MEMBER',
    label: 'Active Member',
  },
  membership: {
    id: 5,
    status: 'ACTIVE',
    joined_at: '2024-04-12',
    ended_at: null,
    membership_source: 'WEBSITE_FORM',
    created_at: '2026-08-01T08:00:00Z',
    updated_at: '2026-08-28T10:45:00Z',
  },
};

const formerMemberOverview = {
  person: {
    id: 13,
    first_name: 'Esi',
    last_name: 'Former',
    primary_email: null,
    mobile: '',
    location: '',
    age_range: '',
    gender: '',
    archived_at: '2026-08-28T10:30:00Z',
    created_at: '2026-08-01T08:00:00Z',
    updated_at: '2026-08-28T10:45:00Z',
  },
  relationship: {
    type: 'FORMER_MEMBER',
    label: 'Former Member',
  },
  membership: {
    id: 6,
    status: 'FORMER',
    joined_at: '2020-01-15',
    ended_at: '2024-07-15',
    membership_source: 'COMMUNITY_PLATFORM',
    created_at: '2026-08-01T08:00:00Z',
    updated_at: '2026-08-28T10:45:00Z',
  },
};

class MockAuthService {
  readonly authInitialized = signal(true).asReadonly();
  private readonly currentUserState = signal<AuthenticatedUser | null>(viewerUser);
  readonly currentUser = this.currentUserState.asReadonly();

  setCurrentUser(user: AuthenticatedUser | null): void {
    this.currentUserState.set(user);
  }
}

@Component({
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
class DummyShellComponent {}

describe('PersonDetailPageComponent', () => {
  let httpTesting: HttpTestingController;
  let router: Router;
  let auth: MockAuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: DummyShellComponent,
            children: [{ path: 'people/:id', component: PersonDetailPageComponent }],
          },
        ]),
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
        { provide: AuthService, useClass: MockAuthService },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function stabilize(harness: RouterTestingHarness) {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  function formatBusinessDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);

    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  function getLocalTodayDateInputValue(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function membershipForm(host: Element | null): HTMLFormElement | null {
    return host?.querySelector('.membership-form') as HTMLFormElement | null;
  }

  function routeComponent(harness: RouterTestingHarness): PersonDetailPageComponent {
    return harness.fixture.debugElement.query(By.directive(PersonDetailPageComponent)).componentInstance as PersonDetailPageComponent;
  }

  function makeMemberButton(host: Element | null): HTMLButtonElement | undefined {
    return Array.from(host?.querySelectorAll('button') ?? []).find((button) =>
      button.textContent?.includes('Make Member'),
    ) as HTMLButtonElement | undefined;
  }

  function endMembershipButton(host: Element | null): HTMLButtonElement | undefined {
    return Array.from(host?.querySelectorAll('button') ?? []).find((button) =>
      button.textContent?.includes('End Membership'),
    ) as HTMLButtonElement | undefined;
  }

  function cancelButton(host: Element | null): HTMLButtonElement | undefined {
    return Array.from(host?.querySelectorAll('button') ?? []).find((button) =>
      button.textContent?.includes('Cancel'),
    ) as HTMLButtonElement | undefined;
  }

  it('loads a person overview from the route id and renders person fields', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    expect(router.url).toBe('/people/11');
    expect(harness.routeNativeElement?.textContent).toContain('Ama Amoah');
    expect(harness.routeNativeElement?.textContent).toContain('ama@example.com');
    expect(harness.routeNativeElement?.textContent).toContain('0991000001');
    expect(harness.routeNativeElement?.textContent).toContain('Lilongwe');
    expect(harness.routeNativeElement?.textContent).toContain('Contact');
    expect(harness.routeNativeElement?.textContent).toContain('Personal details');
    expect(harness.routeNativeElement?.textContent).toContain('Record information');
    expect(harness.routeNativeElement?.textContent).toContain('Membership');
  });

  it('shows a loading state before the request resolves', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    expect(harness.routeNativeElement?.textContent).toContain('Loading person');
    expect(harness.routeNativeElement?.textContent).toContain('Retrieving the person record.');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);
  });

  it('shows a clean contact state when membership is null', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('No membership record');
    expect(text).not.toContain('Joined');
  });

  it('shows make member for CRM admin contact', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    expect(makeMemberButton(harness.routeNativeElement)?.textContent).toContain('Make Member');
  });

  it('shows make member for CRM manager contact', async () => {
    auth.setCurrentUser(managerUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    expect(makeMemberButton(harness.routeNativeElement)?.textContent).toContain('Make Member');
  });

  it('does not show make member for CRM viewer contact', async () => {
    auth.setCurrentUser(viewerUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    expect(makeMemberButton(harness.routeNativeElement)).toBeUndefined();
  });

  it('does not show make member for authenticated user without write role', async () => {
    auth.setCurrentUser(nonStaffUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    expect(makeMemberButton(harness.routeNativeElement)).toBeUndefined();
  });

  it('renders active membership from the overview response', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Active Member');
    expect(text).toContain('Status');
    expect(text).toContain('Active');
    expect(text).toContain(formatBusinessDate(activeMemberOverview.membership.joined_at));
    expect(text).toContain('Website Form');
    expect(text).not.toContain('/membership/');
    expect(makeMemberButton(harness.routeNativeElement)).toBeUndefined();
    expect(endMembershipButton(harness.routeNativeElement)).toBeUndefined();
  });

  it('renders former membership including the ended date', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/13');

    httpTesting.expectOne(`${apiBaseUrl}/people/13/overview/`).flush(formerMemberOverview);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Former Member');
    expect(text).toContain(formatBusinessDate(formerMemberOverview.membership.joined_at));
    expect(text).toContain(formatBusinessDate(formerMemberOverview.membership.ended_at!));
    expect(text).toContain('Community Platform');
    expect(makeMemberButton(harness.routeNativeElement)).toBeUndefined();
  });

  it('shows consistent fallback text for missing optional person values', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/13');

    httpTesting.expectOne(`${apiBaseUrl}/people/13/overview/`).flush(formerMemberOverview);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Not provided');
  });

  it('displays archived state for archived people', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/13');

    httpTesting.expectOne(`${apiBaseUrl}/people/13/overview/`).flush(formerMemberOverview);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Archived');
    expect(text).toContain('Archived on');
    expect(makeMemberButton(harness.routeNativeElement)).toBeUndefined();
    expect(endMembershipButton(harness.routeNativeElement)).toBeUndefined();
  });

  it('shows end membership for CRM admin active member', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    expect(endMembershipButton(harness.routeNativeElement)?.textContent).toContain('End Membership');
  });

  it('shows end membership for CRM manager active member', async () => {
    auth.setCurrentUser(managerUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    expect(endMembershipButton(harness.routeNativeElement)?.textContent).toContain('End Membership');
  });

  it('does not show end membership for CRM viewer active member', async () => {
    auth.setCurrentUser(viewerUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    expect(endMembershipButton(harness.routeNativeElement)).toBeUndefined();
  });

  it('does not show end membership for contact', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    expect(endMembershipButton(harness.routeNativeElement)).toBeUndefined();
  });

  it('does not show end membership for former member', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/13');

    httpTesting.expectOne(`${apiBaseUrl}/people/13/overview/`).flush(formerMemberOverview);
    await stabilize(harness);

    expect(endMembershipButton(harness.routeNativeElement)).toBeUndefined();
  });

  it('opens the make member form with local today and STAFF defaults', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    makeMemberButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    const form = membershipForm(harness.routeNativeElement);
    const joinedInput = form?.querySelector('input[type="date"]') as HTMLInputElement;

    expect(joinedInput.value).toBe(getLocalTodayDateInputValue());
    expect(form?.textContent).toContain('Join date');
    expect(form?.querySelector('select')).toBeNull();
  });

  it('cancel closes the make member form', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    makeMemberButton(harness.routeNativeElement)?.click();
    await stabilize(harness);
    cancelButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    expect(membershipForm(harness.routeNativeElement)).toBeNull();
    expect(makeMemberButton(harness.routeNativeElement)?.textContent).toContain('Make Member');
  });

  it('opens the end membership form with local today and confirmation copy', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    const form = membershipForm(harness.routeNativeElement);
    const endedInput = form?.querySelector('input[type="date"]') as HTMLInputElement;

    expect(endedInput.value).toBe(getLocalTodayDateInputValue());
    expect(endedInput.min).toBe(activeMemberOverview.membership.joined_at);
    expect(form?.textContent).toContain('End date');
    expect(form?.textContent).toContain('This person will become a Former Member.');
  });

  it('cancel closes the end membership form', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);
    cancelButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    expect(membershipForm(harness.routeNativeElement)).toBeNull();
    expect(endMembershipButton(harness.routeNativeElement)?.textContent).toContain('End Membership');
  });

  it('required fields prevent invalid submission', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    makeMemberButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    const form = membershipForm(harness.routeNativeElement);
    const joinedInput = form?.querySelector('input[type="date"]') as HTMLInputElement;
    joinedInput.value = '';
    joinedInput.dispatchEvent(new Event('input'));
    joinedInput.dispatchEvent(new Event('change'));

    form?.dispatchEvent(new Event('submit'));
    await stabilize(harness);

    httpTesting.expectNone(`${apiBaseUrl}/people/11/membership/`);
    expect(harness.routeNativeElement?.textContent).toContain('Join date is required.');
  });

  it('required end date prevents invalid submission', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    const form = membershipForm(harness.routeNativeElement);
    const component = routeComponent(harness);
    component.endMembershipForm.controls.ended_at.setValue('');

    component.submitEndMembership();
    await stabilize(harness);

    httpTesting.expectNone(`${apiBaseUrl}/people/12/membership/end/`);
    expect(harness.routeNativeElement?.textContent).toContain('End date is required.');
  });

  it('prevents end membership submission before joined date', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    const form = membershipForm(harness.routeNativeElement);
    const component = routeComponent(harness);
    component.endMembershipForm.controls.ended_at.setValue('2024-04-11');

    component.submitEndMembership();
    await stabilize(harness);

    httpTesting.expectNone(`${apiBaseUrl}/people/12/membership/end/`);
    expect(harness.routeNativeElement?.textContent).toContain('End date cannot be before the membership join date.');
  });

  it('submits the selected join date with STAFF then reloads overview', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    makeMemberButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    const form = membershipForm(harness.routeNativeElement);
    const joinedInput = form?.querySelector('input[type="date"]') as HTMLInputElement;
    joinedInput.value = '2024-04-12';
    joinedInput.dispatchEvent(new Event('input'));
    joinedInput.dispatchEvent(new Event('change'));

    form?.dispatchEvent(new Event('submit'));

    const createRequest = httpTesting.expectOne(`${apiBaseUrl}/people/11/membership/`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({
      joined_at: '2024-04-12',
      membership_source: 'STAFF',
    });

    createRequest.flush(
      {
        id: 15,
        status: 'ACTIVE',
        joined_at: '2024-04-12',
        ended_at: null,
        membership_source: 'STAFF',
        created_at: '2026-08-30T12:00:00Z',
        updated_at: '2026-08-30T12:00:00Z',
      },
      { status: 201, statusText: 'Created' },
    );

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush({
      ...contactOverview,
      relationship: {
        type: 'ACTIVE_MEMBER',
        label: 'Active Member',
      },
      membership: {
        id: 15,
        status: 'ACTIVE',
        joined_at: '2024-04-12',
        ended_at: null,
        membership_source: 'STAFF',
        created_at: '2026-08-30T12:00:00Z',
        updated_at: '2026-08-30T12:00:00Z',
      },
    });
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Active Member');
    expect(text).toContain('Staff');
    expect(text).not.toContain('No membership record');
    expect(makeMemberButton(harness.routeNativeElement)).toBeUndefined();
    expect(membershipForm(harness.routeNativeElement)).toBeNull();
  });

  it('prevents duplicate submissions while make member is pending', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    makeMemberButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    const form = membershipForm(harness.routeNativeElement);
    form?.dispatchEvent(new Event('submit'));
    form?.dispatchEvent(new Event('submit'));

    const requests = httpTesting.match(`${apiBaseUrl}/people/11/membership/`);
    expect(requests.length).toBe(1);

    requests[0].flush({}, { status: 409, statusText: 'Conflict' });
    await stabilize(harness);
  });

  it('submits end membership then reloads the overview', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    const form = membershipForm(harness.routeNativeElement);
    const endedInput = form?.querySelector('input[type="date"]') as HTMLInputElement;
    endedInput.value = '2026-08-30';
    endedInput.dispatchEvent(new Event('input'));
    endedInput.dispatchEvent(new Event('change'));

    form?.dispatchEvent(new Event('submit'));

    const endRequest = httpTesting.expectOne(`${apiBaseUrl}/people/12/membership/end/`);
    expect(endRequest.request.method).toBe('POST');
    expect(endRequest.request.body).toEqual({
      ended_at: '2026-08-30',
    });

    endRequest.flush(
      {
        id: 5,
        status: 'FORMER',
        joined_at: '2024-04-12',
        ended_at: '2026-08-30',
        membership_source: 'WEBSITE_FORM',
        created_at: '2026-08-01T08:00:00Z',
        updated_at: '2026-08-30T12:00:00Z',
      },
      { status: 200, statusText: 'OK' },
    );

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush({
      ...activeMemberOverview,
      relationship: {
        type: 'FORMER_MEMBER',
        label: 'Former Member',
      },
      membership: {
        ...activeMemberOverview.membership,
        status: 'FORMER',
        ended_at: '2026-08-30',
        updated_at: '2026-08-30T12:00:00Z',
      },
    });
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Former Member');
    expect(text).toContain('Former');
    expect(text).toContain(formatBusinessDate('2026-08-30'));
    expect(endMembershipButton(harness.routeNativeElement)).toBeUndefined();
    expect(membershipForm(harness.routeNativeElement)).toBeNull();
  });

  it('prevents duplicate submissions while end membership is pending', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    const form = membershipForm(harness.routeNativeElement);
    form?.dispatchEvent(new Event('submit'));
    form?.dispatchEvent(new Event('submit'));

    const requests = httpTesting.match(`${apiBaseUrl}/people/12/membership/end/`);
    expect(requests.length).toBe(1);

    requests[0].flush({ detail: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    await stabilize(harness);
  });

  it('shows inline validation details for 400 make member errors', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    makeMemberButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    membershipForm(harness.routeNativeElement)?.dispatchEvent(new Event('submit'));

    httpTesting.expectOne(`${apiBaseUrl}/people/11/membership/`).flush(
      {
        joined_at: ['Enter a valid date.'],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Join date: Enter a valid date.');
    expect(text).toContain('Ama Amoah');
  });

  it('shows an inline permission message for 403 make member errors', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    makeMemberButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    membershipForm(harness.routeNativeElement)?.dispatchEvent(new Event('submit'));

    httpTesting.expectOne(`${apiBaseUrl}/people/11/membership/`).flush(
      { detail: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    await stabilize(harness);

    expect(harness.routeNativeElement?.textContent).toContain('You no longer have permission to make this person a member.');
  });

  it('shows an inline conflict message for 409 make member errors', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    makeMemberButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    membershipForm(harness.routeNativeElement)?.dispatchEvent(new Event('submit'));

    httpTesting.expectOne(`${apiBaseUrl}/people/11/membership/`).flush(
      { detail: 'Conflict' },
      { status: 409, statusText: 'Conflict' },
    );
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('This membership could not be created because the person is no longer eligible for Make Member.');
    expect(text).toContain('No membership record');
  });

  it('shows a generic inline message for unexpected make member failures', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    makeMemberButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    membershipForm(harness.routeNativeElement)?.dispatchEvent(new Event('submit'));

    httpTesting.expectOne(`${apiBaseUrl}/people/11/membership/`).flush(
      { detail: 'Server error' },
      { status: 500, statusText: 'Server Error' },
    );
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Membership could not be created right now. Try again.');
    expect(text).toContain('Ama Amoah');
  });

  it('shows inline validation details for 400 end membership errors', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    membershipForm(harness.routeNativeElement)?.dispatchEvent(new Event('submit'));

    httpTesting.expectOne(`${apiBaseUrl}/people/12/membership/end/`).flush(
      {
        ended_at: ['End date cannot be before joined date.'],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('End date: End date cannot be before joined date.');
    expect(text).toContain('Kwame Mensah');
  });

  it('shows an inline permission message for 403 end membership errors', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    membershipForm(harness.routeNativeElement)?.dispatchEvent(new Event('submit'));

    httpTesting.expectOne(`${apiBaseUrl}/people/12/membership/end/`).flush(
      { detail: 'Forbidden' },
      { status: 403, statusText: 'Forbidden' },
    );
    await stabilize(harness);

    expect(harness.routeNativeElement?.textContent).toContain('You no longer have permission to end this membership.');
  });

  it('shows an inline conflict message for 409 end membership errors', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    membershipForm(harness.routeNativeElement)?.dispatchEvent(new Event('submit'));

    httpTesting.expectOne(`${apiBaseUrl}/people/12/membership/end/`).flush(
      { detail: 'Conflict' },
      { status: 409, statusText: 'Conflict' },
    );
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('This membership can no longer be ended from the current person state.');
    expect(text).toContain('Kwame Mensah');
  });

  it('shows a generic inline message for unexpected end membership failures', async () => {
    auth.setCurrentUser(adminUser);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    endMembershipButton(harness.routeNativeElement)?.click();
    await stabilize(harness);

    membershipForm(harness.routeNativeElement)?.dispatchEvent(new Event('submit'));

    httpTesting.expectOne(`${apiBaseUrl}/people/12/membership/end/`).flush(
      { detail: 'Server error' },
      { status: 500, statusText: 'Server Error' },
    );
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Membership could not be ended right now. Try again.');
    expect(text).toContain('Kwame Mensah');
  });

  it('renders record dates in a human-readable format', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain(formatDateTime(contactOverview.person.created_at));
    expect(text).toContain(formatDateTime(contactOverview.person.updated_at));
  });

  it('shows a clean not-found state for missing or non-visible records', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/404');

    httpTesting.expectOne(`${apiBaseUrl}/people/404/overview/`).flush({}, { status: 404, statusText: 'Not Found' });
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Person not found');
    expect(text).toContain('Return to People');
  });

  it('shows a restrained generic error state for non-404 API failures', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush({}, { status: 500, statusText: 'Server Error' });
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Person could not be loaded');
    expect(text).toContain('The person record could not be loaded right now.');
  });

  it('provides a back-to-people navigation link', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);

    const link = Array.from(harness.routeNativeElement?.querySelectorAll('a') ?? []).find((anchor) =>
      anchor.textContent?.includes('Back to People'),
    ) as HTMLAnchorElement | undefined;
    expect(link?.textContent).toContain('Back to People');
  });

  it('reloads the overview when the route id changes', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/11');

    httpTesting.expectOne(`${apiBaseUrl}/people/11/overview/`).flush(contactOverview);
    await stabilize(harness);
    expect(harness.routeNativeElement?.textContent).toContain('Ama Amoah');

    await harness.navigateByUrl('/people/12');
    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(router.url).toBe('/people/12');
    expect(text).toContain('Kwame Mensah');
    expect(text).toContain('Active Member');
  });

  it('does not issue a separate membership request', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/people/12');

    httpTesting.expectOne(`${apiBaseUrl}/people/12/overview/`).flush(activeMemberOverview);
    await stabilize(harness);

    httpTesting.expectNone(`${apiBaseUrl}/people/12/`);
    httpTesting.expectNone(`${apiBaseUrl}/people/12/membership/`);
  });
});
