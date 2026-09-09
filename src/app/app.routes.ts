import { Routes } from '@angular/router';

import {
  administrationGuard,
  authGuard,
  loginGuard,
  staffAccessGuard,
} from './core/guards/auth.guards';
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page.component').then((module) => module.LoginPageComponent),
    canActivate: [loginGuard],
  },
  { path: 'forgot-password', loadComponent: () => import('./features/auth/forgot-password-page.component').then((module) => module.ForgotPasswordPageComponent) },
  { path: 'reset-password/:uid/:token', loadComponent: () => import('./features/auth/reset-password-page.component').then((module) => module.ResetPasswordPageComponent) },
  {
    path: 'access-denied',
    loadComponent: () => import('./features/auth/access-denied-page.component').then((module) => module.AccessDeniedPageComponent),
    canActivate: [authGuard],
  },
  {
    path: '',
    loadComponent: () => import('./features/auth/staff-crm-shell-page.component').then((module) => module.StaffCrmShellPageComponent),
    canActivate: [authGuard, staffAccessGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'people',
      },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard-page.component').then(module => module.DashboardPageComponent) },
      {
        path: 'people',
        loadComponent: () => import('./features/people/people-page.component').then((module) => module.PeoplePageComponent),
      },
      {
        path: 'people/new/member',
        loadComponent: () => import('./features/people/person-write-page.component').then((module) => module.PersonWritePageComponent),
        data: { mode: 'member' },
      },
      {
        path: 'people/new/contact',
        loadComponent: () => import('./features/people/person-write-page.component').then((module) => module.PersonWritePageComponent),
        data: { mode: 'contact' },
      },
      {
        path: 'people/:id/edit',
        loadComponent: () => import('./features/people/person-write-page.component').then((module) => module.PersonWritePageComponent),
        data: { mode: 'edit' },
      },
      {
        path: 'people/:id',
        loadComponent: () => import('./features/people/person-detail-page.component').then((module) => module.PersonDetailPageComponent),
      },
      {
        path: 'administration',
        loadComponent: () => import('./features/administration/administration-page.component').then((module) => module.AdministrationPageComponent),
        canActivate: [administrationGuard],
      },
      {
        path: 'imports',
        loadComponent: () => import('./features/imports/historical-imports-page.component').then((module) => module.HistoricalImportsPageComponent),
        canActivate: [administrationGuard],
      },
      {
        path: 'imports/:id',
        loadComponent: () => import('./features/imports/import-batch-page.component').then((module) => module.ImportBatchPageComponent),
        canActivate: [administrationGuard],
      },
      {
        path: 'imports/:id/review/:recordId',
        loadComponent: () => import('./features/imports/import-review-page.component').then((module) => module.ImportReviewPageComponent),
        canActivate: [administrationGuard],
      },
      {
        path: '**',
        redirectTo: 'people',
      },
    ],
  },
];
