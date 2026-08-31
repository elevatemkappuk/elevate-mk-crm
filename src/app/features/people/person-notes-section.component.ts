import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { of, switchMap, tap } from 'rxjs';

import { PeopleService } from '../../core/people/people.service';
import {
  ArchiveInternalNoteRequest,
  InternalNote,
  NoteRecordState,
  PaginatedResponse,
} from '../../core/people/people.types';
import { CrmSectionCardComponent } from '../../shared/ui/crm-section-card.component';
import { StateMessageComponent } from '../../shared/ui/state-message.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

const NOTES_PAGE_SIZE = 25;

@Component({
  selector: 'app-person-notes-section',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CrmSectionCardComponent,
    StateMessageComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-crm-section-card title="Internal Notes">
      <div class="notes-section">
        <div class="notes-toolbar">
          <p class="notes-supporting-copy">Visible to CRM Admins and Managers only.</p>

          <label class="notes-filter">
            <span>Record state</span>
            <select [value]="notesRecordState()" (change)="changeRecordState($any($event.target).value)">
              @for (option of recordStateOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </label>
        </div>

        @if (notesLoading() && !notesLoaded()) {
          <app-state-message title="Loading notes" message="Retrieving internal notes for this person." />
        } @else if (notesErrorMessage()) {
          <app-state-message title="Notes could not be loaded" [message]="notesErrorMessage()!" tone="error" />
        } @else {
          <div class="notes-results">
            @if (!notes().length) {
              <div class="notes-empty-state">
                <p class="empty-section-copy">{{ emptyStateMessage() }}</p>
              </div>
            } @else {
              <div class="notes-list" aria-live="polite">
                @for (note of notes(); track note.id) {
                  <article class="note-card">
                    <div class="note-card-header">
                      <div class="note-card-meta">
                        <p class="note-author">{{ note.created_by.email }}</p>
                        <p class="note-timestamp">
                          Updated {{ formatDateTime(note.updated_at) }}
                        </p>
                      </div>

                      <div class="note-card-status">
                        @if (note.archived_at) {
                          <app-status-badge label="Archived" tone="archived" />
                        } @else {
                          <app-status-badge label="Active" />
                        }
                      </div>
                    </div>

                    @if (editingNoteId() === note.id) {
                      <form class="note-form" [formGroup]="editNoteForm" (ngSubmit)="submitEditNote(note)">
                        <label>
                          <span>Note</span>
                          <textarea rows="5" formControlName="body"></textarea>
                        </label>

                        @if (showEditBodyRequiredError()) {
                          <p class="form-error">Note body is required.</p>
                        }

                        @if (noteWriteErrorMessage()) {
                          <p class="form-error">{{ noteWriteErrorMessage() }}</p>
                        }

                        <div class="form-actions">
                          <button type="submit" [disabled]="updatingNoteId() === note.id">
                            {{ updatingNoteId() === note.id ? 'Saving...' : 'Save' }}
                          </button>
                          <button
                            type="button"
                            class="button-secondary"
                            [disabled]="updatingNoteId() === note.id"
                            (click)="cancelEditNote()"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    } @else if (archivingNoteDraftId() === note.id) {
                      <form class="note-form" [formGroup]="archiveNoteForm" (ngSubmit)="submitArchiveNote(note)">
                        <label>
                          <span>Archive reason</span>
                          <textarea rows="3" formControlName="archive_reason"></textarea>
                        </label>

                        <p class="form-note">This note will remain stored but move to the archived notes state.</p>

                        @if (noteWriteErrorMessage()) {
                          <p class="form-error">{{ noteWriteErrorMessage() }}</p>
                        }

                        <div class="form-actions">
                          <button type="submit" [disabled]="archivingNoteId() === note.id">
                            {{ archivingNoteId() === note.id ? 'Archiving...' : 'Archive' }}
                          </button>
                          <button
                            type="button"
                            class="button-secondary"
                            [disabled]="archivingNoteId() === note.id"
                            (click)="cancelArchiveNote()"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    } @else {
                      <p class="note-body">{{ note.body }}</p>

                      @if (note.archived_at && note.archive_reason.trim()) {
                        <p class="note-archive-reason">
                          Archive reason: {{ note.archive_reason }}
                        </p>
                      }

                      @if (note.archived_at && note.archived_by) {
                        <p class="note-archive-meta">
                          Archived by {{ note.archived_by.email }} on {{ formatDateTime(note.archived_at) }}
                        </p>
                      }

                      @if (canMutateInternalNotes()) {
                        <div class="note-actions">
                          @if (!note.archived_at) {
                            <button type="button" class="button-secondary" (click)="openEditNote(note)">Edit</button>
                            <button type="button" class="button-secondary" (click)="openArchiveNote(note)">Archive</button>
                          } @else {
                            <button
                              type="button"
                              class="button-secondary"
                              [disabled]="restoringNoteId() === note.id"
                              (click)="restoreNote(note)"
                            >
                              {{ restoringNoteId() === note.id ? 'Restoring...' : 'Restore' }}
                            </button>
                          }
                        </div>
                      }
                    }
                  </article>
                }
              </div>
            }

            @if (showCreateNoteForm()) {
              <form class="note-form note-create-form" [formGroup]="createNoteForm" (ngSubmit)="submitCreateNote()">
                <label>
                  <span>Note</span>
                  <textarea rows="5" formControlName="body"></textarea>
                </label>

                @if (showCreateBodyRequiredError()) {
                  <p class="form-error">Note body is required.</p>
                }

                @if (noteWriteErrorMessage()) {
                  <p class="form-error">{{ noteWriteErrorMessage() }}</p>
                }

                <div class="form-actions">
                  <button type="submit" [disabled]="creatingNote()">
                    {{ creatingNote() ? 'Saving...' : 'Add Note' }}
                  </button>
                  <button
                    type="button"
                    class="button-secondary"
                    [disabled]="creatingNote()"
                    (click)="cancelCreateNote()"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            } @else if (canMutateInternalNotes()) {
              <div class="section-actions">
                <button type="button" class="button-primary" (click)="openCreateNoteForm()">Add Note</button>
              </div>
            }

            @if (notesLoading() && notesLoaded()) {
              <p class="form-note">Refreshing notes.</p>
            }

            @if (noteWriteErrorMessage() && !showCreateNoteForm() && editingNoteId() === null && archivingNoteDraftId() === null) {
              <p class="form-error">{{ noteWriteErrorMessage() }}</p>
            }

            @if (hasPagination()) {
              <div class="notes-pagination">
                <button type="button" class="button-secondary" [disabled]="!hasPreviousPage() || notesLoading()" (click)="goToPreviousPage()">
                  Previous
                </button>
                <p>Page {{ currentPage() }} of {{ totalPages() }}</p>
                <button type="button" class="button-secondary" [disabled]="!hasNextPage() || notesLoading()" (click)="goToNextPage()">
                  Next
                </button>
              </div>
            }
          </div>
        }
      </div>
    </app-crm-section-card>
  `,
  styles: `
    :host {
      display: block;
    }

    .notes-section,
    .notes-results,
    .notes-list,
    .note-card,
    .note-form,
    .notes-empty-state {
      display: grid;
      gap: 0.9rem;
    }

    .notes-toolbar,
    .note-card-header,
    .note-actions,
    .notes-pagination,
    .form-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .notes-toolbar {
      justify-content: space-between;
      align-items: end;
    }

    .notes-supporting-copy,
    .empty-section-copy,
    .note-timestamp,
    .note-archive-meta,
    .note-archive-reason,
    .form-note,
    .notes-pagination p {
      margin: 0;
      color: #4f697b;
      line-height: 1.5;
    }

    .notes-supporting-copy {
      color: #617b8c;
    }

    .notes-filter {
      display: grid;
      gap: 0.35rem;
      min-width: 11rem;
    }

    .notes-filter span,
    .note-form span {
      font-size: 0.8rem;
      font-weight: 700;
      color: #617b8c;
    }

    .notes-filter select,
    .note-form textarea {
      width: 100%;
      border: 1px solid rgba(55, 84, 108, 0.2);
      border-radius: 0.85rem;
      background: #fff;
      color: #1a3142;
      font: inherit;
    }

    .notes-filter select {
      min-height: 2.85rem;
      padding: 0.65rem 0.85rem;
    }

    .note-form textarea {
      min-height: 7.5rem;
      padding: 0.8rem 0.9rem;
      resize: vertical;
      line-height: 1.5;
    }

    .note-card {
      padding: 1rem 1.05rem;
      border-radius: 1rem;
      border: 1px solid rgba(22, 39, 53, 0.08);
      background: rgba(247, 250, 252, 0.78);
    }

    .note-card-header {
      justify-content: space-between;
      align-items: start;
    }

    .note-card-meta {
      display: grid;
      gap: 0.2rem;
    }

    .note-author,
    .note-body {
      margin: 0;
      color: #1a3142;
    }

    .note-author {
      font-weight: 700;
    }

    .note-body {
      white-space: pre-wrap;
      line-height: 1.6;
    }

    .note-actions {
      justify-content: flex-start;
    }

    .notes-pagination {
      justify-content: space-between;
      padding-top: 0.15rem;
    }

    .form-error {
      margin: 0;
      color: #a13d3d;
      line-height: 1.5;
    }

    button {
      cursor: pointer;
    }

    button[disabled] {
      cursor: not-allowed;
    }

    @media (max-width: 720px) {
      .notes-toolbar,
      .note-card-header,
      .notes-pagination {
        align-items: stretch;
      }

      .notes-filter {
        min-width: 0;
      }
    }
  `,
})
export class PersonNotesSectionComponent {
  readonly personId = input.required<number>();
  readonly canMutateInternalNotes = input.required<boolean>();

  private readonly fb = inject(FormBuilder);
  private readonly peopleService = inject(PeopleService);
  private readonly destroyRef = inject(DestroyRef);

  readonly notes = signal<InternalNote[]>([]);
  readonly notesLoaded = signal(false);
  readonly notesLoading = signal(false);
  readonly notesErrorMessage = signal<string | null>(null);
  readonly notesCount = signal(0);
  readonly notesRecordState = signal<NoteRecordState>('active');
  readonly currentPage = signal(1);
  readonly hasNextPage = signal(false);
  readonly hasPreviousPage = signal(false);
  readonly showCreateNoteForm = signal(false);
  readonly creatingNote = signal(false);
  readonly editingNoteId = signal<number | null>(null);
  readonly updatingNoteId = signal<number | null>(null);
  readonly archivingNoteDraftId = signal<number | null>(null);
  readonly archivingNoteId = signal<number | null>(null);
  readonly restoringNoteId = signal<number | null>(null);
  readonly noteWriteErrorMessage = signal<string | null>(null);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.notesCount() / NOTES_PAGE_SIZE)));
  readonly hasPagination = computed(() => this.notesCount() > NOTES_PAGE_SIZE);
  readonly emptyStateMessage = computed(() => {
    switch (this.notesRecordState()) {
      case 'archived':
        return 'No archived internal notes.';
      case 'all':
        return 'No internal notes recorded.';
      default:
        return 'No active internal notes.';
    }
  });

  readonly createNoteForm = this.fb.nonNullable.group({
    body: ['', [Validators.required]],
  });

  readonly editNoteForm = this.fb.nonNullable.group({
    body: ['', [Validators.required]],
  });

  readonly archiveNoteForm = this.fb.nonNullable.group({
    archive_reason: [''],
  });

  readonly recordStateOptions: ReadonlyArray<{ value: NoteRecordState; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
    { value: 'all', label: 'All' },
  ];

  constructor() {
    effect(
      () => {
        const personId = this.personId();

        untracked(() => {
          this.resetSectionState();
          this.loadNotes(personId, 1, 'active');
        });
      },
      { allowSignalWrites: true },
    );
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  changeRecordState(nextState: NoteRecordState): void {
    if (nextState === this.notesRecordState()) {
      return;
    }

    this.resetTransientUiState();
    this.loadNotes(this.personId(), 1, nextState);
  }

  goToPreviousPage(): void {
    if (!this.hasPreviousPage() || this.notesLoading()) {
      return;
    }

    this.resetTransientUiState();
    this.loadNotes(this.personId(), this.currentPage() - 1, this.notesRecordState());
  }

  goToNextPage(): void {
    if (!this.hasNextPage() || this.notesLoading()) {
      return;
    }

    this.resetTransientUiState();
    this.loadNotes(this.personId(), this.currentPage() + 1, this.notesRecordState());
  }

  openCreateNoteForm(): void {
    if (!this.canMutateInternalNotes()) {
      return;
    }

    this.resetTransientUiState();
    this.showCreateNoteForm.set(true);
    this.createNoteForm.reset({ body: '' });
  }

  cancelCreateNote(): void {
    this.showCreateNoteForm.set(false);
    this.creatingNote.set(false);
    this.noteWriteErrorMessage.set(null);
    this.createNoteForm.reset({ body: '' });
  }

  openEditNote(note: InternalNote): void {
    if (!this.canMutateInternalNotes() || note.archived_at) {
      return;
    }

    this.resetTransientUiState();
    this.editingNoteId.set(note.id);
    this.editNoteForm.reset({ body: note.body });
  }

  cancelEditNote(): void {
    this.editingNoteId.set(null);
    this.updatingNoteId.set(null);
    this.noteWriteErrorMessage.set(null);
    this.editNoteForm.reset({ body: '' });
  }

  openArchiveNote(note: InternalNote): void {
    if (!this.canMutateInternalNotes() || note.archived_at) {
      return;
    }

    this.resetTransientUiState();
    this.archivingNoteDraftId.set(note.id);
    this.archiveNoteForm.reset({ archive_reason: '' });
  }

  cancelArchiveNote(): void {
    this.archivingNoteDraftId.set(null);
    this.archivingNoteId.set(null);
    this.noteWriteErrorMessage.set(null);
    this.archiveNoteForm.reset({ archive_reason: '' });
  }

  showCreateBodyRequiredError(): boolean {
    return this.createNoteForm.controls.body.hasError('required') && this.createNoteForm.touched;
  }

  showEditBodyRequiredError(): boolean {
    return this.editNoteForm.controls.body.hasError('required') && this.editNoteForm.touched;
  }

  submitCreateNote(): void {
    if (!this.canMutateInternalNotes() || this.creatingNote()) {
      return;
    }

    if (this.createNoteForm.invalid) {
      this.createNoteForm.markAllAsTouched();
      return;
    }

    this.creatingNote.set(true);
    this.noteWriteErrorMessage.set(null);

    const payload = { body: this.createNoteForm.getRawValue().body.trim() };
    let writeSucceeded = false;

    this.peopleService
      .createPersonNote(this.personId(), payload)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.getNotesPage$(this.personId(), this.currentPage(), this.notesRecordState());
        }),
        tap((response) => {
          this.applyNotesPage(response, this.currentPage(), this.notesRecordState());
          this.showCreateNoteForm.set(false);
          this.createNoteForm.reset({ body: '' });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => undefined,
        error: (error: HttpErrorResponse) => {
          this.noteWriteErrorMessage.set(formatNoteMutationError('create', error, writeSucceeded));
          this.creatingNote.set(false);
          this.notesLoading.set(false);
        },
        complete: () => {
          this.creatingNote.set(false);
          this.notesLoading.set(false);
        },
      });
  }

  submitEditNote(note: InternalNote): void {
    if (!this.canMutateInternalNotes() || note.archived_at || this.updatingNoteId() === note.id) {
      return;
    }

    if (this.editNoteForm.invalid) {
      this.editNoteForm.markAllAsTouched();
      return;
    }

    this.updatingNoteId.set(note.id);
    this.noteWriteErrorMessage.set(null);

    const payload = { body: this.editNoteForm.getRawValue().body.trim() };
    let writeSucceeded = false;

    this.peopleService
      .updatePersonNote(this.personId(), note.id, payload)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.getNotesPage$(this.personId(), this.currentPage(), this.notesRecordState());
        }),
        tap((response) => {
          this.applyNotesPage(response, this.currentPage(), this.notesRecordState());
          this.editingNoteId.set(null);
          this.editNoteForm.reset({ body: '' });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => undefined,
        error: (error: HttpErrorResponse) => {
          this.noteWriteErrorMessage.set(formatNoteMutationError('update', error, writeSucceeded));
          this.updatingNoteId.set(null);
          this.notesLoading.set(false);
        },
        complete: () => {
          this.updatingNoteId.set(null);
          this.notesLoading.set(false);
        },
      });
  }

  submitArchiveNote(note: InternalNote): void {
    if (!this.canMutateInternalNotes() || note.archived_at || this.archivingNoteId() === note.id) {
      return;
    }

    this.archivingNoteId.set(note.id);
    this.noteWriteErrorMessage.set(null);

    const payload: ArchiveInternalNoteRequest = {
      archive_reason: this.archiveNoteForm.getRawValue().archive_reason.trim(),
    };
    let writeSucceeded = false;

    this.peopleService
      .archivePersonNote(this.personId(), note.id, payload)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.getNotesPage$(this.personId(), this.currentPage(), this.notesRecordState());
        }),
        tap((response) => {
          this.applyNotesPage(response, this.currentPage(), this.notesRecordState());
          this.archivingNoteDraftId.set(null);
          this.archiveNoteForm.reset({ archive_reason: '' });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => undefined,
        error: (error: HttpErrorResponse) => {
          this.noteWriteErrorMessage.set(formatNoteMutationError('archive', error, writeSucceeded));
          this.archivingNoteId.set(null);
          this.notesLoading.set(false);
        },
        complete: () => {
          this.archivingNoteId.set(null);
          this.notesLoading.set(false);
        },
      });
  }

  restoreNote(note: InternalNote): void {
    if (!this.canMutateInternalNotes() || !note.archived_at || this.restoringNoteId() === note.id) {
      return;
    }

    this.resetTransientUiState();
    this.restoringNoteId.set(note.id);
    this.noteWriteErrorMessage.set(null);

    let writeSucceeded = false;

    this.peopleService
      .restorePersonNote(this.personId(), note.id)
      .pipe(
        switchMap(() => {
          writeSucceeded = true;
          return this.getNotesPage$(this.personId(), this.currentPage(), this.notesRecordState());
        }),
        tap((response) => {
          this.applyNotesPage(response, this.currentPage(), this.notesRecordState());
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => undefined,
        error: (error: HttpErrorResponse) => {
          this.noteWriteErrorMessage.set(formatNoteMutationError('restore', error, writeSucceeded));
          this.restoringNoteId.set(null);
          this.notesLoading.set(false);
        },
        complete: () => {
          this.restoringNoteId.set(null);
          this.notesLoading.set(false);
        },
      });
  }

  private loadNotes(personId: number, page: number, recordState: NoteRecordState): void {
    this.notesLoading.set(true);
    this.notesErrorMessage.set(null);

    this.getNotesPage$(personId, page, recordState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.applyNotesPage(response, page, recordState);
        },
        error: () => {
          this.notesLoading.set(false);
          this.notesLoaded.set(true);
          this.notesErrorMessage.set('Internal notes could not be loaded right now.');
        },
        complete: () => {
          this.notesLoading.set(false);
        },
      });
  }

  private getNotesPage$(
    personId: number,
    page: number,
    recordState: NoteRecordState,
  ) {
    this.notesLoading.set(true);

    return this.peopleService
      .getPersonNotes(personId, {
        page,
        page_size: NOTES_PAGE_SIZE,
        record_state: recordState,
      })
      .pipe(
        switchMap((response) => {
          if (response.results.length === 0 && response.count > 0 && page > 1) {
            const fallbackPage = page - 1;

            return this.peopleService
              .getPersonNotes(personId, {
                page: fallbackPage,
                page_size: NOTES_PAGE_SIZE,
                record_state: recordState,
              })
              .pipe(
                tap(() => {
                  this.currentPage.set(fallbackPage);
                }),
              );
          }

          return of(response);
        }),
      );
  }

  private applyNotesPage(
    response: PaginatedResponse<InternalNote>,
    requestedPage: number,
    recordState: NoteRecordState,
  ): void {
    this.notes.set(response.results);
    this.notesCount.set(response.count);
    this.hasNextPage.set(Boolean(response.next));
    this.hasPreviousPage.set(Boolean(response.previous));
    this.notesLoaded.set(true);
    this.notesErrorMessage.set(null);
    this.notesRecordState.set(recordState);
    this.currentPage.set(response.results.length === 0 && response.count > 0 && requestedPage > 1 ? requestedPage - 1 : requestedPage);
  }

  private resetSectionState(): void {
    this.notes.set([]);
    this.notesLoaded.set(false);
    this.notesLoading.set(false);
    this.notesErrorMessage.set(null);
    this.notesCount.set(0);
    this.notesRecordState.set('active');
    this.currentPage.set(1);
    this.hasNextPage.set(false);
    this.hasPreviousPage.set(false);
    this.resetTransientUiState();
  }

  private resetTransientUiState(): void {
    this.showCreateNoteForm.set(false);
    this.creatingNote.set(false);
    this.editingNoteId.set(null);
    this.updatingNoteId.set(null);
    this.archivingNoteDraftId.set(null);
    this.archivingNoteId.set(null);
    this.restoringNoteId.set(null);
    this.noteWriteErrorMessage.set(null);
    this.createNoteForm.reset({ body: '' });
    this.editNoteForm.reset({ body: '' });
    this.archiveNoteForm.reset({ archive_reason: '' });
  }
}

function formatNoteMutationError(
  action: 'create' | 'update' | 'archive' | 'restore',
  error: HttpErrorResponse,
  refreshFailedAfterSuccess: boolean,
): string {
  if (refreshFailedAfterSuccess) {
    return 'The note change was saved, but the refreshed notes list could not be loaded right now.';
  }

  if (error.status === 403) {
    return 'You do not have permission to manage internal notes.';
  }

  if (error.status === 404) {
    return 'The requested person or note is not available in the CRM notes domain.';
  }

  if (error.status === 409) {
    switch (action) {
      case 'archive':
        return 'This note cannot be archived in its current state.';
      case 'restore':
        return 'This note cannot be restored in its current state.';
      default:
        return 'This note cannot be changed in its current state.';
    }
  }

  if (error.status === 400) {
    return 'Check the note fields and try again.';
  }

  return 'Internal notes could not be updated right now.';
}
