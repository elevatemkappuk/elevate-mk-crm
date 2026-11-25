import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';

import { API_CONFIG } from '../http/api-config';
import { AuthenticatedUser } from './auth.types';
import { StaffAccessProjection, StaffAccessState, StaffCapabilityCode } from './staff-access.types';

// The API owns the disclosure policy. Keep this client registry aligned with
// the approved, intentionally narrow CRM projection allowlist.
const CRM_DISCLOSED_CAPABILITY_CODES: ReadonlySet<string> = new Set([
  'STAFF_CAPABILITY_ADMIN',
  'PRIVACY_AUDIT_READ',
  'LEGAL_HOLD_ADMIN',
]);
const EMPTY_CAPABILITY_CODES: readonly string[] = Object.freeze([]);

const INITIAL_STATE: StaffAccessState = freezeState({
  status: 'idle',
  projection: null,
  error: null,
});

interface InFlightRequest {
  readonly accountId: number;
  readonly epoch: number;
  readonly request$: Observable<StaffAccessProjection>;
}

@Injectable({ providedIn: 'root' })
export class StaffAccessService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  private readonly stateState = signal<StaffAccessState>(INITIAL_STATE);
  private accountId: number | null = null;
  private epoch = 0;
  private inFlight: InFlightRequest | null = null;

  readonly state = this.stateState.asReadonly();
  readonly status = computed(() => this.state().status);
  readonly projection = computed(() => this.state().projection);
  readonly capabilityCodes = computed<readonly string[]>(() => this.projection()?.capability_codes ?? EMPTY_CAPABILITY_CODES);
  readonly policyVersion = computed<number | null>(() => this.projection()?.policy_version ?? null);
  readonly isReady = computed(() => this.status() === 'ready');

  refresh(user: AuthenticatedUser | null): Observable<StaffAccessProjection | null> {
    if (!user) {
      this.clearUnauthenticated();
      return of(null);
    }

    this.selectAccount(user.id);

    if (!hasCrmRole(user)) {
      this.invalidate('forbidden', 'Staff CRM access is not assigned.');
      return of(null);
    }

    const existing = this.inFlight;
    if (existing && existing.accountId === user.id && existing.epoch === this.epoch) {
      return existing.request$;
    }

    const requestEpoch = this.epoch;
    this.setState('loading');

    const request$ = this.http.get<unknown>(`${this.apiConfig.apiBaseUrl}/staff/access/me/`).pipe(
      map((response) => validateProjection(response)),
      tap((projection) => {
        if (this.isCurrent(user.id, requestEpoch)) {
          this.stateState.set(freezeState({ status: 'ready', projection, error: null }));
        }
      }),
      catchError((error: { status?: number }) => {
        if (this.isCurrent(user.id, requestEpoch)) {
          if (error.status === 401) {
            this.setState('unauthenticated');
          } else if (error.status === 403) {
            this.setState('forbidden', 'Staff CRM access is not assigned.');
          } else {
            this.setState('error', 'Staff access could not be loaded.');
          }
        }
        return throwError(() => error);
      }),
      finalize(() => {
        if (this.inFlight?.accountId === user.id && this.inFlight.epoch === requestEpoch) {
          this.inFlight = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

    this.inFlight = { accountId: user.id, epoch: requestEpoch, request$ };
    return request$;
  }

  hasCapability(code: string): boolean {
    return this.isReady() && this.capabilityCodes().includes(code);
  }

  selectAccount(accountId: number): void {
    if (this.accountId === accountId) {
      return;
    }

    this.accountId = accountId;
    this.invalidate('idle');
  }

  clearUnauthenticated(): void {
    this.accountId = null;
    this.invalidate('unauthenticated');
  }

  private invalidate(status: StaffAccessState['status'], error: string | null = null): void {
    this.epoch += 1;
    this.inFlight = null;
    this.stateState.set(freezeState({ status, projection: null, error }));
  }

  private setState(status: StaffAccessState['status'], error: string | null = null): void {
    this.stateState.set(freezeState({ status, projection: null, error }));
  }

  private isCurrent(accountId: number, requestEpoch: number): boolean {
    return this.accountId === accountId && this.epoch === requestEpoch;
  }
}

function hasCrmRole(user: AuthenticatedUser): boolean {
  return user.staff_roles.some((role) =>
    role === 'CRM_ADMIN' || role === 'CRM_MANAGER' || role === 'CRM_VIEWER',
  );
}

function validateProjection(value: unknown): StaffAccessProjection {
  if (!isRecord(value) || Object.keys(value).sort().join('|') !== 'capability_codes|policy_version') {
    throw new Error('Invalid staff access response shape.');
  }

  const codes = value['capability_codes'];
  const policyVersion = value['policy_version'];
  if (!Array.isArray(codes) || !codes.every((code): code is StaffCapabilityCode => typeof code === 'string' && code.length > 0)) {
    throw new Error('Invalid staff access capability projection.');
  }
  if (new Set(codes).size !== codes.length || codes.some((code) => !CRM_DISCLOSED_CAPABILITY_CODES.has(code))) {
    throw new Error('Unknown staff access capability.');
  }
  if (typeof policyVersion !== 'number' || !Number.isSafeInteger(policyVersion) || policyVersion < 0) {
    throw new Error('Invalid staff access policy version.');
  }

  return Object.freeze({
    capability_codes: Object.freeze([...codes].sort()),
    policy_version: policyVersion,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function freezeState(state: StaffAccessState): StaffAccessState {
  return Object.freeze(state);
}
