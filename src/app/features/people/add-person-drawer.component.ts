import { Component, computed, output, viewChild } from '@angular/core';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';
import { PersonWritePageComponent } from './person-write-page.component';

@Component({
  selector: 'app-add-person-drawer',
  imports: [CrmDrawerComponent, PersonWritePageComponent],
  template: `
    <app-crm-drawer title="Add person" description="Create a new CRM person."
      [busy]="writer()?.submitting() ?? false" [dirty]="writer()?.hasUnsavedEdits() ?? false"
      [closeBlocked]="writer()?.identityOverrideConfirmationOpen() ?? false" (closed)="closed.emit()">
      <app-person-write-page [drawer]="true" (cancelled)="requestClose()" (saved)="closed.emit()" />
    </app-crm-drawer>
  `,
})
export class AddPersonDrawerComponent {
  readonly writer = viewChild(PersonWritePageComponent);
  readonly sheet = viewChild(CrmDrawerComponent);
  readonly closed = output<void>();
  readonly discardOpen = computed(() => this.sheet()?.discardOpen() ?? false);
  requestClose(): void { this.sheet()?.requestClose(); }
}
