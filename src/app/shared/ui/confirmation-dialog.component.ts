import { DOCUMENT } from '@angular/common';
import { afterRenderEffect, Component, ElementRef, inject, input, OnDestroy, output, viewChild } from '@angular/core';

let nextDialogId = 0;

@Component({
  selector: 'app-confirmation-dialog',
  host: { '(document:focusin)': 'containFocus($event)' },
  template: `
    @if (open()) {
      <div class="backdrop" (click)="cancel()">
        <section
          #dialog
          class="dialog"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="messageId"
          (click)="$event.stopPropagation()"
          (keydown.escape)="cancel()"
          (keydown)="trapTab($event)"
        >
          <h2 [id]="titleId">{{ title() }}</h2>
          <p [id]="messageId">{{ message() }}</p>
          <div class="crm-actions crm-actions--end">
            <button type="button" class="button-secondary crm-button crm-button--secondary" [disabled]="busy()" (click)="cancel()">Cancel</button>
            <button type="button" class="button-primary crm-button crm-button--primary" [attr.aria-busy]="busy()" [disabled]="busy()" (click)="confirmed.emit()">
              {{ confirmLabel() }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: var(--crm-layer-dialog); display: grid; place-items: center; padding: var(--crm-space-4); background: var(--crm-overlay); }
    .dialog { width: min(100%, var(--crm-width-dialog)); max-height: calc(100dvh - var(--crm-space-8)); overflow-y: auto; display: grid; gap: var(--crm-space-4); padding: var(--crm-space-6); border: 1px solid var(--crm-border); border-radius: var(--crm-radius-lg); background: var(--crm-surface); box-shadow: var(--crm-shadow-dialog); }
    .dialog:focus-visible { outline: 2px solid var(--crm-focus-ring); outline-offset: 3px; }
    h2, p { margin: 0; overflow-wrap: anywhere; }
    h2 { color: var(--crm-text-strong); font-size: var(--crm-font-lg); line-height: var(--crm-leading-heading); }
    p { color: var(--crm-text-secondary); line-height: var(--crm-leading); }
  `,
})
export class ConfirmationDialogComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private previousFocus: HTMLElement | null = null;
  private activeDialog: HTMLElement | null = null;
  readonly titleId = `confirmation-dialog-title-${nextDialogId++}`;
  readonly messageId = `${this.titleId}-message`;
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  constructor() {
    afterRenderEffect(() => {
      const element = this.dialog()?.nativeElement;
      const busy = this.busy();
      if (!element) {
        this.restoreFocus();
        return;
      }
      if (this.activeDialog !== element) {
        this.previousFocus = this.document.activeElement as HTMLElement | null;
        this.activeDialog = element;
        this.focusInside();
      } else if (busy || this.document.activeElement === element) {
        this.focusInside();
      }
    });
  }

  private focusInside(): void {
    const element = this.activeDialog;
    if (!element) return;
    // Preserve the existing confirm-first focus; the container holds focus while busy.
    const confirm = element.querySelector<HTMLButtonElement>('.crm-button--primary:not(:disabled)');
    (confirm ?? element).focus();
  }

  containFocus(event: FocusEvent): void {
    if (this.open() && this.activeDialog && !this.activeDialog.contains(event.target as Node)) {
      this.focusInside();
    }
  }

  trapTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const element = this.activeDialog;
    if (!element) return;
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const current = this.document.activeElement;
    if (!first) {
      event.preventDefault();
      element.focus();
    } else if (current === element || (event.shiftKey ? current === first : current === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  private restoreFocus(): void {
    if (!this.activeDialog) return;
    this.activeDialog = null;
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
  }

  ngOnDestroy(): void { this.restoreFocus(); }

  cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
