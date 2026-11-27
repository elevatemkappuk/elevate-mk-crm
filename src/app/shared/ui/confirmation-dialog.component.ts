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
          [attr.aria-describedby]="context() ? messageId + ' ' + contextId : messageId"
          (click)="$event.stopPropagation()"
          (keydown.escape)="cancel()"
          (keydown)="trapTab($event)"
        >
          <h2 [id]="titleId">{{ title() }}</h2>
          @if (context(); as summary) { <div class="context-summary" [id]="contextId">{{ summary }}</div> }
          <p [id]="messageId">{{ message() }}</p>
          @if (requireReason()) {
            <div class="reason-field"><label class="crm-label" [for]="reasonId">{{ reasonLabel() }} <span aria-hidden="true">*</span><span class="visually-hidden">required</span></label><textarea class="crm-control" [id]="reasonId" rows="4" [placeholder]="reasonPlaceholder()" [value]="reason()" (input)="reasonChanged.emit($any($event.target).value)" required></textarea></div>
          }
          <div class="crm-actions crm-actions--end">
            <button type="button" class="button-secondary crm-button crm-button--secondary" [disabled]="busy()" (click)="cancel()">{{ cancelLabel() }}</button>
            <button type="button" class="button-primary crm-button" [class.crm-button--primary]="actionVariant() === 'primary'" [class.crm-button--destructive]="actionVariant() === 'destructive'" [class.crm-button--destructive-outline]="actionVariant() === 'destructive-outline'" [class.confirm-button--destructive]="actionVariant() === 'destructive'" [class.confirm-button--caution]="actionVariant() === 'caution'" [class.confirm-button--neutral]="actionVariant() === 'neutral'" [attr.aria-busy]="busy()" [disabled]="busy() || (requireReason() && !reason().trim())" (click)="confirmed.emit()">
              @if (actionVariant() !== 'neutral') { <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path [attr.d]="confirmIconPath()" /></svg> }<span>{{ confirmLabel() }}</span>
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
    .context-summary { padding: var(--crm-space-3); border: 1px solid var(--crm-border); border-radius: var(--crm-radius-md); background: var(--crm-surface-subtle); color: var(--crm-text-strong); font-weight: var(--crm-weight-medium); }
    .reason-field { display: grid; gap: var(--crm-space-2); }
    textarea { min-height: 6rem; box-sizing: border-box; resize: vertical; }
    .crm-button svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .confirm-button--destructive { border-color: var(--crm-destructive); background: var(--crm-destructive); color: var(--crm-on-action); }
    .confirm-button--caution { border-color: var(--crm-warning); background: var(--crm-warning-surface); color: var(--crm-text-strong); }
    .confirm-button--neutral { border-color: var(--crm-control-border); background: var(--crm-surface); color: var(--crm-text-strong); }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  `,
})
export class ConfirmationDialogComponent implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');
  private previousFocus: HTMLElement | null = null;
  private activeDialog: HTMLElement | null = null;
  readonly titleId = `confirmation-dialog-title-${nextDialogId++}`;
  readonly messageId = `${this.titleId}-message`;
  readonly reasonId = `${this.titleId}-reason`;
  readonly contextId = `${this.titleId}-context`;
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly context = input<string | null>(null);
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly reasonLabel = input('Reason');
  readonly reasonPlaceholder = input('Enter a reason');
  readonly actionVariant = input<'primary' | 'destructive' | 'destructive-outline' | 'caution' | 'neutral'>('primary');
  readonly busy = input(false);
  readonly requireReason = input(false);
  readonly reason = input('');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  readonly reasonChanged = output<string>();

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
    const first = !this.busy() && this.requireReason()
      ? element.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)')
      : element.querySelector<HTMLButtonElement>('.crm-button--primary:not(:disabled)')
        ?? element.querySelector<HTMLButtonElement>('button:not(:disabled)');
    (first ?? element).focus();
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
    const focusables = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled)'));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
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

  confirmIconPath(): string {
    return this.actionVariant() === 'destructive' || this.actionVariant() === 'destructive-outline'
      ? 'M6 6l12 12M18 6 6 18'
      : this.actionVariant() === 'caution'
        ? 'M12 8v4m0 4h.01M10.3 4.5 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z'
        : 'm5 12 4 4L19 6';
  }
}
