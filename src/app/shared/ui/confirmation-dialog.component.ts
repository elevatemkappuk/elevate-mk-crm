import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirmation-dialog',
  template: `
    @if (open()) {
      <div class="backdrop" (click)="cancel()">
        <section
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmation-dialog-title"
          aria-describedby="confirmation-dialog-message"
          (click)="$event.stopPropagation()"
          (keydown.escape)="cancel()"
        >
          <h2 id="confirmation-dialog-title">{{ title() }}</h2>
          <p id="confirmation-dialog-message">{{ message() }}</p>
          <div class="actions">
            <button type="button" class="button-secondary" [disabled]="busy()" (click)="cancel()">Cancel</button>
            <button type="button" class="button-primary" autofocus [disabled]="busy()" (click)="confirmed.emit()">
              {{ confirmLabel() }}
            </button>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .backdrop { position:fixed; inset:0; z-index:20; display:grid; place-items:center; padding:1rem; background:rgba(18,39,54,.48); }
    .dialog { width:min(100%,34rem); display:grid; gap:1rem; padding:1.4rem; border-radius:1rem; background:#fff; box-shadow:0 1.25rem 3rem rgba(9,28,41,.28); }
    h2,p { margin:0; } h2 { color:#173248; font-size:1.3rem; } p { color:#526f81; line-height:1.5; }
    .actions { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:.75rem; }.button-primary,.button-secondary { border:0; border-radius:999px; padding:.7rem 1rem; font:inherit; font-weight:700; cursor:pointer; }
    .button-primary { background:#1d6077; color:#fff; }.button-secondary { background:#e5eef2; color:#173248; }.button-primary:disabled,.button-secondary:disabled { opacity:.55; cursor:not-allowed; }
  `,
})
export class ConfirmationDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirm');
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
