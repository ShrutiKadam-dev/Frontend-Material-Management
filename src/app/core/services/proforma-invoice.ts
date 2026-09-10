import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  ProformaInvoice,
  ProformaInvoiceCreateInput,
  ProformaInvoiceUpdateInput,
} from '../models/proforma-invoice.model';

@Injectable({
  providedIn: 'root',
})
export class ProformaInvoiceService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<ProformaInvoice[]> {
    return this.http
      .get<ProformaInvoice[] | { data: ProformaInvoice[] }>(
        `${this.apiBaseUrl}/api/v1/proforma-invoices?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  getLatest(projectId?: number): Observable<ProformaInvoice | null> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http
      .get<ProformaInvoice | { data: ProformaInvoice }>(
        `${this.apiBaseUrl}/api/v1/proforma-invoices/latest${query}`,
      )
      .pipe(
        map((res: any) => (res && res.data ? res.data : res || null)),
        catchError(() => of(null)),
      );
  }

  getById(id: number): Observable<ProformaInvoice> {
    return this.http.get<ProformaInvoice>(
      `${this.apiBaseUrl}/api/v1/proforma-invoices/${id}`,
    );
  }

  create(
    payload: ProformaInvoiceCreateInput,
    files: File[] = [],
  ): Observable<ProformaInvoice> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<ProformaInvoice>(
      `${this.apiBaseUrl}/api/v1/proforma-invoices`,
      fd,
    );
  }

  update(
    id: number,
    payload: ProformaInvoiceUpdateInput,
    files: File[] = [],
  ): Observable<ProformaInvoice> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<ProformaInvoice>(
      `${this.apiBaseUrl}/api/v1/proforma-invoices/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/proforma-invoices/${id}`,
    );
  }
}
