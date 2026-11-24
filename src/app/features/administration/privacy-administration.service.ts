import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../../core/http/api-config';
import {
  GovernanceProposal,
  GovernanceRoleDefaults,
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

  roleDefaults(): Observable<GovernanceRoleDefaults> {
    return this.http.get<GovernanceRoleDefaults>(`${this.baseUrl}/role-defaults/`);
  }

  createProposal(request: GovernanceMutationRequest): Observable<GovernanceProposal> {
    return this.http.post<GovernanceProposal>(`${this.baseUrl}/proposals/`, request);
  }

  applyIndividualChange(request: GovernanceMutationRequest): Observable<GovernanceProposal> {
    return this.http.post<GovernanceProposal>(`${this.baseUrl}/individual-changes/`, request);
  }

  resolveProposal(
    proposalId: string,
    action: 'approve' | 'reject' | 'cancel',
    reason = '',
  ): Observable<GovernanceProposal> {
    return this.http.post<GovernanceProposal>(`${this.baseUrl}/proposals/${proposalId}/${action}/`, { reason });
  }
}
