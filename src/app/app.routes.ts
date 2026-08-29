import { Routes } from '@angular/router';

import { authGuard, loginGuard, staffAccessGuard } from './core/guards/auth.guards';
import { AccessDeniedPageComponent } from './features/auth/access-denied-page.component';
import { LoginPageComponent } from './features/auth/login-page.component';
import { StaffCrmShellPageComponent } from './features/auth/staff-crm-shell-page.component';

export const routes: Routes = [
  {
    path: '',
    component: StaffCrmShellPageComponent,
    canActivate: [authGuard, staffAccessGuard],
  },
  {
    path: 'login',
    component: LoginPageComponent,
    canActivate: [loginGuard],
  },
  {
    path: 'access-denied',
    component: AccessDeniedPageComponent,
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
