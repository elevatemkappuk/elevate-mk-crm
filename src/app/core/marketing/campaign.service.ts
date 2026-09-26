import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../http/api-config';
import {
  Campaign,
  CampaignCreateRequest,
  CampaignPage,
  CampaignRecipientPage,
} from './campaign.types';

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly baseUrl = `${this.apiConfig.apiBaseUrl}/marketing/campaigns`;

  list(): Observable<CampaignPage> { return this.http.get<CampaignPage>(`${this.baseUrl}/`); }
  get(id: number): Observable<Campaign> { return this.http.get<Campaign>(`${this.baseUrl}/${id}/`); }
  create(request: CampaignCreateRequest): Observable<Campaign> { return this.http.post<Campaign>(`${this.baseUrl}/`, request); }
  prepare(id: number): Observable<Campaign> { return this.http.post<Campaign>(`${this.baseUrl}/${id}/prepare/`, {}); }
  recipients(id: number, page = 1, pageSize = 100): Observable<CampaignRecipientPage> {
    return this.http.get<CampaignRecipientPage>(`${this.baseUrl}/${id}/recipients/`, { params: { page, page_size: pageSize } });
  }
  prepareProvider(id: number): Observable<Campaign> { return this.http.post<Campaign>(`${this.baseUrl}/${id}/prepare-provider/`, {}); }
}
