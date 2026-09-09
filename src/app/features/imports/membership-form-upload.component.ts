import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { CrmDrawerComponent } from '../../shared/ui/crm-drawer.component';
import { finalize } from 'rxjs';

import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { HistoricalImportSource, ImportBatchSummary } from '../../core/imports/import-reconciliation.types';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-historical-import-upload',
  imports: [CrmDrawerComponent],
  template: `
    <app-crm-drawer #drawer title="Upload historical records" description="Import historical records into the CRM."
      [busy]="uploading()" [dirty]="selectedFile() !== null || source() !== 'MEMBERSHIP_FORM'" (closed)="cancelled.emit()">
      <div class="upload-panel" [attr.aria-busy]="uploading()">
      <label class="field" for="historical-import-source"><span class="label">Source</span><select class="crm-control" id="historical-import-source" [disabled]="uploading()" [value]="source()" (change)="selectSource($event)"><option value="MEMBERSHIP_FORM">Membership Form</option><option value="EVENTBRITE">Eventbrite</option></select></label>
      <p>{{ sourceDescription() }}</p>

      <label class="field" for="historical-import-file">
        <span class="label">Workbook</span>
        <input id="historical-import-file" class="crm-control" type="file" aria-describedby="workbook-help workbook-errors" [attr.aria-invalid]="validationError() ? true : null" accept=".xlsx" [disabled]="uploading()" (change)="selectFile($event)" />
        <small id="workbook-help">Accepted: .xlsx. Maximum size: 10 MiB.</small>
      </label>

      @if (selectedFile()) { <p class="selected-file">Selected: {{ selectedFile()!.name }}</p> }
      <div id="workbook-errors">@if (validationError()) { <p class="error" role="alert">{{ validationError() }}</p> }
      @if (uploadError()) { <p class="error" role="alert">{{ uploadError() }}</p> }

      </div></div>
      <div drawerFooter class="actions">
        <button type="button" class="crm-button crm-button--secondary" [disabled]="uploading()" (click)="drawer.requestClose()">Cancel</button>
        <button type="button" class="crm-button upload-action" [disabled]="uploading()" (click)="submit()">
          {{ uploading() ? uploadLabel() : 'Upload workbook' }}
        </button>
      </div>
    </app-crm-drawer>
  `,
  styles: `
    .upload-panel { display:grid; gap:1rem; padding-bottom:1.5rem; }
    p { margin:0; } p,small { color:var(--crm-text-secondary); }
    .field { display:grid; gap:.5rem; min-width:0; }
    .label { font-weight:var(--crm-weight-medium); }
    .crm-control { width:100%; min-width:0; min-height:2.75rem; }
    input::file-selector-button { border:0; border-radius:var(--crm-radius-sm); padding:.4rem .6rem; margin-right:.5rem; background:var(--crm-surface-subtle); color:var(--crm-text-strong); font:inherit; cursor:pointer; }
    .selected-file { overflow-wrap:anywhere; font-weight:600; }
    .error { color:var(--crm-error); }
    .actions { display:flex; justify-content:space-between; gap:.75rem; flex-wrap:wrap; }
    .upload-action { background:var(--crm-shell-accent); color:var(--crm-text-strong); }
    .upload-action:hover:not(:disabled) { background:#f2c94f; }
  `,
})
export class MembershipFormUploadComponent {
  private readonly service = inject(ImportReconciliationService);

  readonly completed = output<ImportBatchSummary>();
  readonly cancelled = output<void>();
  readonly selectedFile = signal<File | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly source = signal<HistoricalImportSource>('MEMBERSHIP_FORM');

  sourceDescription(): string {
    return this.source() === 'EVENTBRITE'
      ? 'Import historical Eventbrite contacts and event records.'
      : 'Import historical membership records.';
  }

  uploadLabel(): string {
    return this.source() === 'EVENTBRITE' ? 'Uploading...' : 'Uploading and analysing...';
  }

  selectSource(event: Event): void {
    this.source.set((event.target as HTMLSelectElement).value as HistoricalImportSource);
    this.selectedFile.set(null);
    this.validationError.set(null);
    this.uploadError.set(null);
  }

  selectFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0) ?? null;
    this.validationError.set(this.fileError(file));
    this.uploadError.set(null);
    this.selectedFile.set(this.validationError() ? null : file);
  }

  submit(): void {
    if (this.uploading()) return;
    const file = this.selectedFile();
    const fileError = this.fileError(file);
    if (fileError) {
      this.validationError.set(fileError);
      return;
    }

    this.uploading.set(true);
    this.uploadError.set(null);
    const upload = this.source() === 'EVENTBRITE'
      ? this.service.uploadEventbrite(file!)
      : this.service.uploadMembershipForm(file!);
    upload.pipe(finalize(() => this.uploading.set(false))).subscribe({
      next: (batch) => {
        this.selectedFile.set(null);
        this.validationError.set(null);
        this.completed.emit(batch);
      },
      error: (error: HttpErrorResponse) => this.uploadError.set(this.messageForUploadError(error)),
    });
  }

  private fileError(file: File | null): string | null {
    if (!file) return 'Choose a valid .xlsx workbook.';
    if (!file.name.toLowerCase().endsWith('.xlsx')) return 'Choose a valid .xlsx workbook.';
    if (file.size <= 0) return 'The workbook cannot be empty.';
    if (file.size > MAX_UPLOAD_BYTES) return 'The workbook must be 10 MB or smaller.';
    return null;
  }

  private messageForUploadError(error: HttpErrorResponse): string {
    if (error.status === 400) return `This file does not match the expected ${this.source() === 'EVENTBRITE' ? 'Eventbrite' : 'Membership Form'} structure.`;
    if (error.status === 403) return 'You do not have permission to import historical data.';
    if (error.status === 401) return 'Your session has expired. Sign in again to import historical data.';
    return 'The historical import could not be processed right now.';
  }
}
