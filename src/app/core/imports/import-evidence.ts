const labels: Record<string, string> = {
  EXACT_EMAIL: 'Exact email',
  EXACT_MOBILE: 'Exact mobile',
  NAME_CONFLICT: 'Name differs',
  MOBILE_CONFLICT: 'Mobile differs',
  UNIQUE_EMAIL_WITH_CONTRADICTION: 'Exact email, conflicting evidence',
  MOBILE_ONLY_MATCH: 'Exact mobile only',
  MULTIPLE_STRONG_CANDIDATES: 'Multiple possible CRM matches',
};

export function importEvidenceLabel(code: string | null): string {
  return code ? (labels[code] ?? code.replaceAll('_', ' ').toLowerCase()) : 'Identity review required';
}
