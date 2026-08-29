export type PersonRecordState = 'active' | 'archived' | 'all';

export type PeopleOrdering =
  | 'first_name'
  | '-first_name'
  | 'last_name'
  | '-last_name'
  | 'created_at'
  | '-created_at'
  | 'updated_at'
  | '-updated_at';

export type PeoplePageSize = 25 | 50 | 100;

export interface PersonListItem {
  id: number;
  first_name: string;
  last_name: string;
  primary_email: string | null;
  mobile: string;
  location: string;
  age_range: string;
  gender: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PeopleListQueryState {
  q: string;
  record_state: PersonRecordState;
  ordering: PeopleOrdering;
  page: number;
  page_size: PeoplePageSize;
}
