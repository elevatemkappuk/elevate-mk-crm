import { describe, expect, it } from 'vitest';

import { importBatchStatusLabel } from './import-batch-status';

describe('import batch status labels', () => {
  it('renders every canonical lifecycle status as a human-readable label', () => {
    expect(importBatchStatusLabel('PROCESSING')).toBe('Processing');
    expect(importBatchStatusLabel('READY_FOR_REVIEW')).toBe('Ready for Review');
    expect(importBatchStatusLabel('READY_FOR_IMPORT')).toBe('Ready for Import');
    expect(importBatchStatusLabel('IMPORTED')).toBe('Imported');
    expect(importBatchStatusLabel('FAILED')).toBe('Failed');
  });

  it('keeps unexpected defensive values displayable without treating them as canonical', () => {
    expect(importBatchStatusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
  });
});
