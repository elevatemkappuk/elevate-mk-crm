import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../http/api-config';
import { PaginatedPrivacyAuditHistoryResponse, PrivacyAuditHistoryQuery } from './privacy-audit.types';

@Injectable({ providedIn: 'root' })
export class PrivacyAuditService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  getPersonHistory(
    personId: number,
    query: PrivacyAuditHistoryQuery = {},
  ): Observable<PaginatedPrivacyAuditHistoryResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http.get<PaginatedPrivacyAuditHistoryResponse>(
      `${this.apiConfig.apiBaseUrl}/people/${personId}/privacy-audit-history/`,
      { params },
    );
  }
}
