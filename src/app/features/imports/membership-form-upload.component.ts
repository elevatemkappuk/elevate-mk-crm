import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { ImportReconciliationService } from '../../core/imports/import-reconciliation.service';
import { ImportBatchSummary } from '../../core/imports/import-reconciliation.types';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-membership-form-upload',
  template: `
    <section class="upload-panel" aria-labelledby="membership-upload-title">
      <div>
        <h3 id="membership-upload-title">Import historical data</h3>
        <p>Stage and analyse a Membership Form workbook. This does not commit CRM data.</p>
      </div>

      <div class="field">
        <span class="label">Source</span>
        <strong>Membership Form</strong>
      </div>

      <label class="field" for="membership-form-file">
        <span class="label">File</span>
        <input id="membership-form-file" type="file" accept=".xlsx" [disabled]="uploading()" (change)="selectFile($event)" />
        <small>Accepted: .xlsx. Maximum size: 10 MB.</small>
      </label>

      @if (selectedFile()) { <p class="selected-file">Selected: {{ selectedFile()!.name }}</p> }
      @if (validationError()) { <p class="error" role="alert">{{ validationError() }}</p> }
      @if (uploadError()) { <p class="error" role="alert">{{ uploadError() }}</p> }

      <div class="actions">
        <button type="button" class="button-primary" [disabled]="uploading()" (click)="submit()">
          {{ uploading() ? 'Uploading and analysing...' : 'Import & analyse' }}
        </button>
        <button type="button" class="button-secondary" [disabled]="uploading()" (click)="cancelled.emit()">Cancel</button>
      </div>
    </section>
  `,
  styles: `
    .upload-panel { display: grid; gap: 1rem; padding: 1.15rem; border: 1px solid rgba(22,39,53,.1); border-radius: 1rem; background: #fff; }
    h3, p { margin: 0; } h3 { color: #173248; } p, small { color: #526f81; }
    .field { display: grid; gap: .4rem; color: #294456; font-weight: 650; }
    .label { font-size: .82rem; color: #526f81; font-weight: 700; }
    input { max-width: 30rem; padding: .6rem; border: 1px solid #b7c7d4; border-radius: .7rem; font: inherit; }
    .selected-file { color: #173248; font-weight: 600; }.error { color: #9b1c1c; font-weight: 600; }
    .actions { display: flex; flex-wrap: wrap; gap: .7rem; }
    button { border: 0; border-radius: 999px; padding: .72rem 1.1rem; font: inherit; font-weight: 700; cursor: pointer; }
    .button-primary { color: #fff; background: #1d6077; }.button-secondary { color: #244359; background: #edf3f6; }
    button:disabled, input:disabled { cursor: not-allowed; opacity: .6; }
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

  selectFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0) ?? null;
    this.validationError.set(this.fileError(file));
    this.uploadError.set(null);
    this.selectedFile.set(this.validationError() ? null : file);
  }

  submit(): void {
    const file = this.selectedFile();
    const fileError = this.fileError(file);
    if (fileError) {
      this.validationError.set(fileError);
      return;
    }

    this.uploading.set(true);
    this.uploadError.set(null);
    this.service.uploadMembershipForm(file!).pipe(finalize(() => this.uploading.set(false))).subscribe({
      next: (batch) => {
        this.selectedFile.set(null);
        this.validationError.set(null);
        this.completed.emit(batch);
      },
      error: (error: HttpErrorResponse) => this.uploadError.set(this.messageForUploadError(error)),
    });
  }

  private fileError(file: File | null): string | null {
    if (!file) return 'Choose a valid .xlsx Membership Form workbook.';
    if (!file.name.toLowerCase().endsWith('.xlsx')) return 'Choose a valid .xlsx Membership Form workbook.';
    if (file.size <= 0) return 'The workbook cannot be empty.';
    if (file.size > MAX_UPLOAD_BYTES) return 'The workbook must be 10 MB or smaller.';
    return null;
  }

  private messageForUploadError(error: HttpErrorResponse): string {
    if (error.status === 400) return 'This file does not match the expected Membership Form structure.';
    if (error.status === 403) return 'You do not have permission to import historical data.';
    if (error.status === 401) return 'Your session has expired. Sign in again to import historical data.';
    return 'The historical import could not be processed right now.';
  }
}
