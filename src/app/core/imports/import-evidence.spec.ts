import { describe, expect, it } from 'vitest';

import { importEvidenceLabel } from './import-evidence';

describe('importEvidenceLabel', () => {
  it('maps stable backend evidence codes to staff-readable labels', () => {
    expect(importEvidenceLabel('EXACT_EMAIL')).toBe('Exact email');
    expect(importEvidenceLabel('EXACT_MOBILE')).toBe('Exact mobile');
    expect(importEvidenceLabel('NAME_CONFLICT')).toBe('Name differs');
    expect(importEvidenceLabel('MOBILE_CONFLICT')).toBe('Mobile differs');
  });

  it('uses a safe generic label when the backend has no evidence code', () => {
    expect(importEvidenceLabel(null)).toBe('Identity review required');
  });
});
