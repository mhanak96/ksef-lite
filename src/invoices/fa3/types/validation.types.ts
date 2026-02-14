export type IssueSeverity = 'error' | 'warning';

export type ValidationIssue = {
  severity: IssueSeverity;
  code: string; // np. "REQUIRED", "INVALID_NIP", "OUT_OF_RANGE"
  path: string; // np. "seller.nip", "details.items[0].vatRate"
  message: string; // czytelny komunikat
  builder?: string; // np. "SubjectBuilder"
};

export type BuildResult = {
  xml: string;
  issues: ValidationIssue[];
};
