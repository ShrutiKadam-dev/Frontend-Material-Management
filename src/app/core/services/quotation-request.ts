import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  QuotationRequest,
  QuotationRequestCreateInput,
} from '../models/quotation-request.model';

@Injectable({
  providedIn: 'root',
})
export class QuotationRequestService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<QuotationRequest[]> {
    return this.http.get<QuotationRequest[]>(
      `${this.apiBaseUrl}/api/v1/quotation-requests?project_id=${projectId}`,
    );
  }

  create(
    payload: QuotationRequestCreateInput,
    files: File[] = [],
  ): Observable<QuotationRequest> {
    const fd = new FormData();
    // Append JSON payload as string under 'data'
    fd.append('data', JSON.stringify(payload));
    // Append each file as binary part under 'file'
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<QuotationRequest>(
      `${this.apiBaseUrl}/api/v1/quotation-requests`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/quotation-requests/${id}`,
    );
  }
}
