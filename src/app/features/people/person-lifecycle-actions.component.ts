import { afterNextRender, Component, ElementRef, HostListener, inject, Injector, input, output, signal } from '@angular/core';

import { PersonListItem } from '../../core/people/people.types';

@Component({
  selector: 'app-person-lifecycle-actions',
  template: `
    @if (person().archived_at) {
      <button type="button" class="restore" [disabled]="submitting()" (click)="restore.emit()">{{ submitting() ? 'Restoring...' : 'Restore person' }}</button>
    } @else if (confirmingArchive()) {
      <div class="confirmation" aria-live="polite">
        <p>Archiving removes this Person from the default active People list but preserves their CRM history and related records.</p>
        <button type="button" class="danger" [disabled]="submitting()" (click)="archive.emit()">{{ submitting() ? 'Archiving...' : 'Confirm archive' }}</button>
        <button type="button" [disabled]="submitting()" (click)="cancelArchive()">Cancel</button>
      </div>
    } @else {
      <button type="button" class="archive-button danger" [disabled]="submitting()" (click)="openArchive()">Archive person</button>
    }
    @if (errorMessage()) { <p class="error" aria-live="assertive">{{ errorMessage() }}</p> }
  `,
  styles: `
    :host { display:block; min-width:0; }
    .confirmation { display:flex; flex-wrap:wrap; gap:.75rem; max-width:22rem; }
    p { margin:0; line-height:1.5; font-size:var(--crm-font-sm); }
    button { min-height:2.75rem; font:inherit; font-weight:600; cursor:pointer; padding:.65rem 1rem; border:1px solid var(--crm-border); border-radius:var(--crm-radius-sm); color:var(--crm-text-strong); background:var(--crm-surface); }
    .danger { color:var(--crm-destructive); border-color:color-mix(in srgb,var(--crm-destructive) 35%,var(--crm-surface)); }
    .danger:hover:not(:disabled) { background:var(--crm-error-surface); }
    .restore { color:var(--crm-action); }
    button:disabled { opacity:.6; cursor:wait; }
    button:focus-visible { outline:2px solid var(--crm-focus-ring); outline-offset:3px; }
    .error { color:var(--crm-error); margin-top:.75rem; max-width:22rem; }
  `,
})
export class PersonLifecycleActionsComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly person = input.required<PersonListItem>();
  readonly submitting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly archive = output<void>();
  readonly restore = output<void>();
  readonly confirmingArchive = signal(false);

  openArchive(): void {
    if (this.submitting()) return;
    this.confirmingArchive.set(true);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLButtonElement>('.confirmation button')?.focus(), { injector: this.injector });
  }

  cancelArchive(): void {
    if (this.submitting()) return;
    this.confirmingArchive.set(false);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLButtonElement>('.archive-button')?.focus(), { injector: this.injector });
  }

  @HostListener('document:click', ['$event'])
  closeOutside(event: MouseEvent): void {
    if (!this.submitting() && !this.host.nativeElement.contains(event.target as Node)) this.confirmingArchive.set(false);
  }

  @HostListener('keydown.escape', ['$event'])
  escape(event: Event): void {
    if (!this.confirmingArchive() || this.submitting()) return;
    event.preventDefault();
    this.cancelArchive();
  }
}
