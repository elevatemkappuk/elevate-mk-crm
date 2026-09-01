import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportBatchDetail, ImportReviewQueue, PaginatedImportRecordPreview } from '../../core/imports/import-reconciliation.types';
import { ImportBatchPageComponent } from './import-batch-page.component';

@Component({ template: '' })
class DummyRouteComponent {}

const readyForImportBatch: ImportBatchDetail = {
  id: 3,
  source_type: 'MEMBERSHIP_FORM',
  source_filename: 'members.xlsx',
  status: 'READY_FOR_IMPORT',
  created_at: '2026-09-02T09:00:00Z',
  started_at: '2026-09-02T09:00:00Z',
  completed_at: null,
  total_count: 2,
  review_required_count: 0,
  invalid_count: 0,
  resolved_count: 2,
  committed_count: 0,
  auto_match_count: 1,
  new_person_count: 1,
};

class MockImportReconciliationService {
  readonly getBatch = () => of(readyForImportBatch);
  readonly getReviewQueue = () => of<ImportReviewQueue>({ count: 0, results: [] });
  readonly getBatchRecords = () => of<PaginatedImportRecordPreview>({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
}

describe('ImportBatchPageComponent', () => {
  let fixture: ComponentFixture<ImportBatchPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportBatchPageComponent],
      providers: [
        provideRouter([{ path: 'imports', component: DummyRouteComponent }]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '3' }) } } },
        { provide: ImportReconciliationService, useClass: MockImportReconciliationService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportBatchPageComponent);
    fixture.detectChanges();
  });

  it('uses the ready-for-import lifecycle copy without an import or review action', () => {
    const content = fixture.nativeElement.textContent as string;
    const buttonLabels = Array.from(fixture.nativeElement.querySelectorAll('button')).map(
      (button: HTMLButtonElement) => button.textContent?.trim(),
    );

    expect(content).toContain('Ready for Import');
    expect(content).toContain('Ready for import');
    expect(content).toContain('All identity decisions are resolved.');
    expect(content).not.toContain('Review records');
    expect(buttonLabels).not.toContain('Import');
    expect(content).not.toContain('Ready to commit');
  });

  it('keeps imported batches terminal and read-only', () => {
    const component = fixture.componentInstance;

    expect(component.batchMessageTitle('IMPORTED')).toBe('Imported');
    expect(component.batchMessage('IMPORTED')).toContain('read-only');
  });
});
