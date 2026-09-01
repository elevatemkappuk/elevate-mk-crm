import { ImportRecordPreview } from './import-reconciliation.types';

export interface ImportResolutionLabel {
  title: string;
  detail: string;
}

export function importResolutionLabel(record: ImportRecordPreview): ImportResolutionLabel {
  if (record.status === 'COMMITTED') return { title: 'Committed', detail: 'Committed in a previous import run.' };
  if (record.status === 'INVALID') return { title: 'Invalid', detail: 'Cannot be committed.' };
  if (record.status === 'REVIEW_REQUIRED') return { title: 'Needs review', detail: 'A staff identity decision is required.' };
  if (record.resolution_method === 'AUTO_MATCH') return { title: 'Auto matched', detail: 'Existing person selected by analysis.' };
  if (record.resolution_method === 'STAFF_MATCH') return { title: 'Matched by staff', detail: 'Existing person selected by staff.' };
  if (record.resolution_method === 'NO_MATCH') return { title: 'New person', detail: 'Will be created at commit.' };
  if (record.resolution_method === 'STAFF_CREATE_NEW') return { title: 'New person', detail: 'Confirmed by staff.' };
  return { title: 'Awaiting analysis', detail: 'No final identity decision is available yet.' };
}
