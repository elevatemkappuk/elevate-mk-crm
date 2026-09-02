import { describe, expect, it } from 'vitest';

import { ImportRecordPreview } from './import-reconciliation.types';
import { importResolutionLabel } from './import-resolution-label';

function record(status: string, resolutionMethod: string | null): ImportRecordPreview {
  return {
    id: 1, source_row_identifier: 'row-1', status, resolution_method: resolutionMethod, resolution_reason: null,
    resolved_person: null,
    source: { first_name: 'Amara', last_name: 'Owusu', email: 'amara@example.com', mobile: '', location: '', industry: '', job_title: '', linkedin_url: '' },
    reviewed_at: null, committed_at: null,
  };
}

describe('importResolutionLabel', () => {
  it('uses authoritative resolution methods for match and new CRM Person decisions', () => {
    expect(importResolutionLabel(record('RESOLVED', 'AUTO_MATCH')).title).toBe('Auto matched');
    expect(importResolutionLabel(record('RESOLVED', 'STAFF_MATCH')).title).toBe('Matched by staff');
    expect(importResolutionLabel(record('RESOLVED', 'NO_MATCH')).detail).toBe('A new CRM Person will be created.');
    expect(importResolutionLabel(record('RESOLVED', 'STAFF_CREATE_NEW')).detail).toBe('A new CRM Person will be created.');
  });

  it('prioritizes record state for review, invalid, and previously added records', () => {
    expect(importResolutionLabel(record('REVIEW_REQUIRED', null)).title).toBe('Needs review');
    expect(importResolutionLabel(record('INVALID', null)).title).toBe('Invalid');
    expect(importResolutionLabel(record('INVALID', null)).detail).toBe('Will not be added to the CRM.');
    expect(importResolutionLabel(record('COMMITTED', 'NO_MATCH')).title).toBe('Added to CRM');
  });
});
