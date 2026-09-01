import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../http/api-config';
import {
  ImportBatchDetail,
  ImportBatchSummary,
  ImportReviewDetail,
  ImportReviewQueue,
  ImportReviewRecord,
  PaginatedImportRecordPreview,
} from './import-reconciliation.types';

@Injectable({ providedIn: 'root' })
export class ImportReconciliationService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);

  listBatches(): Observable<ImportBatchSummary[]> {
    return this.http.get<ImportBatchSummary[]>(`${this.api.apiBaseUrl}/imports/`);
  }

  getBatch(id: number): Observable<ImportBatchDetail> {
    return this.http.get<ImportBatchDetail>(`${this.api.apiBaseUrl}/imports/${id}/`);
  }

  getReviewQueue(id: number): Observable<ImportReviewQueue> {
    return this.http.get<ImportReviewQueue>(`${this.api.apiBaseUrl}/imports/${id}/review/`);
  }

  getBatchRecords(batchId: number, query: { page?: number; page_size?: number } = {}): Observable<PaginatedImportRecordPreview> {
    let params = new HttpParams();
    if (query.page) params = params.set('page', query.page);
    if (query.page_size) params = params.set('page_size', query.page_size);
    return this.http.get<PaginatedImportRecordPreview>(`${this.api.apiBaseUrl}/imports/${batchId}/records/`, { params });
  }

  getReviewRecord(batchId: number, recordId: number): Observable<ImportReviewDetail> {
    return this.http.get<ImportReviewDetail>(`${this.api.apiBaseUrl}/imports/${batchId}/review/${recordId}/`);
  }

  uploadMembershipForm(file: File): Observable<ImportBatchSummary> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportBatchSummary>(`${this.api.apiBaseUrl}/imports/membership-form/`, formData);
  }

  resolveSamePerson(batchId: number, recordId: number, personId: number): Observable<ImportReviewRecord> {
    return this.http.post<ImportReviewRecord>(
      `${this.api.apiBaseUrl}/imports/${batchId}/review/${recordId}/resolve/`,
      { resolution: 'SAME_PERSON', person_id: personId },
    );
  }

  resolveDifferentPerson(batchId: number, recordId: number): Observable<ImportReviewRecord> {
    return this.http.post<ImportReviewRecord>(
      `${this.api.apiBaseUrl}/imports/${batchId}/review/${recordId}/resolve/`,
      { resolution: 'DIFFERENT_PERSON' },
    );
  }
}
