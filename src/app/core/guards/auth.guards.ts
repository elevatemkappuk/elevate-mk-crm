import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../auth/auth.service';

function redirectTo(url: string): UrlTree {
  return inject(Router).createUrlTree([url]);
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const user = auth.currentUser();

  if (!auth.authInitialized()) {
    return true;
  }

  return user ? true : redirectTo('/login');
};

export const staffAccessGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const user = auth.currentUser();

  if (!auth.authInitialized()) {
    return true;
  }

  if (!user) {
    return redirectTo('/login');
  }

  return auth.getAuthorizedRoute(user) === '/' ? true : redirectTo('/access-denied');
};

export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const user = auth.currentUser();

  if (!auth.authInitialized()) {
    return true;
  }

  if (!user) {
    return true;
  }

  return redirectTo(auth.getAuthorizedRoute(user));
};

export const administrationGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const user = auth.currentUser();

  if (!auth.authInitialized()) {
    return true;
  }

  if (!user) {
    return redirectTo('/login');
  }

  if (!auth.hasStaffAccess()) {
    return redirectTo('/access-denied');
  }

  return auth.canAccessAdministration(user) ? true : redirectTo('/access-denied');
};
