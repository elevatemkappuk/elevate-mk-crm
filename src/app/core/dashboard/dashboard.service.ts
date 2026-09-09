import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_CONFIG } from '../http/api-config';
import { DashboardProjection } from './dashboard.types';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  getDashboard() { return this.http.get<DashboardProjection>(`${this.api.apiBaseUrl}/dashboard/`); }
}
