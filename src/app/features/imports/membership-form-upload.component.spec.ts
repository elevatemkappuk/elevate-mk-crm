import { By } from '@angular/platform-browser';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportBatchSummary } from '../../core/imports/import-reconciliation.types';
import { MembershipFormUploadComponent } from './membership-form-upload.component';

const batch: ImportBatchSummary = {
  id: 3, source_type: 'MEMBERSHIP_FORM', source_filename: 'membership.xlsx', status: 'READY_FOR_REVIEW',
  created_at: '2026-09-01T10:00:00Z', started_at: '2026-09-01T10:00:00Z', completed_at: null,
  total_count: 2, review_required_count: 1, resolved_count: 1, invalid_count: 0, committed_count: 0,
  auto_match_count: 1, new_person_count: 0,
};

class MockImportReconciliationService {
  readonly uploadMembershipForm = vi.fn(() => of(batch));
  readonly uploadEventbrite = vi.fn(() => of({ ...batch, source_type: 'EVENTBRITE', status: 'STAGED' as const }));
}

describe('MembershipFormUploadComponent', () => {
  let fixture: ComponentFixture<MembershipFormUploadComponent>;
  let component: MembershipFormUploadComponent;
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
      imports: [MembershipFormUploadComponent],
      providers: [{ provide: ImportReconciliationService, useClass: MockImportReconciliationService }],
    }).compileComponents();
    fixture = TestBed.createComponent(MembershipFormUploadComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(ImportReconciliationService) as unknown as MockImportReconciliationService;
    fixture.detectChanges();
  });

  function select(file: File | null): void {
    component.selectFile({ target: { files: { item: () => file } } } as unknown as Event);
  }

  it('requires a file and rejects unsupported, empty, and oversized files client-side', () => {
    component.submit();
    expect(component.validationError()).toContain('.xlsx');
    select(new File(['text'], 'members.csv'));
    expect(component.validationError()).toContain('.xlsx');
    select(new File([], 'members.xlsx'));
    expect(component.validationError()).toContain('cannot be empty');
    select(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'members.xlsx'));
    expect(component.validationError()).toContain('10 MB');
  });

  it('uploads a valid xlsx, clears the form, and emits the returned batch', () => {
    const completed = vi.fn();
    component.completed.subscribe(completed);
    const file = new File(['workbook'], 'members.XLSX');
    select(file);
    component.submit();
    expect(service.uploadMembershipForm).toHaveBeenCalledWith(file);
    expect(component.selectedFile()).toBeNull();
    expect(completed).toHaveBeenCalledWith(batch);
  });

  it('offers both sources and sends Eventbrite workbooks to its endpoint', () => {
    expect(fixture.nativeElement.textContent).toContain('Membership Form');
    expect(fixture.nativeElement.textContent).toContain('Eventbrite');
    component.selectSource({ target: { value: 'EVENTBRITE' } } as unknown as Event);
    select(new File(['workbook'], 'eventbrite.xlsx'));
    component.submit();
    fixture.detectChanges();
    expect(service.uploadEventbrite).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('Import historical Eventbrite contacts and event records.');
  });

  it('shows progress and disables controls while uploading', () => {
    const pending = new Subject<ImportBatchSummary>();
    service.uploadMembershipForm.mockReturnValueOnce(pending);
    select(new File(['workbook'], 'members.xlsx'));
    component.submit();
    fixture.detectChanges();
    expect(component.uploading()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Uploading and analysing...');
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).disabled).toBe(true);
    component.submit();
    const drawer = fixture.debugElement.query(By.directive(CrmDrawerComponent)).componentInstance as CrmDrawerComponent;
    const cancelled = vi.fn();
    component.cancelled.subscribe(cancelled);
    drawer.requestClose();
    expect(cancelled).not.toHaveBeenCalled();
    expect(drawer.discardOpen()).toBe(false);
    expect(service.uploadMembershipForm).toHaveBeenCalledOnce();
    pending.complete();
  });

  it('renders safe structural, permission, and unexpected upload errors', () => {
    select(new File(['workbook'], 'members.xlsx'));
    service.uploadMembershipForm.mockReturnValueOnce(throwError(() => ({ status: 400 })));
    component.submit();
    expect(component.uploadError()).toContain('expected Membership Form structure');
    service.uploadMembershipForm.mockReturnValueOnce(throwError(() => ({ status: 403 })));
    component.submit();
    expect(component.uploadError()).toContain('do not have permission');
    service.uploadMembershipForm.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    component.submit();
    expect(component.uploadError()).toContain('could not be processed');
  });
  it('closes a pristine drawer and confirms before discarding a selected file', () => {
    const cancelled = vi.fn();
    component.cancelled.subscribe(cancelled);
    const drawer = fixture.debugElement.query(By.directive(CrmDrawerComponent)).componentInstance as CrmDrawerComponent;
    drawer.requestClose();
    expect(cancelled).toHaveBeenCalledOnce();
    cancelled.mockClear();
    select(new File(['workbook'], 'members.xlsx'));
    fixture.detectChanges();
    drawer.requestClose();
    expect(drawer.discardOpen()).toBe(true);
    expect(cancelled).not.toHaveBeenCalled();
    drawer.discard();
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('clears selected data on source switching and treats the changed source as dirty', () => {
    select(new File(['workbook'], 'members.xlsx'));
    component.selectSource({ target: { value: 'EVENTBRITE' } } as unknown as Event);
    fixture.detectChanges();
    expect(component.selectedFile()).toBeNull();
    const drawer = fixture.debugElement.query(By.directive(CrmDrawerComponent)).componentInstance as CrmDrawerComponent;
    drawer.requestClose();
    expect(drawer.discardOpen()).toBe(true);
  });

});
