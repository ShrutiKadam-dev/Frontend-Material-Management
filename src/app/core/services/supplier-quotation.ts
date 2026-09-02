import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  SupplierQuotation,
  SupplierQuotationCreateInput,
  SupplierQuotationUpdateInput,
} from '../models/supplier-quotation.model';

@Injectable({
  providedIn: 'root',
})
export class SupplierQuotationService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<SupplierQuotation[]> {
    return this.http.get<SupplierQuotation[]>(
      `${this.apiBaseUrl}/api/v1/supplier-quotations?project_id=${projectId}`,
    );
  }

  getById(id: number): Observable<SupplierQuotation> {
    return this.http.get<SupplierQuotation>(
      `${this.apiBaseUrl}/api/v1/supplier-quotations/${id}`,
    );
  }

  /**
   * Creates a new supplier quotation via POST /api/v1/supplier-quotations.
   * - `data`: JSON string matching the specified schema
   * - `file`: one entry per attachment
   */
  create(
    payload: SupplierQuotationCreateInput,
    files: File[] = [],
  ): Observable<SupplierQuotation> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<SupplierQuotation>(
      `${this.apiBaseUrl}/api/v1/supplier-quotations`,
      fd,
    );
  }

  /**
   * Updates an existing supplier quotation via PATCH /api/v1/supplier-quotations/{id}.
   * - `data`: JSON string of updated fields
   * - `file`: one entry per new attachment
   */
  update(
    id: number,
    payload: SupplierQuotationUpdateInput,
    files: File[] = [],
  ): Observable<SupplierQuotation> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<SupplierQuotation>(
      `${this.apiBaseUrl}/api/v1/supplier-quotations/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/supplier-quotations/${id}`,
    );
  }
}
