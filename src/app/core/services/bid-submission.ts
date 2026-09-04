import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  BidSubmission,
  BidSubmissionCreateInput,
  BidSubmissionUpdateInput,
} from '../models/bid-submission.model';

@Injectable({
  providedIn: 'root',
})
export class BidSubmissionService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<BidSubmission[]> {
    return this.http.get<BidSubmission[]>(
      `${this.apiBaseUrl}/api/v1/bid-submissions?project_id=${projectId}`,
    );
  }

  getById(id: number): Observable<BidSubmission> {
    return this.http.get<BidSubmission>(
      `${this.apiBaseUrl}/api/v1/bid-submissions/${id}`,
    );
  }

  create(
    payload: BidSubmissionCreateInput,
    files: File[] = [],
  ): Observable<BidSubmission> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<BidSubmission>(
      `${this.apiBaseUrl}/api/v1/bid-submissions`,
      fd,
    );
  }

  update(
    id: number,
    payload: BidSubmissionUpdateInput,
    files: File[] = [],
  ): Observable<BidSubmission> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<BidSubmission>(
      `${this.apiBaseUrl}/api/v1/bid-submissions/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/bid-submissions/${id}`,
    );
  }
}
