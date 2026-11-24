import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { API_CONFIG } from '../http/api-config';
import { clearCsrfToken, setCsrfToken } from '../http/auth-http.interceptors';
import { hasStaffCrmAccess, isCrmAdmin } from './auth-access';
import { AuthenticatedUser, CsrfBootstrapResponse, DetailResponse, LoginCredentials, PasswordResetConfirmRequest, PasswordResetRequest } from './auth.types';
import { StaffAccessService } from './staff-access.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly staffAccess = inject(StaffAccessService);

  private readonly currentUserState = signal<AuthenticatedUser | null>(null);
  private readonly initializedState = signal(false);
  private readonly sessionExpiredMessageState = signal<string | null>(null);
  private sessionExpiryHandled = false;

  readonly currentUser = this.currentUserState.asReadonly();
  readonly authInitialized = this.initializedState.asReadonly();
  readonly sessionExpiredMessage = this.sessionExpiredMessageState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly hasStaffAccess = computed(() => hasStaffCrmAccess(this.currentUser()));
  readonly isCrmAdmin = computed(() => isCrmAdmin(this.currentUser()));
  readonly hasPrivacyAdministration = computed(() => this.staffAccess.hasCapability('STAFF_CAPABILITY_ADMIN'));

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
    return this.http.get<CsrfBootstrapResponse>(this.buildUrl('/auth/csrf/')).pipe(
      tap(({ csrf_token }) => setCsrfToken(csrf_token)),
    );
  }

  login(credentials: LoginCredentials): Observable<AuthenticatedUser> {
    this.sessionExpiryHandled = false;
    this.sessionExpiredMessageState.set(null);
    const payload = {
      email: normalizeEmail(credentials.email),
      password: credentials.password,
    };

    return this.bootstrapCsrf().pipe(
      switchMap(() =>
        this.http.post<AuthenticatedUser>(this.buildUrl('/auth/login/'), payload),
      ),
      switchMap((user) => {
        const normalizedUser = normalizeAuthenticatedUser(user);

        return this.bootstrapCsrf().pipe(
          tap(() => this.setAuthenticatedUser(normalizedUser)),
          switchMap(() => this.refreshStaffAccess(normalizedUser)),
        );
      }),
    );
  }

  loadCurrentUser(): Observable<AuthenticatedUser | null> {
    return this.http.get<AuthenticatedUser>(this.buildUrl('/auth/me/')).pipe(
      tap((user) => this.setAuthenticatedUser(user)),
      switchMap((user) => this.refreshStaffAccess(user)),
      catchError((error: { status?: number }) => {
        if (error.status === 401) {
          this.clearUserState();
          clearCsrfToken();
          return of(null);
        }

        throw error;
      }),
    );
  }

  logout(): Observable<void> {
    return this.bootstrapCsrf().pipe(
      switchMap(() => this.http.post<void>(this.buildUrl('/auth/logout/'), null)),
      tap(() => {
        this.clearUserState();
        clearCsrfToken();
      }),
      catchError((error) => {
        this.clearUserState();
        clearCsrfToken();
        return throwError(() => error);
      }),
    );
  }

  requestPasswordReset(request: PasswordResetRequest): Observable<DetailResponse> {
    return this.bootstrapCsrf().pipe(switchMap(() => this.http.post<DetailResponse>(
      this.buildUrl('/auth/password-reset/'), { email: normalizeEmail(request.email) },
    )));
  }

  confirmPasswordReset(request: PasswordResetConfirmRequest): Observable<DetailResponse> {
    return this.bootstrapCsrf().pipe(switchMap(() => this.http.post<DetailResponse>(
      this.buildUrl('/auth/password-reset/confirm/'), request,
    )));
  }

  setAuthenticatedUser(user: AuthenticatedUser): void {
    const normalizedUser = normalizeAuthenticatedUser(user);
    this.staffAccess.selectAccount(normalizedUser.id);
    this.currentUserState.set(normalizedUser);
  }

  clearUserState(): void {
    this.staffAccess.clearUnauthenticated();
    this.currentUserState.set(null);
  }

  handleSessionExpired(): boolean {
    if (this.sessionExpiryHandled) {
      return false;
    }

    this.sessionExpiryHandled = true;
    this.clearUserState();
    clearCsrfToken();
    this.sessionExpiredMessageState.set(
      'Your staff session expired. Sign in again to continue. Unsaved changes may not have been saved.',
    );
    return true;
  }

  getAuthorizedRoute(user: AuthenticatedUser | null = this.currentUser()): string {
    if (!user) {
      return '/login';
    }

    return hasStaffCrmAccess(user) ? '/' : '/access-denied';
  }

  canAccessAdministration(user: AuthenticatedUser | null = this.currentUser()): boolean {
    return isCrmAdmin(user);
  }

  setCurrentUserForTest(user: AuthenticatedUser | null): void {
    this.currentUserState.set(user ? normalizeAuthenticatedUser(user) : null);
  }

  private buildUrl(path: string): string {
    return `${this.apiConfig.apiBaseUrl}${path}`;
  }

  private refreshStaffAccess(user: AuthenticatedUser): Observable<AuthenticatedUser> {
    return this.staffAccess.refresh(user).pipe(
      map(() => user),
      catchError((error: { status?: number }) =>
        error.status === 401 ? throwError(() => error) : of(user),
      ),
    );
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
