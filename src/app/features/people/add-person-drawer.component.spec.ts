import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../core/auth/auth.service';
import { PeopleService } from '../../core/people/people.service';
import { PersonListItem, DuplicatePersonConflict } from '../../core/people/people.types';
import { AddPersonDrawerComponent } from './add-person-drawer.component';
import { PersonWritePageComponent } from './person-write-page.component';

@Component({
  imports: [AddPersonDrawerComponent],
  template: `<button (click)="open.set(true)">Add person</button>
    @if (open()) { <app-add-person-drawer (closed)="open.set(false)" /> }`,
})
class DrawerHost {
  readonly open = signal(false);
}

const person: PersonListItem = {
  id: 42, first_name: 'Ama', last_name: 'Amoah', primary_email: 'ama@example.com',
  mobile: '', location: '', age_range: '', gender: '', archived_at: null,
  created_at: '', updated_at: '',
};
const conflict: DuplicatePersonConflict = {
  code: 'IDENTITY_COLLISION', detail: 'Review these people.',
  collision: { collision: 'EMAIL_COLLISION', person_ids: [4] },
  candidates: [{ ...person, id: 4 }],
};

describe('Add person drawer and shared creation', () => {
  let fixture: ComponentFixture<DrawerHost>;
  let response: Subject<PersonListItem>;
  let service: { createMember: ReturnType<typeof vi.fn>; createContact: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.spyOn>;
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

  beforeEach(async () => {
    // jsdom does not implement native modal focus/inert behavior.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.open = true; }) });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
    response = new Subject<PersonListItem>();
    service = { createMember: vi.fn(() => response), createContact: vi.fn(() => response) };
    await TestBed.configureTestingModule({
      imports: [DrawerHost, PersonWritePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: {}, paramMap: convertToParamMap({}) } } },
        { provide: PeopleService, useValue: service },
        { provide: AuthService, useValue: { currentUser: signal({ staff_roles: ['CRM_MANAGER'] }) } },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(DrawerHost);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    for (const [key, descriptor] of [['showModal', showModal], ['close', close]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
    }
  });

  async function openDrawer() {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.debugElement.query(By.directive(AddPersonDrawerComponent)).componentInstance as AddPersonDrawerComponent;
  }

  function fill(drawer: AddPersonDrawerComponent) {
    drawer.writer()!.personForm()!.form.patchValue({
      first_name: 'Ama', last_name: 'Amoah', primary_email: 'ama@example.com', joined_at: '2026-09-01',
    });
  }

  it('opens a native modal with initial focus, then closes on Escape and restores focus', async () => {
    await openDrawer();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.getAttribute('aria-labelledby')).toBe('add-person-title');
    expect(document.activeElement).toBe(dialog.querySelector('h2'));
    // Browsers dispatch cancel when Escape is pressed in a native dialog.
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('button'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['close', 'cancel', 'escape', 'backdrop'])('confirms meaningful edits on %s and keeps them when discard is cancelled', async action => {
    const drawer = await openDrawer();
    fill(drawer);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    if (action === 'close') (dialog.querySelector('.close') as HTMLElement).click();
    if (action === 'cancel') drawer.writer()!.cancel();
    if (action === 'escape') dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    if (action === 'backdrop') dialog.dispatchEvent(new MouseEvent('click', { clientX: -1 }));
    fixture.detectChanges();
    expect(drawer.discardOpen()).toBe(true);
    (dialog.querySelector('app-confirmation-dialog .crm-button--secondary') as HTMLElement).click();
    fixture.detectChanges();
    expect(drawer.discardOpen()).toBe(false);
    expect(drawer.writer()!.personForm()!.form.controls.first_name.value).toBe('Ama');
    drawer.requestClose();
    fixture.detectChanges();
    (dialog.querySelector('app-confirmation-dialog .crm-button--primary') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('retains the join date when switching types and never submits membership fields for Contact', async () => {
    const drawer = await openDrawer();
    fill(drawer);
    (fixture.nativeElement.querySelector('input[value="contact"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.membership')).toBeNull();
    expect(drawer.writer()!.personForm()!.form.controls.joined_at.value).toBe('2026-09-01');
    (fixture.nativeElement.querySelector('input[value="member"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.membership input').value).toBe('2026-09-01');
    drawer.writer()!.changeType('contact');
    fixture.detectChanges();
    drawer.writer()!.personForm()!.form.controls.joined_at.setValue('');
    drawer.writer()!.personForm()!.submit();
    expect(service.createMember).not.toHaveBeenCalled();
    expect(service.createContact).toHaveBeenCalledExactlyOnceWith({
      first_name: 'Ama', last_name: 'Amoah', primary_email: 'ama@example.com',
      mobile: '', location: '', age_range: '', gender: '',
    });
  });

  it('validates a Member join date and prevents repeat submits, type changes, or closing while pending', async () => {
    const drawer = await openDrawer();
    fill(drawer);
    const form = drawer.writer()!.personForm()!;
    form.form.controls.joined_at.setValue('');
    form.submit();
    expect(service.createMember).not.toHaveBeenCalled();
    form.form.controls.joined_at.setValue('2026-09-01');
    form.submit();
    fixture.detectChanges();
    form.submit();
    drawer.writer()!.changeType('contact');
    drawer.requestClose();
    expect(service.createMember).toHaveBeenCalledOnce();
    expect(service.createMember.mock.calls[0][0]).toMatchObject({ joined_at: '2026-09-01', membership_source: 'STAFF' });
    expect(drawer.writer()!.mode()).toBe('member');
    expect(drawer.discardOpen()).toBe(false);
    expect(fixture.componentInstance.open()).toBe(true);
    response.next(person);
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/people', 42]);
  });

  it('requires explicit collision confirmation and re-reviews stale candidate IDs', async () => {
    service.createMember.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: conflict })));
    const drawer = await openDrawer();
    fill(drawer);
    drawer.writer()!.personForm()!.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Possible existing person found');
    expect(fixture.nativeElement.querySelector('app-person-duplicate-conflict a').getAttribute('href')).toBe('/people/4');
    (fixture.nativeElement.querySelector('app-person-duplicate-conflict button') as HTMLElement).click();
    fixture.detectChanges();
    expect(service.createMember).toHaveBeenCalledTimes(1);
    const stale = { ...conflict, code: 'IDENTITY_COLLISION_STALE', detail: 'Candidates changed.', collision: { collision: 'EMAIL_COLLISION', person_ids: [4, 9] } };
    service.createMember.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: stale })));
    (fixture.nativeElement.querySelector('app-confirmation-dialog .crm-button--primary') as HTMLElement).click();
    fixture.detectChanges();
    expect(service.createMember.mock.calls[1][0]).toMatchObject({ confirm_identity_override: true, reviewed_collision: conflict.collision });
    expect(fixture.nativeElement.textContent).toContain('Candidates changed.');
    expect(drawer.writer()!.identityOverrideConfirmationOpen()).toBe(false);
    drawer.writer()!.openIdentityOverrideConfirmation();
    drawer.writer()!.confirmIdentityOverride();
    expect(service.createMember.mock.calls[2][0].reviewed_collision.person_ids).toEqual([4, 9]);
  });

  it.each(['field', 'type'])('invalidates a reviewed collision after a %s change', async change => {
    service.createMember.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: conflict })));
    const drawer = await openDrawer();
    fill(drawer);
    drawer.writer()!.personForm()!.submit();
    if (change === 'field') drawer.writer()!.personForm()!.form.controls.primary_email.setValue('new@example.com');
    else drawer.writer()!.changeType('contact');
    drawer.writer()!.confirmIdentityOverride();
    expect(drawer.writer()!.duplicateConflict()).toBeNull();
    expect(service.createMember).toHaveBeenCalledOnce();
    expect(service.createContact).not.toHaveBeenCalled();
  });

  it('cancels collision confirmation with Escape without also closing the drawer', async () => {
    service.createMember.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: conflict })));
    const drawer = await openDrawer();
    fill(drawer);
    drawer.writer()!.personForm()!.submit();
    drawer.writer()!.openIdentityOverrideConfirmation();
    fixture.detectChanges();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('app-confirmation-dialog .dialog').dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(drawer.writer()!.identityOverrideConfirmationOpen()).toBe(false);
    expect(drawer.discardOpen()).toBe(false);
    expect(fixture.componentInstance.open()).toBe(true);
  });

  it('keeps API validation errors visible inside the drawer', async () => {
    service.createMember.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 400, error: { primary_email: ['Invalid email.'] } })));
    const drawer = await openDrawer();
    fill(drawer);
    drawer.writer()!.personForm()!.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog .error')?.textContent).toContain('Person details need to be corrected');
    expect(fixture.componentInstance.open()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['member', 'contact'])('keeps the existing %s route using the shared controller', mode => {
    TestBed.inject(ActivatedRoute).snapshot.data['mode'] = mode;
    const routeFixture = TestBed.createComponent(PersonWritePageComponent);
    routeFixture.detectChanges();
    expect(routeFixture.componentInstance.drawer()).toBe(false);
    expect(routeFixture.componentInstance.mode()).toBe(mode);
    routeFixture.componentInstance.personForm()!.form.patchValue({ first_name: 'Ama', last_name: 'Amoah' });
    routeFixture.componentInstance.personForm()!.submit();
    expect(mode === 'member' ? service.createMember : service.createContact).toHaveBeenCalledOnce();
    response.next(person);
    expect(navigate).toHaveBeenCalledWith(['/people', 42]);
    routeFixture.destroy();
  });
});
