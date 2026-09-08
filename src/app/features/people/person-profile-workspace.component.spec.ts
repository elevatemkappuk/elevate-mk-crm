import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { PeopleService } from '../../core/people/people.service';
import { PersonListItem, PersonOverview } from '../../core/people/people.types';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';
import { PersonDetailPageComponent } from './person-detail-page.component';
import { PersonWritePageComponent } from './person-write-page.component';

const overview: PersonOverview = {
  person: { id: 11, first_name: 'Ama', last_name: 'Amoah', primary_email: 'ama@example.com',
    mobile: '077000001', location: 'Milton Keynes', age_range: '', gender: '', archived_at: null,
    created_at: '2026-09-01T12:00:00Z', updated_at: '2026-09-01T12:00:00Z' },
  relationship: { type: 'CONTACT', label: 'Contact' }, membership: null, skills: [], interests: [], tags: [],
  professional_profile: { id: 5, job_title: 'Designer', company: 'Example', industry: null, career_stage: '',
    linkedin_url: '', created_at: '2026-09-01T12:00:00Z', updated_at: '2026-09-01T12:00:00Z' },
};
const empty = { count: 0, next: null, previous: null, results: [] };

describe('Person profile workspace', () => {
  const currentUser = signal({ staff_roles: ['CRM_MANAGER'] });
  let service: {
    getPersonOverview: ReturnType<typeof vi.fn>; getPersonNotes: ReturnType<typeof vi.fn>;
    getPersonAuditHistory: ReturnType<typeof vi.fn>; getIndustries: ReturnType<typeof vi.fn>;
    updatePerson: ReturnType<typeof vi.fn>; updateProfessionalProfile: ReturnType<typeof vi.fn>;
    archivePerson: ReturnType<typeof vi.fn>; restorePerson: ReturnType<typeof vi.fn>;
  };
  let update: Subject<PersonListItem>;
  let harness: RouterTestingHarness;
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

  beforeEach(async () => {
    currentUser.set({ staff_roles: ['CRM_MANAGER'] });
    // The browser owns focus containment/inertness for showModal; jsdom needs this shim.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.open = true; }) });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
    update = new Subject<PersonListItem>();
    service = {
      getPersonOverview: vi.fn(() => of(overview)), getPersonNotes: vi.fn(() => of(empty)),
      getPersonAuditHistory: vi.fn(() => of(empty)), getIndustries: vi.fn(() => of([])),
      updatePerson: vi.fn(() => update), updateProfessionalProfile: vi.fn(() => of(overview.professional_profile)),
      archivePerson: vi.fn(() => of(undefined)), restorePerson: vi.fn(() => of(undefined)),
    };
    await TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'people/:id', component: PersonDetailPageComponent }]),
        { provide: AuthService, useValue: { currentUser } }, { provide: PeopleService, useValue: service }],
    }).compileComponents();
  });
  afterEach(() => {
    harness?.fixture.destroy();
    for (const [key, descriptor] of [['showModal', showModal], ['close', close]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
    }
  });
  async function render(url = '/people/11') {
    harness = await RouterTestingHarness.create(url);
    await settle();
    return harness.routeNativeElement!;
  }
  async function settle() {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  function writer() {
    return harness.fixture.debugElement.query(By.directive(PersonWritePageComponent)).componentInstance as PersonWritePageComponent;
  }

  it('defaults to Overview and preserves fragment navigation without reloading the Person', async () => {
    const host = await render();
    expect(host.querySelector('.identity-copy h1')?.textContent).toBe('Ama Amoah');
    expect(host.querySelector('.avatar')?.textContent).toBe('AA');
    expect(host.querySelector('.identity-meta')?.textContent).toContain('Designer');
    expect(host.querySelector('[aria-label="Overview"]')?.hasAttribute('hidden')).toBe(false);
    expect(host.querySelector('[aria-label="History"]')?.hasAttribute('hidden')).toBe(true);
    expect(host.querySelector('.detail-grid .record-metadata')).toBeNull();
    expect(Array.from(host.querySelectorAll('.profile-nav a'), a => a.textContent?.trim())).toEqual(['Overview', 'Membership', 'Notes', 'History']);
    await TestBed.inject(Router).navigateByUrl('/people/11#membership');
    await settle();
    expect(host.querySelector('[aria-label="Membership"]')?.hasAttribute('hidden')).toBe(false);
    expect(host.querySelector('[aria-label="Overview"]')?.hasAttribute('hidden')).toBe(true);
    await TestBed.inject(Router).navigateByUrl('/people/11#overview');
    await settle();
    expect(host.querySelector('.profile-nav [aria-current]')?.textContent).toBe('Overview');
    expect(service.getPersonOverview).toHaveBeenCalledOnce();
  });

  it.each(['CRM_ADMIN', 'CRM_MANAGER', 'CRM_VIEWER'])('preserves %s Notes and management permissions', async role => {
    currentUser.set({ staff_roles: [role] });
    const host = await render('/people/11#notes');
    const manage = role !== 'CRM_VIEWER';
    expect(!!host.querySelector('.edit-person')).toBe(manage);
    expect(!!host.querySelector('app-person-lifecycle-actions')).toBe(manage);
    expect(!!host.querySelector('app-person-notes-section')).toBe(manage);
    expect(service.getPersonNotes).toHaveBeenCalledTimes(manage ? 1 : 0);
    expect(!!host.querySelector('app-person-audit-history-section')).toBe(true);
    expect(host.querySelector('.profile-nav [aria-current]')?.textContent).toBe(manage ? 'Notes' : 'Overview');
  });

  it('uses the shared drawer, closes on safe Escape, and restores Edit person focus', async () => {
    const host = await render();
    const trigger = host.querySelector('.edit-person') as HTMLButtonElement;
    trigger.focus(); trigger.click(); await settle();
    const dialog = host.querySelector('dialog')!;
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(dialog.querySelector('h2'));
    expect(harness.fixture.debugElement.query(By.directive(CrmDrawerComponent))).not.toBeNull();
    expect(writer().mode()).toBe('edit');
    expect(writer().hasUnsavedEdits()).toBe(false);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    expect(host.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('updates the displayed Person on save without navigating away or submitting Membership data', async () => {
    const host = await render('/people/11#overview');
    (host.querySelector('[aria-label="Edit personal details"]') as HTMLElement).click(); await settle();
    writer().personForm()!.form.controls.first_name.setValue('Amara');
    writer().personForm()!.submit(); await settle();
    expect(service.updatePerson).toHaveBeenCalledExactlyOnceWith(11, {
      first_name: 'Amara', last_name: 'Amoah', primary_email: 'ama@example.com', mobile: '077000001',
      location: 'Milton Keynes', age_range: '', gender: '',
    });
    host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    expect(host.querySelector('dialog')).not.toBeNull();
    update.next({ ...overview.person, first_name: 'Amara' }); update.complete();
    await settle();
    expect(host.querySelector('dialog')).toBeNull();
    expect(host.querySelector('h1')?.textContent).toBe('Amara Amoah');
    expect(TestBed.inject(Router).url).toBe('/people/11#overview');
  });

  it('retains Person edits and safe API errors in the drawer', async () => {
    service.updatePerson.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: {} })));
    const host = await render();
    (host.querySelector('.edit-person') as HTMLElement).click(); await settle();
    writer().personForm()!.form.controls.first_name.setValue('Amara');
    writer().personForm()!.submit(); await settle();
    expect(host.querySelector('dialog .error')?.textContent).toContain('Person details need to be corrected');
    expect(writer().personForm()!.form.controls.first_name.value).toBe('Amara');
    expect(host.querySelector('h1')?.textContent).toBe('Ama Amoah');
  });

  it('moves Professional Profile editing into the shared drawer and refreshes its card after saving', async () => {
    const host = await render();
    const trigger = host.querySelector('[aria-label="Edit professional profile"]') as HTMLButtonElement;
    trigger.focus(); trigger.click(); await settle();
    expect(host.querySelector('.detail-grid .professional-profile-form')).toBeNull();
    expect(host.querySelector('dialog .professional-profile-form')).not.toBeNull();
    const component = harness.fixture.debugElement.query(By.directive(PersonDetailPageComponent)).componentInstance as PersonDetailPageComponent;
    component.professionalProfileForm.controls.job_title.setValue('Senior Designer');
    service.getPersonOverview.mockReturnValue(of({ ...overview, professional_profile: { ...overview.professional_profile!, job_title: 'Senior Designer' } }));
    component.submitProfessionalProfile(); await settle();
    expect(service.updateProfessionalProfile).toHaveBeenCalledWith(11, expect.objectContaining({ job_title: 'Senior Designer' }));
    expect(host.querySelector('dialog')).toBeNull();
    expect(host.querySelector('.identity-meta')?.textContent).toContain('Senior Designer');
    expect(document.activeElement).toBe(trigger);
  });

  it('retains Professional Profile API errors inside its drawer', async () => {
    service.updateProfessionalProfile.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { linkedin_url: ['Enter a valid URL.'] } })));
    const host = await render();
    (host.querySelector('[aria-label="Edit professional profile"]') as HTMLElement).click(); await settle();
    const component = harness.fixture.debugElement.query(By.directive(PersonDetailPageComponent)).componentInstance as PersonDetailPageComponent;
    component.submitProfessionalProfile(); await settle();
    expect(host.querySelector('dialog .form-error')?.textContent).toContain('LinkedIn URL: Enter a valid URL.');
  });

  it('shows Archive directly beside Edit and preserves archive confirmation', async () => {
    const host = await render();
    const actions = host.querySelector('app-person-lifecycle-actions')!;
    expect(actions.querySelector('summary')).toBeNull();
    expect(host.querySelector('.profile-actions .edit-person')).not.toBeNull();
    (actions.querySelector('.archive-button') as HTMLElement).click(); await settle();
    expect(service.archivePerson).not.toHaveBeenCalled();
    service.getPersonOverview.mockReturnValue(of({ ...overview, person: { ...overview.person, archived_at: '2026-09-01T12:00:00Z' } }));
    (actions.querySelector('.confirmation button') as HTMLElement).click(); await settle();
    expect(service.archivePerson).toHaveBeenCalledExactlyOnceWith(11);
    expect(host.querySelector('.edit-person')).toBeNull();
    expect(actions.textContent).toContain('Restore person');
    (actions.querySelector('button') as HTMLElement).click(); await settle();
    expect(service.restorePerson).toHaveBeenCalledExactlyOnceWith(11);
  });
});
