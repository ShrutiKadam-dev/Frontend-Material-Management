import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  CustomerQuotation,
  CustomerQuotationCreateInput,
  CustomerQuotationUpdateInput,
} from '../models/customer-quotation.model';

@Injectable({
  providedIn: 'root',
})
export class CustomerQuotationService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<CustomerQuotation[]> {
    return this.http.get<CustomerQuotation[]>(
      `${this.apiBaseUrl}/api/v1/customer-quotations?project_id=${projectId}`,
    );
  }

  create(
    payload: CustomerQuotationCreateInput,
    files: File[] = [],
  ): Observable<CustomerQuotation> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<CustomerQuotation>(
      `${this.apiBaseUrl}/api/v1/customer-quotations`,
      fd,
    );
  }

  update(
    id: number,
    payload: CustomerQuotationUpdateInput,
    files: File[] = [],
  ): Observable<CustomerQuotation> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<CustomerQuotation>(
      `${this.apiBaseUrl}/api/v1/customer-quotations/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/customer-quotations/${id}`,
    );
  }


}
