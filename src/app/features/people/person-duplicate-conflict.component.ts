import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DuplicatePersonConflict } from '../../core/people/people.types';

@Component({
  selector: 'app-person-duplicate-conflict',
  imports: [CommonModule, RouterLink],
  template: `
    <section class="conflict" aria-live="assertive">
      <h3>{{ isMobileWarning() ? 'Shared mobile number' : 'Possible existing person found' }}</h3>
      <p>{{ message() }}</p>
      <ul>
        @for (match of matches(); track match.id) {
          <li>
            <div>
              <strong>{{ match.first_name }} {{ match.last_name }}</strong>
              @if (match.archived_at) { <span class="archived">Archived</span> }
            </div>
            <a [routerLink]="['/people', match.id]">View existing person</a>
          </li>
        }
      </ul>
      @if (isOverridable()) {
        <button type="button" class="button-primary" (click)="createSeparatePerson.emit()">Save anyway</button>
      }
    </section>
  `,
  styles: `
    .conflict { padding: 1rem; border: 1px solid #d7aa6f; border-radius: .85rem; background: #fff9ef; color: #55360b; }
    h3, p { margin: 0; } h3 { font-size: 1rem; } p { margin-top: .35rem; line-height: 1.45; }
    ul { display: grid; gap: .7rem; margin: 1rem 0 0; padding: 0; list-style: none; }
    li { display:flex; justify-content:space-between; gap:1rem; align-items:center; padding-top:.7rem; border-top:1px solid rgba(85,54,11,.14); }
    a { color:#075879; font-weight:700; white-space:nowrap; }
    .button-primary { margin-top:1rem; border:0; border-radius:999px; padding:.7rem 1rem; background:#1d6077; color:#fff; font:inherit; font-weight:700; cursor:pointer; }
    .archived { margin-left:.45rem; padding:.15rem .4rem; border-radius:999px; background:#efe2cf; font-size:.75rem; font-weight:700; }
    @media (max-width: 600px) { li { align-items:start; flex-direction:column; gap:.35rem; } }
  `,
})
export class PersonDuplicateConflictComponent {
  readonly conflict = input.required<DuplicatePersonConflict>();
  readonly message = input('A Person with the same email or mobile number already exists. Review the existing record before creating another one.');
  readonly createSeparatePerson = output<void>();
  readonly matches = computed(() => {
    const conflict = this.conflict();
    return 'candidates' in conflict ? conflict.candidates : conflict.matches;
  });
  readonly isMobileWarning = computed(() => this.conflict().code === 'duplicate_person');
  readonly isOverridable = computed(() => this.isMobileWarning() || this.conflict().severity === 'WARNING');
}
