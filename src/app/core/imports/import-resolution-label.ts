import { ImportRecordPreview } from './import-reconciliation.types';

export interface ImportResolutionLabel {
  title: string;
  detail: string;
}

export function importResolutionLabel(record: ImportRecordPreview): ImportResolutionLabel {
  if (record.status === 'COMMITTED') return { title: 'Added to CRM', detail: 'Added to the CRM.' };
  if (record.status === 'INVALID') return { title: 'Invalid', detail: 'Will not be added to the CRM.' };
  if (record.status === 'REVIEW_REQUIRED') return { title: 'Needs review', detail: 'A staff identity decision is required.' };
  if (record.resolution_method === 'AUTO_MATCH') return { title: 'Auto matched', detail: 'Existing person selected by analysis.' };
  if (record.resolution_method === 'STAFF_MATCH') return { title: 'Matched by staff', detail: 'Existing person selected by staff.' };
  if (record.resolution_method === 'NO_MATCH') return { title: 'New person', detail: 'A new CRM Person will be created.' };
  if (record.resolution_method === 'STAFF_CREATE_NEW') return { title: 'New person', detail: 'A new CRM Person will be created.' };
  return { title: 'Awaiting analysis', detail: 'No final identity decision is available yet.' };
}
