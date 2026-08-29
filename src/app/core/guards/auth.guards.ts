import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../auth/auth.service';

function redirectTo(url: string): UrlTree {
  return inject(Router).createUrlTree([url]);
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);

  if (!auth.authInitialized()) {
    return true;
  }

  return auth.isAuthenticated() ? true : redirectTo('/login');
};

export const staffAccessGuard: CanActivateFn = () => {
  const auth = inject(AuthService);

  if (!auth.authInitialized()) {
    return true;
  }

  if (!auth.isAuthenticated()) {
    return redirectTo('/login');
  }

  return auth.hasStaffAccess() ? true : redirectTo('/access-denied');
};

export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);

  if (!auth.authInitialized()) {
    return true;
  }

  if (!auth.isAuthenticated()) {
    return true;
  }

  return auth.hasStaffAccess() ? redirectTo('/') : redirectTo('/access-denied');
};
