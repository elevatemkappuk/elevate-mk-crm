import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { StaffManagementService, StaffDirectoryQuery } from '../../core/staff-management/staff-management.service';
import { StaffDirectoryRow } from '../../core/staff-management/staff-management.types';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent, StatusBadgeTone } from '../../shared/ui/status-badge.component';

@Component({
  selector: 'app-staff-directory-page',
  imports: [CommonModule, RouterLink, StateMessageComponent, StatusBadgeComponent],
  templateUrl: './staff-directory-page.component.html',
  styleUrl: './staff-directory-page.component.css',
})
export class StaffDirectoryPageComponent {
  private readonly service = inject(StaffManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryChanges = new Subject<StaffDirectoryQuery>();
  readonly rows = signal<StaffDirectoryRow[]>([]);
  readonly count = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly query = signal<StaffDirectoryQuery>({ page: 1, page_size: 25, ordering: 'name' });
  readonly page = signal(1);
  readonly hasNext = signal(false);
  readonly hasPrevious = signal(false);

  constructor() {
    this.queryChanges.pipe(
      debounceTime(250), distinctUntilChanged((left, right) => JSON.stringify(left) === JSON.stringify(right)),
      tap(() => { this.loading.set(true); this.error.set(null); }),
      switchMap(query => this.service.list(query).pipe(catchError(() => { this.error.set('Staff directory could not be loaded.'); return of(null); }))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(response => {
      this.loading.set(false);
      if (!response) return;
      this.rows.set(response.results); this.count.set(response.count);
      this.hasNext.set(Boolean(response.next)); this.hasPrevious.set(Boolean(response.previous));
      this.page.set(this.query().page ?? 1);
    });
    this.load();
  }

  update(key: keyof StaffDirectoryQuery, value: string): void {
    this.query.update(query => ({ ...query, [key]: value || undefined, page: 1 }));
    this.load();
  }

  clear(): void { this.query.set({ page: 1, page_size: 25, ordering: 'name' }); this.load(); }
  nextPage(): void { if (this.hasNext()) { this.query.update(q => ({ ...q, page: (q.page ?? 1) + 1 })); this.load(); } }
  previousPage(): void { if (this.hasPrevious()) { this.query.update(q => ({ ...q, page: Math.max(1, (q.page ?? 1) - 1) })); this.load(); } }
  retry(): void { this.load(); }
  load(): void { this.queryChanges.next(this.query()); }

  tone(row: StaffDirectoryRow): StatusBadgeTone {
    if (row.staff_access_state === 'ACTIVE' && row.account_state === 'ACTIVE') return 'success';
    if (row.staff_access_state === 'DISABLED' || row.account_state === 'DISABLED') return 'error';
    if (row.staff_access_state === 'PENDING') return 'warning';
    return 'neutral';
  }

  stateLabel(row: StaffDirectoryRow): string {
    if (row.staff_access_state === 'ACTIVE' && row.account_state === 'DISABLED') return 'Unavailable — account disabled';
    return row.staff_access_state === 'ACTIVE' ? 'Active' : row.staff_access_state === 'PENDING' ? 'Pending' : row.staff_access_state === 'DISABLED' ? 'Disabled' : 'Former staff';
  }
}
