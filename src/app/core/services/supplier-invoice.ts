import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  SupplierInvoice,
  SupplierInvoiceCreateInput,
  SupplierInvoiceUpdateInput,
} from '../models/supplier-invoice.model';

@Injectable({
  providedIn: 'root',
})
export class SupplierInvoiceService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<SupplierInvoice[]> {
    return this.http
      .get<SupplierInvoice[] | { data: SupplierInvoice[] }>(
        `${this.apiBaseUrl}/api/v1/supplier-invoices?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  getById(id: number): Observable<SupplierInvoice> {
    return this.http.get<SupplierInvoice>(
      `${this.apiBaseUrl}/api/v1/supplier-invoices/${id}`,
    );
  }

  create(
    payload: SupplierInvoiceCreateInput,
    files: File[] = [],
  ): Observable<SupplierInvoice> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<SupplierInvoice>(
      `${this.apiBaseUrl}/api/v1/supplier-invoices`,
      fd,
    );
  }

  update(
    id: number,
    payload: SupplierInvoiceUpdateInput,
    files: File[] = [],
  ): Observable<SupplierInvoice> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<SupplierInvoice>(
      `${this.apiBaseUrl}/api/v1/supplier-invoices/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/supplier-invoices/${id}`,
    );
  }
}
