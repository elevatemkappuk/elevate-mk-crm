import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiCredentialsInterceptor, csrfHeaderInterceptor } from '../http/auth-http.interceptors';
import { API_CONFIG } from '../http/api-config';
import { PeopleService } from './people.service';

describe('PeopleService', () => {
  let service: PeopleService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl: 'http://localhost:8000/api/v1' } },
        { provide: DOCUMENT, useValue: { cookie: '' } as Document },
      ],
    });

    service = TestBed.inject(PeopleService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('sends the backend people query contract', () => {
    service
      .listPeople({
        q: 'ama',
        record_state: 'archived',
        ordering: '-updated_at',
        page: 2,
        page_size: 50,
      })
      .subscribe();

    const request = httpTesting.expectOne((candidate) => candidate.url.endsWith('/people/'));

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.params.get('q')).toBe('ama');
    expect(request.request.params.get('record_state')).toBe('archived');
    expect(request.request.params.get('ordering')).toBe('-updated_at');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('page_size')).toBe('50');

    request.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('sends the backend person detail request contract', () => {
    service.getPerson(44).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/');

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);

    request.flush({
      id: 44,
      first_name: 'Ama',
      last_name: 'Amoah',
      primary_email: 'ama@example.com',
      mobile: '0991000001',
      location: 'Lilongwe',
      age_range: '',
      gender: '',
      archived_at: null,
      created_at: '2026-08-30T09:00:00Z',
      updated_at: '2026-08-30T09:15:00Z',
    });
  });

  it('sends the backend person overview request contract', () => {
    service.getPersonOverview(44).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/overview/');

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);

    request.flush({
      person: {
        id: 44,
        first_name: 'Ama',
        last_name: 'Amoah',
        primary_email: 'ama@example.com',
        mobile: '0991000001',
        location: 'Lilongwe',
        age_range: '',
        gender: '',
        archived_at: null,
        created_at: '2026-08-30T09:00:00Z',
        updated_at: '2026-08-30T09:15:00Z',
      },
      relationship: {
        type: 'ACTIVE_MEMBER',
        label: 'Active Member',
      },
      membership: {
        id: 9,
        status: 'ACTIVE',
        joined_at: '2024-04-12',
        ended_at: null,
        membership_source: 'WEBSITE_FORM',
        created_at: '2026-08-30T10:00:00Z',
        updated_at: '2026-08-30T10:00:00Z',
      },
      professional_profile: null,
    });
  });

  it('sends the industries request contract', () => {
    service.getIndustries().subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/industries/');

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);

    request.flush([
      { id: 1, name: 'Technology', slug: 'technology' },
      { id: 2, name: 'Engineering', slug: 'engineering' },
    ]);
  });

  it('sends only editable professional profile fields on create', () => {
    service
      .createProfessionalProfile(44, {
        job_title: 'Engineer',
        company: 'Elevate MK',
        industry: 1,
        career_stage: 'MID_CAREER',
        linkedin_url: 'https://www.linkedin.com/in/example',
      })
      .subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/professional-profile/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({
      job_title: 'Engineer',
      company: 'Elevate MK',
      industry: 1,
      career_stage: 'MID_CAREER',
      linkedin_url: 'https://www.linkedin.com/in/example',
    });
    expect(Object.keys(request.request.body)).toEqual([
      'job_title',
      'company',
      'industry',
      'career_stage',
      'linkedin_url',
    ]);

    request.flush(
      {
        id: 13,
        job_title: 'Engineer',
        company: 'Elevate MK',
        industry: { id: 1, name: 'Technology', slug: 'technology' },
        career_stage: 'MID_CAREER',
        linkedin_url: 'https://www.linkedin.com/in/example',
        created_at: '2026-08-30T10:00:00Z',
        updated_at: '2026-08-30T10:00:00Z',
      },
      { status: 201, statusText: 'Created' },
    );
  });

  it('sends only editable professional profile fields on update', () => {
    service
      .updateProfessionalProfile(44, {
        job_title: '',
        company: '',
        industry: null,
        career_stage: '',
        linkedin_url: '',
      })
      .subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/professional-profile/');

    expect(request.request.method).toBe('PATCH');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({
      job_title: '',
      company: '',
      industry: null,
      career_stage: '',
      linkedin_url: '',
    });
    expect(Object.keys(request.request.body)).toEqual([
      'job_title',
      'company',
      'industry',
      'career_stage',
      'linkedin_url',
    ]);

    request.flush(
      {
        id: 13,
        job_title: '',
        company: '',
        industry: null,
        career_stage: '',
        linkedin_url: '',
        created_at: '2026-08-30T10:00:00Z',
        updated_at: '2026-08-30T11:00:00Z',
      },
      { status: 200, statusText: 'OK' },
    );
  });

  it('sends only joined_at and membership_source for make member', () => {
    service
      .makeMember(44, {
        joined_at: '2026-08-30',
        membership_source: 'STAFF',
      })
      .subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/membership/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({
      joined_at: '2026-08-30',
      membership_source: 'STAFF',
    });
    expect(Object.keys(request.request.body)).toEqual(['joined_at', 'membership_source']);

    request.flush(null, { status: 201, statusText: 'Created' });
  });

  it('sends only ended_at for end membership', () => {
    service
      .endMembership(44, {
        ended_at: '2026-08-30',
      })
      .subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/membership/end/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({
      ended_at: '2026-08-30',
    });
    expect(Object.keys(request.request.body)).toEqual(['ended_at']);

    request.flush(
      {
        id: 9,
        status: 'FORMER',
        joined_at: '2024-04-12',
        ended_at: '2026-08-30',
        membership_source: 'STAFF',
        created_at: '2026-08-30T10:00:00Z',
        updated_at: '2026-08-30T11:00:00Z',
      },
      { status: 200, statusText: 'OK' },
    );
  });
});
