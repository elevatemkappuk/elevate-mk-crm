import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../http/api-config';
import { AudiencePreviewRequest, AudiencePreviewResponse } from './audience.types';

@Injectable({ providedIn: 'root' })
export class AudiencePreviewService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  preview(request: AudiencePreviewRequest): Observable<AudiencePreviewResponse> {
    return this.http.post<AudiencePreviewResponse>(
      `${this.apiConfig.apiBaseUrl}/marketing/audiences/preview/`,
      request,
    );
  }
}
