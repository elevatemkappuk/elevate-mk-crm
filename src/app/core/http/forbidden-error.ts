import { HttpErrorResponse } from '@angular/common/http';

const CSRF_FAILURE_MESSAGE = 'Your secure session could not be verified. Please try again.';

export function formatForbiddenError(error: HttpErrorResponse, authorizationMessage: string): string {
  if (isCsrfFailure(error)) {
    return CSRF_FAILURE_MESSAGE;
  }

  return authorizationMessage;
}

function isCsrfFailure(error: HttpErrorResponse): boolean {
  if (error.status !== 403) {
    return false;
  }

  const payload = error.error;
  const detail = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)['detail']
    : undefined;
  const code = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)['code']
    : undefined;

  return [detail, code].some((value) => typeof value === 'string' && /csrf/i.test(value));
}
