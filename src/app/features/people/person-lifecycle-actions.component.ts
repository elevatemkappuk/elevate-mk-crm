import { Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PersonListItem } from '../../core/people/people.types';

@Component({
  selector: 'app-person-lifecycle-actions',
  imports: [RouterLink],
  template: `
    @if (person().archived_at) {
      <button type="button" class="primary" [disabled]="submitting()" (click)="restore.emit()">{{ submitting() ? 'Restoring...' : 'Restore Person' }}</button>
    } @else if (confirmingArchive()) {
      <div class="confirmation" aria-live="polite">
        <p>Archiving removes this Person from the default active People list but preserves their CRM history and related records.</p>
        <button type="button" class="secondary" [disabled]="submitting()" (click)="archive.emit()">{{ submitting() ? 'Archiving...' : 'Confirm archive' }}</button>
        <button type="button" class="secondary" [disabled]="submitting()" (click)="confirmingArchive.set(false)">Cancel</button>
      </div>
    } @else {
      <a [routerLink]="['/people', person().id, 'edit']" class="secondary">Edit</a>
      <button type="button" class="secondary" (click)="confirmingArchive.set(true)">Archive Person</button>
    }
    @if (errorMessage()) { <p class="error" aria-live="assertive">{{ errorMessage() }}</p> }
  `,
  styles: `
    :host,.confirmation { display:flex; align-items:center; gap:.7rem; flex-wrap:wrap; } .confirmation p,.error { flex:1 1 100%; margin:0; color:#5c4632; line-height:1.45; } .error { color:#9b1c1c; font-weight:600; }
    button,a { width:fit-content; border-radius:999px; padding:.75rem 1.1rem; font:inherit; font-weight:700; cursor:pointer; text-decoration:none; } .primary { border:0; color:#fff; background:linear-gradient(135deg,#16354a,#2f6f84); } .secondary { border:1px solid #b7c7d4; color:#203a4c; background:#fff; } button:disabled { cursor:wait; opacity:.7; }
  `,
})
export class PersonLifecycleActionsComponent {
  readonly person = input.required<PersonListItem>();
  readonly submitting = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly archive = output<void>();
  readonly restore = output<void>();
  readonly confirmingArchive = signal(false);
}
