import { Component, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';


import { PersonListItem } from '../../core/people/people.types';

@Component({
  selector: 'app-person-lifecycle-actions',

  template: `
    <details class="overflow">
      <summary aria-label="More person actions">...</summary>
      <div class="overflow-panel">
    @if (person().archived_at) {
      <button type="button" class="primary" [disabled]="submitting()" (click)="restore.emit()">{{ submitting() ? 'Restoring...' : 'Restore Person' }}</button>
    } @else if (confirmingArchive()) {
      <div class="confirmation" aria-live="polite">
        <p>Archiving removes this Person from the default active People list but preserves their CRM history and related records.</p>
        <button type="button" class="secondary" [disabled]="submitting()" (click)="archive.emit()">{{ submitting() ? 'Archiving...' : 'Confirm archive' }}</button>
        <button type="button" class="secondary" [disabled]="submitting()" (click)="confirmingArchive.set(false)">Cancel</button>
      </div>
    } @else {

      <button type="button" class="secondary" (click)="confirmingArchive.set(true)">Archive Person</button>
    }
    @if (errorMessage()) { <p class="error" aria-live="assertive">{{ errorMessage() }}</p> }
      </div>
    </details>
  `,
  styles: `
    .overflow { position:relative; }
    summary { list-style:none; cursor:pointer; padding:.5rem .9rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-sm); min-height:2.75rem; font-weight:700; }
    summary::-webkit-details-marker { display:none; }
    .overflow-panel { position:absolute; right:0; top:calc(100% + .5rem); z-index:5; width:min(22rem,80vw); padding:1rem; background:var(--crm-surface); border:1px solid var(--crm-border); border-radius:var(--crm-radius-md); box-shadow:var(--crm-shadow-dialog); }
    .confirmation { display:flex; flex-wrap:wrap; gap:.75rem; }
    p { margin:0 0 .75rem; line-height:1.5; font-size:var(--crm-font-sm); }
    button { font:inherit; font-weight:600; cursor:pointer; padding:.65rem .8rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-sm); color:var(--crm-destructive); background:var(--crm-surface); }
    .primary { color:var(--crm-action); }
    button:disabled { opacity:.6; cursor:wait; }
    :is(summary,button):focus-visible { outline:2px solid var(--crm-focus-ring); outline-offset:3px; }
    .error { color:var(--crm-error); }
  `,
})
export class PersonLifecycleActionsComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  @HostListener('document:click', ['$event'])
  closeOutside(event: MouseEvent): void {
    if (!this.submitting() && !this.host.nativeElement.contains(event.target as Node)) this.closeOverflow();
  }
  @HostListener('keydown.escape', ['$event'])
  escape(event: Event): void {
    if (this.submitting()) return;
    event.preventDefault();
    this.closeOverflow();
    this.host.nativeElement.querySelector('summary')?.focus();
  }
  private closeOverflow(): void {
    const details = this.host.nativeElement.querySelector('details');
    if (details) details.open = false;
    this.confirmingArchive.set(false);
  }

  readonly person = input.required<PersonListItem>();
  readonly submitting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly archive = output<void>();
  readonly restore = output<void>();
  readonly confirmingArchive = signal(false);
}
