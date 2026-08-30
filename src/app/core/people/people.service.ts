import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../http/api-config';
import { MakeMembershipRequest, PaginatedResponse, PersonListItem, PersonOverview, PeopleListQueryState } from './people.types';

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

  makeMember(personId: number, payload: MakeMembershipRequest): Observable<void> {
    return this.http.post<void>(this.buildUrl(`/people/${personId}/membership/`), payload);
  }

  private buildUrl(path: string): string {
    return `${this.apiConfig.apiBaseUrl}${path}`;
  }
}
