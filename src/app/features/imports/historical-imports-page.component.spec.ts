import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
  afterEach(() => {
    TestBed.resetTestingModule();
    for (const [key, descriptor] of [['showModal', showModal], ['close', close]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
      else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[key];
    }
  });
  beforeEach(async () => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.open = true; }) });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: vi.fn(function(this: HTMLDialogElement) { this.open = false; }) });
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
    expect(content).toContain('View import');
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
    expect(content).toContain('View import');
    expect(content).not.toContain('Review 0 records');
    expect(Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')).map((button) => button.textContent)).not.toContain('Import');
  });

  it('labels Eventbrite staged batches without exposing source-row data', () => {
    service.batches = [{
      id: 5, source_type: 'EVENTBRITE', source_filename: 'eventbrite.xlsx', status: 'STAGED',
      created_at: '2026-09-02T09:00:00Z', started_at: '2026-09-02T09:00:00Z', completed_at: null,
      total_count: 10, review_required_count: 0, invalid_count: 0, resolved_count: 0, committed_count: 0,
      auto_match_count: 0, new_person_count: 0,
    }];
    const fixture = createComponent();
    expect(fixture.nativeElement.textContent).toContain('Eventbrite');
    expect(fixture.nativeElement.textContent).toContain('Staged');
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
  it('opens upload from its action and closes the pristine drawer with Cancel', () => {
    const fixture = createComponent();
    fixture.nativeElement.querySelector('.page-intro button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-crm-drawer')).not.toBeNull();
    fixture.nativeElement.querySelector('[drawerFooter] button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-crm-drawer')).toBeNull();
  });

  it('refreshes after upload and renders the authoritative newest-first API order', () => {
    const older: ImportBatchSummary = {
      id: 8, source_type: 'EVENTBRITE', source_filename: 'older.xlsx', status: 'STAGED',
      created_at: '2026-09-01T09:00:00Z', started_at: '2026-09-01T09:00:00Z', completed_at: null,
      total_count: 10, review_required_count: 0, invalid_count: 0, resolved_count: 0,
      committed_count: 0, auto_match_count: 0, new_person_count: 0,
    };
    service.batches = [older];
    const fixture = createComponent();
    const newest = { ...older, id: 10, source_filename: 'newest.xlsx', created_at: '2026-09-02T09:00:00Z' };
    service.batches = [newest, { ...newest, id: 9, source_filename: 'same-time.xlsx' }, older];
    fixture.componentInstance.uploadOpen.set(true);
    fixture.componentInstance.handleUploadComplete(newest);
    fixture.detectChanges();
    expect(fixture.componentInstance.uploadOpen()).toBe(false);
    expect(Array.from(fixture.nativeElement.querySelectorAll('.import-card h2')).map((node) => (node as HTMLElement).textContent))
      .toEqual(['newest.xlsx', 'same-time.xlsx', 'older.xlsx']);
    expect(fixture.nativeElement.textContent).not.toContain('View batch');
  });

  it('uses semantic tones without changing status labels', () => {
    const component = createComponent().componentInstance;
    expect(component.statusTone('FAILED')).toBe('error');
    expect(component.statusTone('READY_FOR_REVIEW')).toBe('warning');
    expect(component.statusTone('IMPORTED')).toBe('success');
    expect(component.statusTone('STAGED')).toBe('neutral');
  });

});
