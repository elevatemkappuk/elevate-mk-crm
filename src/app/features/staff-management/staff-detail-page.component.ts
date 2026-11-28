import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { StaffManagementService } from '../../core/staff-management/staff-management.service';
import { StaffActivityEvent, StaffDetail } from '../../core/staff-management/staff-management.types';
import { DetailListComponent } from '../../shared/ui/detail-list.component';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-staff-detail-page',
  imports: [CommonModule, RouterLink, DetailListComponent, CrmSectionCardComponent, StateMessageComponent, StatusBadgeComponent],
  templateUrl: './staff-detail-page.component.html',
  styleUrl: './staff-detail-page.component.css',
})
export class StaffDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(StaffManagementService);
  private readonly destroyRef = inject(DestroyRef);
  readonly detail = signal<StaffDetail | null>(null);
  readonly activity = signal<StaffActivityEvent[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = Number(params.get('id'));
        return this.service.get(id).pipe(
          tap(detail => {
            this.detail.set(detail);
            this.loading.set(false);
            this.service.activity(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(response => this.activity.set(response.results));
          }),
          catchError(() => { this.error.set('Staff details could not be loaded.'); this.loading.set(false); return of(null); }),
        );
      }), takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }
}
