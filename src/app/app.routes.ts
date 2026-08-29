import { Routes } from '@angular/router';

import {
  administrationGuard,
  authGuard,
  loginGuard,
  staffAccessGuard,
} from './core/guards/auth.guards';
import { AccessDeniedPageComponent } from './features/auth/access-denied-page.component';
import { LoginPageComponent } from './features/auth/login-page.component';
import { StaffCrmShellPageComponent } from './features/auth/staff-crm-shell-page.component';
import { AdministrationPageComponent } from './features/administration/administration-page.component';
import { PersonDetailPageComponent } from './features/people/person-detail-page.component';
import { PeoplePageComponent } from './features/people/people-page.component';

export const routes: Routes = [
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
    path: '',
    component: StaffCrmShellPageComponent,
    canActivate: [authGuard, staffAccessGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'people',
      },
      {
        path: 'people',
        component: PeoplePageComponent,
      },
      {
        path: 'people/:id',
        component: PersonDetailPageComponent,
      },
      {
        path: 'administration',
        component: AdministrationPageComponent,
        canActivate: [administrationGuard],
      },
      {
        path: '**',
        redirectTo: 'people',
      },
    ],
  },
];
