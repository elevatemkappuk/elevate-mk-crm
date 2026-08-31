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
      skills: [
        {
          id: 21,
          name: 'Software Development',
          slug: 'software-development',
        },
      ],
      interests: [
        {
          id: 5,
          name: 'Technology',
          slug: 'technology',
        },
      ],
      tags: [
        {
          id: 8,
          name: 'VIP',
          slug: 'vip',
        },
      ],
    });
  });

  it('sends the backend notes list request contract', () => {
    service
      .getPersonNotes(44, {
        record_state: 'archived',
        page: 2,
        page_size: 25,
      })
      .subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/notes/?record_state=archived&page=2&page_size=25');

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);

    request.flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 9,
          body: 'Archived note',
          created_by: { id: 1, email: 'admin@example.com' },
          created_at: '2026-08-30T10:00:00Z',
          updated_at: '2026-08-30T10:00:00Z',
          archived_at: '2026-08-31T10:00:00Z',
          archived_by: { id: 2, email: 'manager@example.com' },
          archive_reason: 'Resolved',
        },
      ],
    });
  });

  it('sends the backend person audit history first-page request contract without unnecessary query parameters', () => {
    service.getPersonAuditHistory(44).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/audit-history/');

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.params.keys().length).toBe(0);

    request.flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 12,
          action: 'TAG_ASSIGNED',
          description: 'Tag assigned',
          actor: { id: 1, email: 'admin@example.com' },
          occurred_at: '2026-08-31T18:35:00Z',
          entity_type: 'PersonTag',
          changes: {
            is_active: {
              from: null,
              to: true,
            },
          },
        },
      ],
    });
  });

  it('sends the backend person audit history requested page contract', () => {
    service.getPersonAuditHistory(44, 2).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/audit-history/?page=2');

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.params.get('page')).toBe('2');

    request.flush({
      count: 26,
      next: null,
      previous: 'http://localhost:8000/api/v1/people/44/audit-history/',
      results: [
        {
          id: 7,
          action: 'MEMBERSHIP_CREATED',
          description: 'Membership created',
          actor: null,
          occurred_at: '2026-08-30T12:00:00Z',
          entity_type: 'Membership',
          changes: {
            status: {
              from: null,
              to: 'ACTIVE',
            },
          },
        },
      ],
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

  it('sends the skills request contract', () => {
    service.getSkills().subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/skills/');

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);

    request.flush([
      { id: 16, name: 'Project Management', slug: 'project-management' },
      { id: 21, name: 'Software Development', slug: 'software-development' },
    ]);
  });

  it('sends the interests request contract', () => {
    service.getInterests().subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/interests/');

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);

    request.flush([
      { id: 5, name: 'Technology', slug: 'technology' },
      { id: 13, name: 'Startups', slug: 'startups' },
    ]);
  });

  it('sends the tags request contract', () => {
    service.getTags().subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/tags/');

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);

    request.flush([
      { id: 8, name: 'VIP', slug: 'vip' },
      { id: 6, name: 'Follow-up Required', slug: 'follow-up-required' },
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

  it('sends only body for create person note', () => {
    service.createPersonNote(44, { body: 'Sensitive context.' }).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/notes/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ body: 'Sensitive context.' });
    expect(Object.keys(request.request.body)).toEqual(['body']);

    request.flush(
      {
        id: 9,
        body: 'Sensitive context.',
        created_by: { id: 1, email: 'admin@example.com' },
        created_at: '2026-08-31T10:00:00Z',
        updated_at: '2026-08-31T10:00:00Z',
        archived_at: null,
        archived_by: null,
        archive_reason: '',
      },
      { status: 201, statusText: 'Created' },
    );
  });

  it('sends only body for update person note', () => {
    service.updatePersonNote(44, 9, { body: 'Updated context.' }).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/notes/9/');

    expect(request.request.method).toBe('PATCH');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ body: 'Updated context.' });
    expect(Object.keys(request.request.body)).toEqual(['body']);

    request.flush({
      id: 9,
      body: 'Updated context.',
      created_by: { id: 1, email: 'admin@example.com' },
      created_at: '2026-08-31T10:00:00Z',
      updated_at: '2026-08-31T10:30:00Z',
      archived_at: null,
      archived_by: null,
      archive_reason: '',
    });
  });

  it('sends archive_reason for archive person note', () => {
    service.archivePersonNote(44, 9, { archive_reason: 'Superseded' }).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/notes/9/archive/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({ archive_reason: 'Superseded' });
    expect(Object.keys(request.request.body)).toEqual(['archive_reason']);

    request.flush({
      id: 9,
      body: 'Updated context.',
      created_by: { id: 1, email: 'admin@example.com' },
      created_at: '2026-08-31T10:00:00Z',
      updated_at: '2026-08-31T11:00:00Z',
      archived_at: '2026-08-31T11:00:00Z',
      archived_by: { id: 2, email: 'manager@example.com' },
      archive_reason: 'Superseded',
    });
  });

  it('sends an empty payload for restore person note', () => {
    service.restorePersonNote(44, 9).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/notes/9/restore/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({});
    expect(Object.keys(request.request.body)).toEqual([]);

    request.flush({
      id: 9,
      body: 'Updated context.',
      created_by: { id: 1, email: 'admin@example.com' },
      created_at: '2026-08-31T10:00:00Z',
      updated_at: '2026-08-31T11:15:00Z',
      archived_at: null,
      archived_by: null,
      archive_reason: '',
    });
  });

  it('sends only skill for assign skill', () => {
    service.assignSkill(44, 16).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/skills/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({
      skill: 16,
    });
    expect(Object.keys(request.request.body)).toEqual(['skill']);

    request.flush(
      {
        id: 16,
        name: 'Project Management',
        slug: 'project-management',
      },
      { status: 201, statusText: 'Created' },
    );
  });

  it('sends only interest for assign interest', () => {
    service.assignInterest(44, 5).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/interests/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({
      interest: 5,
    });
    expect(Object.keys(request.request.body)).toEqual(['interest']);

    request.flush(
      {
        id: 5,
        name: 'Technology',
        slug: 'technology',
      },
      { status: 201, statusText: 'Created' },
    );
  });

  it('sends only tag for assign tag', () => {
    service.assignTag(44, 8).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/tags/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toEqual({
      tag: 8,
    });
    expect(Object.keys(request.request.body)).toEqual(['tag']);

    request.flush(
      {
        id: 8,
        name: 'VIP',
        slug: 'vip',
      },
      { status: 201, statusText: 'Created' },
    );
  });

  it('sends the delete skill assignment request contract', () => {
    service.removeSkill(44, 16).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/skills/16/');

    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toBeNull();

    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('sends the delete interest assignment request contract', () => {
    service.removeInterest(44, 5).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/interests/5/');

    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toBeNull();

    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('sends the lifecycle-aware remove tag request contract', () => {
    service.removeTag(44, 8).subscribe();

    const request = httpTesting.expectOne('http://localhost:8000/api/v1/people/44/tags/8/remove/');

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.body).toBeNull();

    request.flush(null, { status: 204, statusText: 'No Content' });
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
