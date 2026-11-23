import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../http/api-config';
import { ModerationReport, ModerationReportPage } from './community-moderation.types';

@Injectable({ providedIn: 'root' })
export class CommunityModerationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_CONFIG).apiBaseUrl}/community/moderation/reports`;

  list(page = 1, pageSize = 25): Observable<ModerationReportPage> {
    return this.http.get<ModerationReportPage>(`${this.baseUrl}/`, { params: { page, page_size: pageSize } });
  }

  get(reportId: string): Observable<ModerationReport> {
    return this.http.get<ModerationReport>(`${this.baseUrl}/${encodeURIComponent(reportId)}/`);
  }

  action(reportId: string, action: 'dismiss' | 'remove' | 'restore', resolution = ''): Observable<ModerationReport> {
    return this.http.post<ModerationReport>(`${this.baseUrl}/${encodeURIComponent(reportId)}/${action}/`, { resolution });
  }
}

