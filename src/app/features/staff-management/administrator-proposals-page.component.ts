import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { ConfirmationDialogComponent } from '../../shared/ui/confirmation-dialog.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';

@Component({
  selector: 'app-administrator-proposals-page',
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent, StateMessageComponent, StatusBadgeComponent, CrmSectionCardComponent],
  templateUrl: './administrator-proposals-page.component.html',
  styleUrl: './administrator-proposals-page.component.css',
})
export class AdministratorProposalsPageComponent {
  private readonly service = inject(StaffManagementService);
  private readonly destroyRef = inject(DestroyRef);
  readonly proposals = signal<Array<Record<string, any>>>([]);
  readonly selected = signal<Record<string, any> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly query = signal('');
  readonly action = signal<{ proposal: Record<string, any>; kind: 'approve' | 'reject' | 'cancel' } | null>(null);
  readonly reason = signal('');
  readonly saving = signal(false);

  constructor() { this.load(); }
  load(): void { this.loading.set(true); this.service.administratorProposals(this.query() ? { q: this.query() } : {}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: response => { this.proposals.set(response.results); this.loading.set(false); }, error: () => { this.error.set('Administrator proposals could not be loaded.'); this.loading.set(false); } }); }
  select(proposal: Record<string, any>): void { this.service.administratorProposal(String(proposal['public_id'])).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: value => this.selected.set(value), error: () => this.error.set('Proposal details could not be loaded.') }); }
  begin(proposal: Record<string, any>, kind: 'approve' | 'reject' | 'cancel'): void { this.reason.set(''); this.action.set({ proposal, kind }); }
  close(): void { if (!this.saving()) this.action.set(null); }
  confirm(): void { const pending = this.action(); if (!pending || (pending.kind !== 'approve' && !this.reason().trim())) return; this.saving.set(true); this.service.administratorProposalAction(String(pending.proposal['public_id']), pending.kind, this.reason().trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: value => { this.saving.set(false); this.action.set(null); this.selected.set(value); this.load(); }, error: () => { this.saving.set(false); this.error.set('The proposal is no longer actionable or could not be updated.'); } }); }
}
