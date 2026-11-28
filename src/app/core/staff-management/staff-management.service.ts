import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../http/api-config';
import { StaffActivityResponse, StaffDetail, StaffDirectoryResponse } from './staff-management.types';

export interface StaffDirectoryQuery {
  q?: string;
  role?: string;
  staff_state?: string;
  account_state?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

@Injectable({ providedIn: 'root' })
export class StaffManagementService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  list(query: StaffDirectoryQuery): Observable<StaffDirectoryResponse> {
    return this.http.get<StaffDirectoryResponse>(this.url('/staff/directory/'), { params: this.params(query) });
  }

  get(userId: number): Observable<StaffDetail> {
    return this.http.get<StaffDetail>(this.url(`/staff/directory/${userId}/`));
  }

  activity(userId: number, page = 1): Observable<StaffActivityResponse> {
    return this.http.get<StaffActivityResponse>(this.url(`/staff/directory/${userId}/activity/`), { params: new HttpParams().set('page', page) });
  }

  private params(query: StaffDirectoryQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    });
    return params;
  }

  private url(path: string): string { return `${this.apiConfig.apiBaseUrl}${path}`; }
}
