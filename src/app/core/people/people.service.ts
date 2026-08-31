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
  EndMembershipRequest,
  InternalNote,
  InterestSummary,
  Industry,
  MakeMembershipRequest,
  NotesListQuery,
  PaginatedResponse,
  PersonListItem,
  PersonMembership,
  PersonOverview,
  PeopleListQueryState,
  ProfessionalProfile,
  ProfessionalProfileWriteRequest,
  SkillSummary,
  TagSummary,
  UpdateInternalNoteRequest,
} from './people.types';

@Injectable({ providedIn: 'root' })
export class PeopleService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  listPeople(
    query: PeopleListQueryState,
  ): Observable<PaginatedResponse<PersonListItem>> {
    const params = new HttpParams({
      fromObject: {
        q: query.q,
        record_state: query.record_state,
        ordering: query.ordering,
        page: String(query.page),
        page_size: String(query.page_size),
      },
    });

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
