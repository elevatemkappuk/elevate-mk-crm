import { HttpErrorResponse } from '@angular/common/http';

import { formatForbiddenError } from './forbidden-error';

describe('formatForbiddenError', () => {
  it('uses a generic security message for CSRF failures', () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: { detail: "CSRF Failed: CSRF token from the 'X-Csrftoken' HTTP header incorrect." },
    });

    expect(formatForbiddenError(error, 'You no longer have permission to manage People.'))
      .toBe('Your secure session could not be verified. Please try again.');
  });

  it('preserves the authorization message for genuine role denials', () => {
    const error = new HttpErrorResponse({
      status: 403,
      error: { detail: 'You do not have permission to perform this action.' },
    });

    expect(formatForbiddenError(error, 'You no longer have permission to manage People.'))
      .toBe('You no longer have permission to manage People.');
  });
});
