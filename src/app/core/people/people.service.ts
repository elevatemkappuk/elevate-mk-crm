import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../http/api-config';
import {
  ArchiveInternalNoteRequest,
  AssignTagRequest,
  AssignInterestRequest,
  AssignSkillRequest,
  CreateInternalNoteRequest,
  CreateContactRequest,
  CreateMemberRequest,
  IdentityOverrideRequest,
  EndMembershipRequest,
  InternalNote,
  InterestSummary,
  Industry,
  MakeMembershipRequest,
  NotesListQuery,
  PaginatedResponse,
  PaginatedPersonAuditHistoryResponse,
  PersonListItem,
  PersonMembership,
  PersonOverview,
  PeopleListQueryState,
  ProfessionalProfile,
  ProfessionalProfileWriteRequest,
  SkillSummary,
  TagSummary,
  UpdateInternalNoteRequest,
  UpdatePersonRequest,
} from './people.types';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  listPeople(
    query: PeopleListQueryState,
  ): Observable<PaginatedResponse<PersonListItem>> {
    let params = new HttpParams()
      .set('record_state', query.record_state)
      .set('ordering', query.ordering)
      .set('page', String(query.page))
      .set('page_size', String(query.page_size));

    if (query.q.trim()) { params = params.set('q', query.q.trim()); }
    for (const value of query.relationship) { params = params.append('relationship', value); }
    for (const value of query.location) { params = params.append('location', value); }
    for (const value of query.industry) { params = params.append('industry', String(value)); }
    for (const value of query.career_stage) { params = params.append('career_stage', value); }
    for (const value of query.interest) { params = params.append('interest', String(value)); }
    for (const value of query.skill) { params = params.append('skill', String(value)); }
    for (const value of query.tag) { params = params.append('tag', String(value)); }

    return this.http.get<PaginatedResponse<PersonListItem>>(this.buildUrl('/people/'), {
      params,
    });
  }

  getPerson(personId: number): Observable<PersonListItem> {
    return this.http.get<PersonListItem>(this.buildUrl(`/people/${personId}/`));
  }

  getPersonOverview(personId: number): Observable<PersonOverview> {
    return this.http.get<PersonOverview>(this.buildUrl(`/people/${personId}/overview/`));
  }

  createContact(payload: CreateContactRequest | (CreateContactRequest & IdentityOverrideRequest)): Observable<PersonListItem> {
    return this.http.post<PersonListItem>(this.buildUrl('/people/'), payload);
  }

  createMember(payload: CreateMemberRequest | (CreateMemberRequest & IdentityOverrideRequest)): Observable<PersonListItem> {
    return this.http.post<PersonListItem>(this.buildUrl('/people/members/'), payload);
  }

  updatePerson(personId: number, payload: UpdatePersonRequest): Observable<PersonListItem> {
    return this.http.patch<PersonListItem>(this.buildUrl(`/people/${personId}/`), payload);
  }

  archivePerson(personId: number): Observable<PersonListItem> {
    return this.http.post<PersonListItem>(this.buildUrl(`/people/${personId}/archive/`), {});
  }

  restorePerson(personId: number): Observable<PersonListItem> {
    return this.http.post<PersonListItem>(this.buildUrl(`/people/${personId}/restore/`), {});
  }

  getPersonNotes(personId: number, query: NotesListQuery): Observable<PaginatedResponse<InternalNote>> {
    const params = new HttpParams({
      fromObject: {
        record_state: query.record_state,
        page: String(query.page),
        page_size: String(query.page_size),
      },
    });

    return this.http.get<PaginatedResponse<InternalNote>>(this.buildUrl(`/people/${personId}/notes/`), {
      params,
    });
  }

  getPersonAuditHistory(personId: number, page?: number): Observable<PaginatedPersonAuditHistoryResponse> {
    let params = new HttpParams();

    if (page && page > 1) {
      params = params.set('page', String(page));
    }

    return this.http.get<PaginatedPersonAuditHistoryResponse>(this.buildUrl(`/people/${personId}/audit-history/`), {
      params,
    });
  }

  getIndustries(): Observable<Industry[]> {
    return this.http.get<Industry[]>(this.buildUrl('/industries/'));
  }

  getSkills(): Observable<SkillSummary[]> {
    return this.http.get<SkillSummary[]>(this.buildUrl('/skills/'));
  }

  getInterests(): Observable<InterestSummary[]> {
    return this.http.get<InterestSummary[]>(this.buildUrl('/interests/'));
  }

  getTags(): Observable<TagSummary[]> {
    return this.http.get<TagSummary[]>(this.buildUrl('/tags/'));
  }

  createProfessionalProfile(
    personId: number,
    payload: ProfessionalProfileWriteRequest,
  ): Observable<ProfessionalProfile> {
    return this.http.post<ProfessionalProfile>(this.buildUrl(`/people/${personId}/professional-profile/`), payload);
  }

  updateProfessionalProfile(
    personId: number,
    payload: ProfessionalProfileWriteRequest,
  ): Observable<ProfessionalProfile> {
    return this.http.patch<ProfessionalProfile>(this.buildUrl(`/people/${personId}/professional-profile/`), payload);
  }

  createPersonNote(personId: number, payload: CreateInternalNoteRequest): Observable<InternalNote> {
    return this.http.post<InternalNote>(this.buildUrl(`/people/${personId}/notes/`), payload);
  }

  updatePersonNote(personId: number, noteId: number, payload: UpdateInternalNoteRequest): Observable<InternalNote> {
    return this.http.patch<InternalNote>(this.buildUrl(`/people/${personId}/notes/${noteId}/`), payload);
  }

  archivePersonNote(personId: number, noteId: number, payload: ArchiveInternalNoteRequest): Observable<InternalNote> {
    return this.http.post<InternalNote>(this.buildUrl(`/people/${personId}/notes/${noteId}/archive/`), payload);
  }

  restorePersonNote(personId: number, noteId: number): Observable<InternalNote> {
    return this.http.post<InternalNote>(this.buildUrl(`/people/${personId}/notes/${noteId}/restore/`), {});
  }

  makeMember(personId: number, payload: MakeMembershipRequest): Observable<void> {
    return this.http.post<void>(this.buildUrl(`/people/${personId}/membership/`), payload);
  }

  endMembership(personId: number, payload: EndMembershipRequest): Observable<PersonMembership> {
    return this.http.post<PersonMembership>(this.buildUrl(`/people/${personId}/membership/end/`), payload);
  }

  assignSkill(personId: number, skillId: number): Observable<SkillSummary> {
    const payload: AssignSkillRequest = { skill: skillId };
    return this.http.post<SkillSummary>(this.buildUrl(`/people/${personId}/skills/`), payload);
  }

  assignInterest(personId: number, interestId: number): Observable<InterestSummary> {
    const payload: AssignInterestRequest = { interest: interestId };
    return this.http.post<InterestSummary>(this.buildUrl(`/people/${personId}/interests/`), payload);
  }

  assignTag(personId: number, tagId: number): Observable<TagSummary> {
    const payload: AssignTagRequest = { tag: tagId };
    return this.http.post<TagSummary>(this.buildUrl(`/people/${personId}/tags/`), payload);
  }

  removeSkill(personId: number, skillId: number): Observable<void> {
    return this.http.delete<void>(this.buildUrl(`/people/${personId}/skills/${skillId}/`));
  }

  removeInterest(personId: number, interestId: number): Observable<void> {
    return this.http.delete<void>(this.buildUrl(`/people/${personId}/interests/${interestId}/`));
  }

  removeTag(personId: number, tagId: number): Observable<void> {
    return this.http.post<void>(this.buildUrl(`/people/${personId}/tags/${tagId}/remove/`), null);
  }

  private buildUrl(path: string): string {
    return `${this.apiConfig.apiBaseUrl}${path}`;
  }
}
