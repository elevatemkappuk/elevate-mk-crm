import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../http/api-config';
import {
  ImportBatchDetail,
  ImportBatchSummary,
  ImportReviewQueue,
  ImportReviewRecord,
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

  getReviewRecord(batchId: number, recordId: number): Observable<ImportReviewRecord> {
    return this.http.get<ImportReviewRecord>(`${this.api.apiBaseUrl}/imports/${batchId}/review/${recordId}/`);
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
