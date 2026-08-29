import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { API_CONFIG } from '../http/api-config';
import { hasStaffCrmAccess } from './auth-access';
import { AuthenticatedUser, CsrfBootstrapResponse, LoginCredentials } from './auth.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  private readonly currentUserState = signal<AuthenticatedUser | null>(null);
  private readonly initializedState = signal(false);

  readonly currentUser = this.currentUserState.asReadonly();
  readonly authInitialized = this.initializedState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly hasStaffAccess = computed(() => hasStaffCrmAccess(this.currentUser()));

  async initialize(): Promise<void> {
    await firstValueFrom(
      this.loadCurrentUser().pipe(
        catchError(() => of(null)),
        map(() => void 0),
      ),
    );
    this.initializedState.set(true);
  }

  bootstrapCsrf(): Observable<CsrfBootstrapResponse> {
    return this.http.get<CsrfBootstrapResponse>(this.buildUrl('/auth/csrf/'));
  }

  login(credentials: LoginCredentials): Observable<AuthenticatedUser> {
    const payload = {
      email: normalizeEmail(credentials.email),
      password: credentials.password,
    };

    return this.bootstrapCsrf().pipe(
      switchMap(() =>
        this.http.post<AuthenticatedUser>(this.buildUrl('/auth/login/'), payload).pipe(
          tap((user) => this.setAuthenticatedUser(user)),
        ),
      ),
    );
  }

  loadCurrentUser(): Observable<AuthenticatedUser | null> {
    return this.http.get<AuthenticatedUser>(this.buildUrl('/auth/me/')).pipe(
      tap((user) => this.setAuthenticatedUser(user)),
      catchError((error: { status?: number }) => {
        if (error.status === 401) {
          this.clearUserState();
          return of(null);
        }

        throw error;
      }),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(this.buildUrl('/auth/logout/'), null).pipe(
      tap(() => this.clearUserState()),
    );
  }

  setAuthenticatedUser(user: AuthenticatedUser): void {
    this.currentUserState.set(normalizeAuthenticatedUser(user));
  }

  clearUserState(): void {
    this.currentUserState.set(null);
  }

  getAuthorizedRoute(user: AuthenticatedUser | null = this.currentUser()): string {
    if (!user) {
      return '/login';
    }

    return hasStaffCrmAccess(user) ? '/' : '/access-denied';
  }

  setCurrentUserForTest(user: AuthenticatedUser | null): void {
    this.currentUserState.set(user ? normalizeAuthenticatedUser(user) : null);
  }

  private buildUrl(path: string): string {
    return `${this.apiConfig.apiBaseUrl}${path}`;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeAuthenticatedUser(user: AuthenticatedUser): AuthenticatedUser {
  return {
    ...user,
    staff_roles: Array.isArray(user.staff_roles) ? user.staff_roles : [],
  };
}
