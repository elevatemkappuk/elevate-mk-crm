import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmationDialogComponent } from './confirmation-dialog.component';

describe('ConfirmationDialogComponent keyboard interaction', () => {
  let fixture: ComponentFixture<ConfirmationDialogComponent>;
  let opener: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmationDialogComponent] }).compileComponents();
    opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    fixture = TestBed.createComponent(ConfirmationDialogComponent);
    fixture.componentRef.setInput('title', 'Confirm change');
    fixture.componentRef.setInput('message', 'Apply this change?');
    await render();
  });

  afterEach(() => {
    fixture.destroy();
    opener.remove();
  });

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function open(busy = false): Promise<void> {
    fixture.componentRef.setInput('busy', busy);
    fixture.componentRef.setInput('open', true);
    await render();
  }

  function button(kind: 'primary' | 'secondary'): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`.button-${kind}`);
  }

  function key(target: HTMLElement, value: string, shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  it('focuses confirmation, wraps Tab in both directions, and contains outside focus', async () => {
    await open();
    expect(document.activeElement).toBe(button('primary'));
    expect(key(button('primary'), 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(button('secondary'));
    key(button('secondary'), 'Tab', true);
    expect(document.activeElement).toBe(button('primary'));
    opener.focus();
    expect(document.activeElement).toBe(button('primary'));
  });

  it('emits the existing confirmation and Escape cancellation events without closing itself', async () => {
    let confirmed = 0;
    let cancelled = 0;
    fixture.componentInstance.confirmed.subscribe(() => confirmed++);
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    await open();
    button('primary').click();
    key(button('primary'), 'Escape');
    expect(confirmed).toBe(1);
    expect(cancelled).toBe(1);
    expect(fixture.componentInstance.open()).toBe(true);
  });

  it('keeps focus in a busy dialog and blocks confirmation and all cancellation paths', async () => {
    let confirmed = 0;
    let cancelled = 0;
    fixture.componentInstance.confirmed.subscribe(() => confirmed++);
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    await open();
    fixture.componentRef.setInput('busy', true);
    await render();
    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(document.activeElement).toBe(dialog);
    expect(key(dialog, 'Tab').defaultPrevented).toBe(true);
    key(dialog, 'Escape');
    button('secondary').click();
    button('primary').click();
    fixture.nativeElement.querySelector('.backdrop').click();
    expect(confirmed).toBe(0);
    expect(cancelled).toBe(0);
    fixture.componentRef.setInput('busy', false);
    await render();
    expect(document.activeElement).toBe(button('primary'));
  });

  it('holds initial focus on the container when opened busy', async () => {
    await open(true);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('[role="dialog"]'));
  });

  it('restores focus after close and after removal while open', async () => {
    await open();
    fixture.componentRef.setInput('open', false);
    await render();
    expect(document.activeElement).toBe(opener);
    await open();
    fixture.destroy();
    expect(document.activeElement).toBe(opener);
  });

  it('can close safely when the opener has been removed', async () => {
    await open();
    opener.remove();
    fixture.componentRef.setInput('open', false);
    await render();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
});
