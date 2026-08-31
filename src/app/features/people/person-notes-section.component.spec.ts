import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiCredentialsInterceptor, csrfHeaderInterceptor } from '../../core/http/auth-http.interceptors';
import { API_CONFIG } from '../../core/http/api-config';
import { PersonNotesSectionComponent } from './person-notes-section.component';

const apiBaseUrl = 'http://localhost:8000/api/v1';

describe('PersonNotesSectionComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonNotesSectionComponent],
      providers: [
        provideHttpClient(withInterceptors([apiCredentialsInterceptor, csrfHeaderInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBaseUrl } },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createComponent(canMutateInternalNotes = true) {
    const fixture = TestBed.createComponent(PersonNotesSectionComponent);
    fixture.componentRef.setInput('personId', 12);
    fixture.componentRef.setInput('canMutateInternalNotes', canMutateInternalNotes);
    fixture.detectChanges();
    return fixture;
  }

  function flushActiveNotesList() {
    httpTesting
      .expectOne(`${apiBaseUrl}/people/12/notes/?record_state=active&page=1&page_size=25`)
      .flush({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 41,
            body: 'Initial note body',
            created_by: { id: 1, email: 'admin@example.com' },
            created_at: '2026-08-31T10:00:00Z',
            updated_at: '2026-08-31T10:15:00Z',
            archived_at: null,
            archived_by: null,
            archive_reason: '',
          },
        ],
      });
  }

  it('loads active notes by default and renders the sensitive-notes context', () => {
    const fixture = createComponent();

    flushActiveNotesList();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Internal Notes');
    expect(text).toContain('Visible to CRM Admins and Managers only.');
    expect(text).toContain('Initial note body');
  });

  it('changes the lifecycle filter and reloads notes from the first page', () => {
    const fixture = createComponent();

    flushActiveNotesList();
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'archived';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const archivedRequest = httpTesting.expectOne(
      `${apiBaseUrl}/people/12/notes/?record_state=archived&page=1&page_size=25`,
    );
    expect(archivedRequest.request.method).toBe('GET');

    archivedRequest.flush({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 52,
          body: 'Archived note body',
          created_by: { id: 2, email: 'manager@example.com' },
          created_at: '2026-08-30T08:00:00Z',
          updated_at: '2026-08-31T09:00:00Z',
          archived_at: '2026-08-31T09:00:00Z',
          archived_by: { id: 2, email: 'manager@example.com' },
          archive_reason: 'Resolved',
        },
      ],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Archived note body');
    expect(fixture.nativeElement.textContent).toContain('Archive reason: Resolved');
  });

  it('creates a note, then refreshes the notes list authoritatively', () => {
    const fixture = createComponent();

    flushActiveNotesList();
    fixture.detectChanges();

    const addButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button: HTMLButtonElement) =>
      button.textContent?.includes('Add Note'),
    ) as HTMLButtonElement | undefined;
    addButton?.click();
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('.note-create-form textarea') as HTMLTextAreaElement;
    textarea.value = 'New internal note';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('.note-create-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    const createRequest = httpTesting.expectOne(`${apiBaseUrl}/people/12/notes/`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({ body: 'New internal note' });

    createRequest.flush(
      {
        id: 88,
        body: 'New internal note',
        created_by: { id: 1, email: 'admin@example.com' },
        created_at: '2026-08-31T11:00:00Z',
        updated_at: '2026-08-31T11:00:00Z',
        archived_at: null,
        archived_by: null,
        archive_reason: '',
      },
      { status: 201, statusText: 'Created' },
    );

    httpTesting
      .expectOne(`${apiBaseUrl}/people/12/notes/?record_state=active&page=1&page_size=25`)
      .flush({
        count: 2,
        next: null,
        previous: null,
        results: [
          {
            id: 88,
            body: 'New internal note',
            created_by: { id: 1, email: 'admin@example.com' },
            created_at: '2026-08-31T11:00:00Z',
            updated_at: '2026-08-31T11:00:00Z',
            archived_at: null,
            archived_by: null,
            archive_reason: '',
          },
          {
            id: 41,
            body: 'Initial note body',
            created_by: { id: 1, email: 'admin@example.com' },
            created_at: '2026-08-31T10:00:00Z',
            updated_at: '2026-08-31T10:15:00Z',
            archived_at: null,
            archived_by: null,
            archive_reason: '',
          },
        ],
      });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('New internal note');
    expect(fixture.nativeElement.querySelector('.note-create-form')).toBeNull();
  });

  it('keeps archived-person notes readable while hiding mutation controls', () => {
    const fixture = createComponent(false);

    flushActiveNotesList();
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')).map((button: HTMLButtonElement) =>
      button.textContent?.trim(),
    );

    expect(fixture.nativeElement.textContent).toContain('Initial note body');
    expect(buttons).not.toContain('Add Note');
    expect(buttons).not.toContain('Edit');
    expect(buttons).not.toContain('Archive');
    expect(buttons).not.toContain('Restore');
  });
});
