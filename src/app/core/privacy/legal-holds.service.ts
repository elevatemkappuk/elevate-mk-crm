import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { API_CONFIG } from '../http/api-config';
import {
  CreateLegalHoldRequest,
  LegalHold,
  LegalHoldReleaseRequestResult,
  PaginatedLegalHoldsResponse,
} from './legal-hold.types';

@Injectable({ providedIn: 'root' })
export class LegalHoldsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly baseUrl = `${this.apiConfig.apiBaseUrl}/privacy`;

  list(personId?: number): Observable<PaginatedLegalHoldsResponse> {
    const params = personId ? new HttpParams().set('person_id', String(personId)) : undefined;
    return this.http.get<PaginatedLegalHoldsResponse | readonly LegalHold[]>(`${this.baseUrl}/legal-holds/`, { params }).pipe(
      map(response => Array.isArray(response)
        ? { count: response.length, next: null, previous: null, results: response as readonly LegalHold[] }
        : response as PaginatedLegalHoldsResponse),
    );
  }

  get(publicId: string): Observable<LegalHold> {
    return this.http.get<LegalHold>(`${this.baseUrl}/legal-holds/${publicId}/`);
  }

  create(request: CreateLegalHoldRequest): Observable<LegalHold> {
    return this.http.post<LegalHold>(`${this.baseUrl}/legal-holds/`, request);
  }

  requestRelease(publicId: string, reason: string): Observable<LegalHoldReleaseRequestResult> {
    return this.http.post<LegalHoldReleaseRequestResult>(
      `${this.baseUrl}/legal-holds/${publicId}/release-requests/`,
      { reason },
    );
  }

  approveRelease(requestId: string, reason: string): Observable<LegalHold> {
    return this.http.post<LegalHold>(
      `${this.apiConfig.apiBaseUrl}/privacy/legal-hold-release-requests/${requestId}/approve/`,
      { reason },
    );
  }

  rejectRelease(requestId: string, reason: string): Observable<LegalHoldReleaseRequestResult> {
    return this.http.post<LegalHoldReleaseRequestResult>(
      `${this.apiConfig.apiBaseUrl}/privacy/legal-hold-release-requests/${requestId}/reject/`,
      { reason },
    );
  }

  cancelRelease(requestId: string, reason: string): Observable<LegalHoldReleaseRequestResult> {
    return this.http.post<LegalHoldReleaseRequestResult>(
      `${this.apiConfig.apiBaseUrl}/privacy/legal-hold-release-requests/${requestId}/cancel/`,
      { reason },
    );
  }

  directRelease(publicId: string, reason: string): Observable<LegalHold> {
    return this.http.post<LegalHold>(
      `${this.baseUrl}/legal-holds/${publicId}/direct-release/`,
      { reason },
    );
  }
}
