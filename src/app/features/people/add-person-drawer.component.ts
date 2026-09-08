import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, ElementRef, inject, OnDestroy, output, signal, viewChild } from '@angular/core';

import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { PersonWritePageComponent } from './person-write-page.component';

@Component({
  selector: 'app-add-person-drawer',
  imports: [PersonWritePageComponent, ConfirmationDialogComponent],
  template: `
    <dialog #dialog aria-labelledby="add-person-title" aria-describedby="add-person-description"
      (cancel)="$event.preventDefault(); requestClose()" (click)="backdropClick($event)">
      <header [attr.inert]="discardOpen() ? '' : null">
        <div>
          <h2 id="add-person-title" tabindex="-1">Add person</h2>
          <p id="add-person-description">Create a new CRM person.</p>
        </div>
        <button type="button" class="close crm-button crm-button--quiet" aria-label="Close Add person"
          [disabled]="writer()?.submitting()" (click)="requestClose()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </header>
      <div class="body" [attr.inert]="discardOpen() ? '' : null">
        <app-person-write-page [drawer]="true" (cancelled)="requestClose()" (saved)="closed.emit()" />
      </div>
      <div (keydown.escape)="$event.preventDefault(); $event.stopPropagation()">
        <app-confirmation-dialog [open]="discardOpen()" title="Discard this person?"
          message="Your unsaved details will be lost." confirmLabel="Discard changes"
          (cancelled)="discardOpen.set(false)" (confirmed)="discard()" />
      </div>
    </dialog>
  `,
  styles: `
    dialog { position:fixed; inset:0 0 0 auto; width:min(36rem,100%); height:100dvh; max-width:100%; max-height:100dvh; margin:0; padding:0; border:0; border-left:1px solid var(--crm-border); background:var(--crm-surface); color:var(--crm-text-strong); box-shadow:var(--crm-shadow-dialog); overflow:hidden; }
    dialog[open] { display:flex; flex-direction:column; }
    dialog::backdrop { background:var(--crm-overlay); }
    header { display:flex; flex:none; align-items:start; justify-content:space-between; gap:1rem; padding:1.5rem; border-bottom:1px solid var(--crm-border); }
    h2,p { margin:0; } h2 { font-size:var(--crm-font-title); line-height:1.25; }
    p { margin-top:.5rem; color:var(--crm-text-secondary); }
    h2:focus-visible { outline:2px solid var(--crm-focus-ring); outline-offset:4px; }
    .close { min-width:2.75rem; min-height:2.75rem; padding:.6rem; }
    svg { width:1.25rem; height:1.25rem; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; }
    .body { min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:1.5rem 1.5rem 0; }
    @media(max-width:42.5rem) { dialog { width:100%; border:0; } header { padding:1.25rem; } .body { padding:1.25rem 1.25rem 0; } }
  `,
})
export class AddPersonDrawerComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  readonly writer = viewChild(PersonWritePageComponent);
  readonly closed = output<void>();
  readonly discardOpen = signal(false);
  private readonly previousFocus = this.document.activeElement as HTMLElement | null;
  private readonly previousOverflow = this.document.body.style.overflow;

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.document.body.style.overflow = 'hidden';
      this.dialog().nativeElement.querySelector<HTMLElement>('h2')?.focus();
    });
  }

  requestClose(): void {
    if (this.writer()?.submitting() || this.writer()?.identityOverrideConfirmationOpen() || this.discardOpen()) return;
    if (this.writer()?.hasUnsavedEdits()) this.discardOpen.set(true);
    else this.closed.emit();
  }

  backdropClick(event: MouseEvent): void {
    const dialog = this.dialog().nativeElement;
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.requestClose();
  }

  discard(): void {
    if (!this.writer()?.submitting()) this.closed.emit();
  }

  ngOnDestroy(): void {
    this.dialog().nativeElement.close();
    this.document.body.style.overflow = this.previousOverflow;
    // Restore after nested confirmation components have finished their cleanup.
    queueMicrotask(() => { if (this.previousFocus?.isConnected) this.previousFocus.focus(); });
  }
}
