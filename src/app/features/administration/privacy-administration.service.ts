import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../core/http/api-config';
import {
  GovernanceProposal,
  GovernanceRoleDefaults,
  GovernanceStaffDirectory,
  GovernanceTargetDetail,
} from './privacy-administration.types';

export interface GovernanceMutationRequest {
  readonly operation: string;
  readonly capability: string;
  readonly target_user_id?: number;
  readonly role_id?: number;
  readonly reason: string;
}

@Injectable({ providedIn: 'root' })
export class PrivacyAdministrationService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly baseUrl = `${this.apiConfig.apiBaseUrl}/staff/governance`;

  target(userId: number): Observable<GovernanceTargetDetail> {
    return this.http.get<GovernanceTargetDetail>(`${this.baseUrl}/targets/${userId}/`);
  }

  directory(query = ''): Observable<GovernanceStaffDirectory> {
    return this.http.get<GovernanceStaffDirectory>(`${this.baseUrl}/targets/`, { params: query ? { q: query } : {} });
  }

  roleDefaults(): Observable<GovernanceRoleDefaults> {
    return this.http.get<GovernanceRoleDefaults>(`${this.baseUrl}/role-defaults/`);
  }

  createProposal(request: GovernanceMutationRequest): Observable<GovernanceProposal> {
    return this.http.post<GovernanceProposal>(`${this.baseUrl}/proposals/`, request);
  }

  applyIndividualChange(request: GovernanceMutationRequest): Observable<GovernanceProposal> {
    return this.http.post<GovernanceProposal>(`${this.baseUrl}/individual-changes/`, request);
  }

  applySuperuserAction(request: GovernanceMutationRequest): Observable<GovernanceSuperuserResult> {
    return this.http.post<GovernanceSuperuserResult>(`${this.baseUrl}/superuser-actions/`, request);
  }

  resolveProposal(
    proposalId: string,
    action: 'approve' | 'reject' | 'cancel',
    reason = '',
  ): Observable<GovernanceProposal> {
    return this.http.post<GovernanceProposal>(`${this.baseUrl}/proposals/${proposalId}/${action}/`, { reason });
  }

  history(historyType: 'individual' | 'role-defaults' | 'decisions'): Observable<{ readonly results: readonly GovernanceProposal[] }> {
    return this.http.get<{ readonly results: readonly GovernanceProposal[] }>(`${this.baseUrl}/history/${historyType}/`);
  }
}

export interface GovernanceSuperuserResult {
  readonly status: 'APPLIED';
  readonly operation: string;
  readonly capability: string;
  readonly role_id: number | null;
  readonly target_user_id: number | null;
  readonly state: unknown;
}
