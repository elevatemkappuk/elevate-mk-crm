import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../http/api-config';
import { StaffActivityResponse, StaffDetail, StaffDirectoryResponse, StaffOnboardingLookupResponse, StaffOnboardingRoleOption, StaffOnboardingValidationResponse } from './staff-management.types';

export interface StaffDirectoryQuery {
  q?: string;
  role?: string;
  staff_state?: string;
  account_state?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface StaffOnboardingValidationRequest {
  person_id?: number;
  first_name?: string;
  last_name?: string;
  primary_email?: string | null;
  mobile?: string;
  location?: string;
  login_email?: string;
  role_code: string;
  reason: string;
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

  onboardingRoles(): Observable<{ results: StaffOnboardingRoleOption[] }> {
    return this.http.get<{ results: StaffOnboardingRoleOption[] }>(this.url('/staff/onboarding/roles/'));
  }

  searchOnboardingPeople(q: string): Observable<StaffOnboardingLookupResponse> {
    return this.http.get<StaffOnboardingLookupResponse>(this.url('/staff/onboarding/people/'), { params: new HttpParams().set('q', q) });
  }

  validateOnboarding(payload: StaffOnboardingValidationRequest): Observable<StaffOnboardingValidationResponse> {
    return this.http.post<StaffOnboardingValidationResponse>(this.url('/staff/onboarding/validate/'), payload);
  }

  submitOnboarding(payload: StaffOnboardingValidationRequest): Observable<{ public_id: string; intended_email: string; expires_at: string; delivery: string }> {
    return this.http.post<{ public_id: string; intended_email: string; expires_at: string; delivery: string }>(this.url('/staff/onboarding/'), payload);
  }

  inspectInvitation(invitation: string, token: string): Observable<{ usable: boolean; existing_account: boolean; role_code: string; expires_at: string }> {
    return this.http.get<{ usable: boolean; existing_account: boolean; role_code: string; expires_at: string }>(this.url('/staff/invitations/inspect/'), { params: { invitation, token } });
  }

  acceptInvitation(invitation: string, token: string, payload: { password?: string; confirm_password?: string }): Observable<{ detail: string; user_id: number }> {
    return this.http.post<{ detail: string; user_id: number }>(this.url('/staff/invitations/accept/'), { invitation, token, ...payload });
  }

  resendInvitation(invitationId: string, reason: string): Observable<{ public_id: string; expires_at: string; delivery: string }> {
    return this.http.post<{ public_id: string; expires_at: string; delivery: string }>(this.url(`/staff/invitations/${invitationId}/resend/`), { reason });
  }

  cancelInvitation(invitationId: string, reason: string): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(this.url(`/staff/invitations/${invitationId}/cancel/`), { reason });
  }

  createAdministratorProposal(operation: 'ONBOARD' | 'PROMOTE_EXISTING', targetUserId: number, reason: string): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(this.url('/staff/administrator-proposals/create/'), { operation, target_user_id: targetUserId, reason });
  }

  administratorProposals(query: Record<string, string | number> = {}): Observable<{ count: number; next: string | null; previous: string | null; results: Array<Record<string, unknown>> }> {
    let params = new HttpParams(); Object.entries(query).forEach(([key, value]) => params = params.set(key, String(value)));
    return this.http.get<{ count: number; next: string | null; previous: string | null; results: Array<Record<string, unknown>> }>(this.url('/staff/administrator-proposals/'), { params });
  }

  administratorProposal(proposalId: string): Observable<Record<string, unknown>> { return this.http.get<Record<string, unknown>>(this.url(`/staff/administrator-proposals/${proposalId}/`)); }
  administratorProposalAction(proposalId: string, action: 'approve' | 'reject' | 'cancel', reason = ''): Observable<Record<string, unknown>> { return this.http.post<Record<string, unknown>>(this.url(`/staff/administrator-proposals/${proposalId}/${action}/`), { reason }); }

  changeStaffRole(userId: number, roleCode: string, reason: string): Observable<Record<string, unknown>> { return this.http.post<Record<string, unknown>>(this.url('/staff/role-change/'), { user_id: userId, role_code: roleCode, reason }); }
  deactivateStaff(userId: number, reason: string): Observable<Record<string, unknown>> { return this.http.post<Record<string, unknown>>(this.url('/staff/deactivate/'), { user_id: userId, reason }); }
  reactivateStaff(userId: number, roleCode: string, reason: string): Observable<Record<string, unknown>> { return this.http.post<Record<string, unknown>>(this.url('/staff/reactivate/'), { user_id: userId, role_code: roleCode, reason }); }

  private params(query: StaffDirectoryQuery): HttpParams {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    });
    return params;
  }

  private url(path: string): string { return `${this.apiConfig.apiBaseUrl}${path}`; }
}
