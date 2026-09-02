import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportBatchSummary } from '../../core/imports/import-reconciliation.types';
import { AuthService } from '../../core/auth/auth.service';
import { HistoricalImportsPageComponent } from './historical-imports-page.component';

@Component({ template: '' })
class DummyRouteComponent {}

class MockImportReconciliationService {
  batches: ImportBatchSummary[] = [];

  listBatches() {
    return of(this.batches);
  }
}

class MockAuthService {
  readonly isCrmAdmin = signal(true);
}

describe('HistoricalImportsPageComponent', () => {
  let service: MockImportReconciliationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoricalImportsPageComponent],
      providers: [
        provideRouter([{ path: 'imports/:id', component: DummyRouteComponent }]),
        { provide: ImportReconciliationService, useClass: MockImportReconciliationService },
        { provide: AuthService, useClass: MockAuthService },
      ],
    }).compileComponents();
    service = TestBed.inject(ImportReconciliationService) as unknown as MockImportReconciliationService;
  });

  function createComponent(): ComponentFixture<HistoricalImportsPageComponent> {
    const fixture = TestBed.createComponent(HistoricalImportsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders backend total_count and review counts without source-row PII', () => {
    service.batches = [{
      id: 3,
      source_type: 'MEMBERSHIP_FORM',
      source_filename: 'membership-form.xlsx',
      status: 'READY_FOR_REVIEW',
      created_at: '2026-09-01T09:00:00Z',
      started_at: '2026-09-01T09:00:00Z',
      completed_at: null,
      total_count: 120,
      review_required_count: 3,
      invalid_count: 2,
      resolved_count: 7,
      committed_count: 0,
      auto_match_count: 0,
      new_person_count: 0,
    }];
    const fixture = createComponent();
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('membership-form.xlsx');
    expect(content).toContain('Ready for Review');
    expect(content).toContain('Review');
    expect(content).toContain('3');
    expect(content).toContain('Review 3 records');
    expect(content).not.toContain('david@example.com');
  });

  it('renders a zero-review ready-for-import batch without a review action', () => {
    service.batches = [{
      id: 4,
      source_type: 'MEMBERSHIP_FORM',
      source_filename: 'ready.xlsx',
      status: 'READY_FOR_IMPORT',
      created_at: '2026-09-02T09:00:00Z',
      started_at: '2026-09-02T09:00:00Z',
      completed_at: null,
      total_count: 10,
      review_required_count: 0,
      invalid_count: 0,
      resolved_count: 10,
      committed_count: 0,
      auto_match_count: 5,
      new_person_count: 5,
    }];
    const fixture = createComponent();
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('Ready to add to CRM');
    expect(content).toContain('View batch');
    expect(content).not.toContain('Review 0 records');
    expect(Array.from(fixture.nativeElement.querySelectorAll('button')).map((button: HTMLButtonElement) => button.textContent)).not.toContain('Import');
  });

  it('shows the reusable empty state when no batches exist', () => {
    const fixture = createComponent();
    expect(fixture.nativeElement.textContent).toContain('No historical imports');
    expect(fixture.nativeElement.textContent).toContain('Upload historical records');
  });

  it('hides import actions for non-admin staff', () => {
    const auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    auth.isCrmAdmin.set(false);
    const fixture = createComponent();
    expect(fixture.nativeElement.textContent).not.toContain('Upload historical records');
  });
});
