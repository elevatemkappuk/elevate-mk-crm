import { provideLocationMocks } from '@angular/common/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { PeopleService } from '../../core/people/people.service';
import { PeoplePageComponent } from './people-page.component';
import { PeopleDirectoryFiltersComponent } from './people-directory-filters.component';
import { FilterMultiselectComponent } from './filter-multiselect.component';

describe('People filter drawer', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let service: {
    listPeople: ReturnType<typeof vi.fn>; getIndustries: ReturnType<typeof vi.fn>;
    getInterests: ReturnType<typeof vi.fn>; getSkills: ReturnType<typeof vi.fn>; getTags: ReturnType<typeof vi.fn>;
  };
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

  beforeEach(async () => {
    // Native modal focus containment is supplied by the browser, not jsdom.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.open = true; }) });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
    service = {
      listPeople: vi.fn(() => of({ count: 0, next: null, previous: null, results: [] })),
      getIndustries: vi.fn(() => of([{ id: 1, name: 'Technology' }, { id: 2, name: 'Education' }])),
      getInterests: vi.fn(() => of([{ id: 3, name: 'Volunteering' }])),
      getSkills: vi.fn(() => of([{ id: 4, name: 'Project Management' }, { id: 5, name: 'Design' }])),
      getTags: vi.fn(() => of([{ id: 6, name: 'Partner' }])),
    };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'people', component: PeoplePageComponent }]), provideLocationMocks(),
        { provide: PeopleService, useValue: service },
        { provide: AuthService, useValue: { currentUser: signal({ staff_roles: ['CRM_MANAGER'] }) } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
  });
  afterEach(() => {
    harness?.fixture.destroy();
    for (const [key, descriptor] of [['showModal', showModal], ['close', close]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
    }
  });
  async function render(url = '/people') {
    harness = await RouterTestingHarness.create(url);
    await settle();
    return harness.routeNativeElement!;
  }
  async function settle() {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }
  function filters() {
    return harness.fixture.debugElement.query(By.directive(PeopleDirectoryFiltersComponent)).componentInstance as PeopleDirectoryFiltersComponent;
  }
  async function open() {
    const trigger = harness.routeNativeElement!.querySelector('.toggle') as HTMLButtonElement;
    trigger.focus(); trigger.click(); await settle();
    return harness.routeNativeElement!.querySelector('dialog')!;
  }
  function params() { return router.parseUrl(router.url).queryParamMap; }

  it('opens the shared modal, focuses its title, and restores Filters focus after Escape', async () => {
    const host = await render();
    const dialog = await open();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(host.querySelector('.toggle')?.getAttribute('aria-controls')).toBe(dialog.id);
    expect(host.querySelector('.toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(dialog.querySelector('h2'));
    expect(dialog.querySelector('#people-search')).toBeNull();
    expect(dialog.querySelector('.record-control')).toBeNull();
    expect(host.querySelector('.controls .record-control')).not.toBeNull();
    expect(host.querySelector('.controls .add-person')).not.toBeNull();
    expect(dialog.querySelector('footer .apply')).not.toBeNull();
    const escape = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(escape); await settle();
    expect(escape.defaultPrevented).toBe(true);
    expect(host.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('.toggle'));
    expect(host.querySelector('.toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(service.listPeople).toHaveBeenCalledOnce();
  });

  it('stages edits, then applies repeated canonical parameters through the existing directory flow', async () => {
    await render('/people?q=ama&location=London&industry=999&record_state=all&ordering=-updated_at&page=3&page_size=50');
    await open();
    filters().toggleRelationship('ACTIVE_MEMBER');
    filters().toggleRelationship('CONTACT');
    filters().setSelection('industry', [999, 1]);
    filters().locationValue.set(' Milton Keynes ');
    filters().addLocation();
    await settle();
    expect(service.listPeople).toHaveBeenCalledOnce();
    expect(params().get('page')).toBe('3');
    expect(params().getAll('relationship')).toEqual([]);
    expect(filters().query().industry).toEqual([999]);
    (harness.routeNativeElement!.querySelector('.apply') as HTMLElement).click(); await settle();
    expect(params().getAll('relationship')).toEqual(['ACTIVE_MEMBER', 'CONTACT']);
    expect(params().getAll('industry')).toEqual(['999', '1']);
    expect(params().getAll('location')).toEqual(['London', 'Milton Keynes']);
    expect(params().get('page')).toBeNull();
    expect(params().get('page_size')).toBe('50');
    expect(params().get('q')).toBe('ama');
    expect(params().get('ordering')).toBe('-updated_at');
    expect(params().get('record_state')).toBe('all');
    expect(service.listPeople).toHaveBeenCalledTimes(2);
    expect(service.listPeople.mock.lastCall![0]).toMatchObject({ page: 1, page_size: 50, industry: [999, 1] });
    expect(filters().draft()).toBeNull();
  });

  it.each(['cancel', 'close', 'escape', 'backdrop'])('discards changes on %s without affecting applied filters', async action => {
    await render('/people?relationship=CONTACT&page_size=100');
    const original = router.url;
    const dialog = await open();
    filters().toggleRelationship('ACTIVE_MEMBER'); await settle();
    if (action === 'cancel') (dialog.querySelector('.footer-end .crm-button--secondary') as HTMLElement).click();
    if (action === 'close') (dialog.querySelector('.close') as HTMLElement).click();
    if (action === 'escape') dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    if (action === 'backdrop') dialog.dispatchEvent(new MouseEvent('click', { clientX: -1 }));
    await settle();
    expect(router.url).toBe(original);
    expect(service.listPeople).toHaveBeenCalledOnce();
    expect(filters().draft()).toBeNull();
    await open();
    expect(filters().draft()!.relationship).toEqual(['CONTACT']);
  });

  it('clears only the draft until Apply and preserves outside controls', async () => {
    await render('/people?q=ama&relationship=CONTACT&skill=4&record_state=archived&ordering=-created_at&page_size=50');
    await open();
    filters().clearDraft(); await settle();
    expect(filters().draft()!.relationship).toEqual([]);
    expect(params().get('skill')).toBe('4');
    expect(service.listPeople).toHaveBeenCalledOnce();
    filters().applyFilters(); await settle();
    expect(params().get('relationship')).toBeNull();
    expect(params().get('skill')).toBeNull();
    expect(params().get('q')).toBe('ama');
    expect(params().get('record_state')).toBe('archived');
    expect(params().get('ordering')).toBe('-created_at');
    expect(params().get('page_size')).toBe('50');
  });

  it('renders applied chips and preserves unrelated state when removing one', async () => {
    const host = await render('/people?relationship=CONTACT&industry=1&skill=999&location=London&page=3&page_size=50');
    expect(host.querySelector('.applied-chips')?.textContent).toContain('Technology');
    expect(host.querySelector('.applied-chips')?.textContent).toContain('Skill #999');
    (host.querySelector('.applied-chips [aria-label="Remove Skill #999"]') as HTMLElement).click(); await settle();
    expect(params().get('skill')).toBeNull();
    expect(params().get('industry')).toBe('1');
    expect(params().get('location')).toBe('London');
    expect(params().get('relationship')).toBe('CONTACT');
    expect(params().get('page_size')).toBe('50');
    expect(params().get('page')).toBeNull();
    expect(service.listPeople).toHaveBeenCalledTimes(2);
  });

  it('keeps the established count and outside Clear filters behavior', async () => {
    const host = await render('/people?q=ama&relationship=CONTACT&relationship=ACTIVE_MEMBER&skill=4&record_state=all&ordering=-updated_at&page_size=100');
    expect(host.querySelector('.toggle')?.textContent).toContain('Filters (6)');
    (host.querySelector('.applied-chips .clear') as HTMLElement).click(); await settle();
    expect(router.url).toBe('/people?page_size=100');
    expect(host.querySelector('.toggle')?.textContent).toContain('Filters (0)');
  });

  it('searches taxonomy options locally, supports multiple selections, and keeps unresolved chips', async () => {
    await render('/people?industry=999');
    await open();
    const component = harness.fixture.debugElement.queryAll(By.directive(FilterMultiselectComponent))[0].componentInstance as FilterMultiselectComponent;
    component.search.set('tech'); await settle();
    expect(component.matching().map(option => option.id)).toEqual([1]);
    component.toggle(1); await settle();
    component.search.set('education'); await settle();
    component.toggle(2); await settle();
    expect(component.selected()).toEqual([999, 1, 2]);
    expect(component.nameFor(999)).toBe('Industry #999');
    component.toggle(777); await settle(); // No free-text or fabricated taxonomy IDs.
    expect(component.selected()).toEqual([999, 1, 2]);
    component.toggle(999); await settle();
    expect(component.selected()).toEqual([1, 2]);
    expect(service.listPeople).toHaveBeenCalledOnce();
    expect(params().get('industry')).toBe('999');
  });

  it('keeps taxonomy lists compact until opened and closes options before the drawer on Escape', async () => {
    await render();
    const dialog = await open();
    const picker = dialog.querySelector('app-filter-multiselect')!;
    const search = picker.querySelector('input[type=search]') as HTMLInputElement;
    expect(search.placeholder).toBe('Search industries...');
    expect(picker.querySelector('.options')?.hasAttribute('hidden')).toBe(true);
    search.focus(); await settle();
    expect(picker.querySelector('.options')?.hasAttribute('hidden')).toBe(false);
    const checkbox = picker.querySelector('input[type=checkbox]') as HTMLInputElement;
    checkbox.focus(); checkbox.click(); await settle();
    expect(filters().draft()!.industry).toEqual([1]);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    checkbox.dispatchEvent(escape); await settle();
    expect(escape.defaultPrevented).toBe(true);
    expect(picker.querySelector('.options')?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(search);
    expect(filters().expanded()).toBe(true);
    expect(service.listPeople).toHaveBeenCalledOnce();
  });

  it('keeps unresolved applied selections removable when catalogs fail', async () => {
    service.getSkills.mockReturnValue(throwError(() => new Error('unavailable')));
    const host = await render('/people?skill=999');
    const dialog = await open();
    expect(dialog.textContent).toContain('Skill #999');
    expect(dialog.textContent).toContain('Some filter options could not be loaded');
    filters().closeDrawer(); await settle();
    (host.querySelector('.applied-chips [aria-label="Remove Skill #999"]') as HTMLElement).click(); await settle();
    expect(params().get('skill')).toBeNull();
  });

  it('restores applied state when the URL changes and abandons an obsolete draft', async () => {
    const host = await render('/people?relationship=CONTACT');
    await open();
    filters().toggleRelationship('ACTIVE_MEMBER');
    filters().applyFilters(); await settle();
    await open();
    filters().setSelection('skill', [4]);
    await router.navigateByUrl('/people?relationship=CONTACT'); await settle();
    expect(params().getAll('relationship')).toEqual(['CONTACT']);
    expect(filters().draft()).toBeNull();
    expect(host.querySelector('.applied-chips')?.textContent).not.toContain('Active Member');
    await router.navigateByUrl('/people?relationship=CONTACT&relationship=ACTIVE_MEMBER'); await settle();
    expect(params().getAll('relationship')).toEqual(['CONTACT', 'ACTIVE_MEMBER']);
  });

  it('preserves explicit Search and sends no request while typing', async () => {
    const host = await render('/people?skill=4');
    const input = host.querySelector('#people-search') as HTMLInputElement;
    input.value = ' Ama '; input.dispatchEvent(new Event('input')); await settle();
    expect(service.listPeople).toHaveBeenCalledOnce();
    host.querySelector('.search')!.dispatchEvent(new Event('submit', { cancelable: true })); await settle();
    expect(params().get('q')).toBe('Ama');
    expect(params().get('skill')).toBe('4');
    expect(service.listPeople).toHaveBeenCalledTimes(2);
  });
});
