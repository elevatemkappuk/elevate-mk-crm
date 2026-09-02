export type ImportBatchStatus =
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'READY_FOR_IMPORT'
  | 'IMPORTED'
  | 'FAILED';

const IMPORT_BATCH_STATUS_LABELS: Readonly<Record<ImportBatchStatus, string>> = {
  PROCESSING: 'Processing',
  READY_FOR_REVIEW: 'Ready for Review',
  READY_FOR_IMPORT: 'Ready to add to CRM',
  IMPORTED: 'Imported',
  FAILED: 'Failed',
};

export function importBatchStatusLabel(status: string): string {
  return IMPORT_BATCH_STATUS_LABELS[status as ImportBatchStatus] ?? status;
}

export function isReviewableImportBatch(status: ImportBatchStatus): boolean {
  return status === 'READY_FOR_REVIEW';
}
