import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  SupplierPayment,
  SupplierPaymentCreateInput,
  SupplierPaymentUpdateInput,
} from '../models/supplier-payment.model';

@Injectable({
  providedIn: 'root',
})
export class SupplierPaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getSupplierPayments(projectId: number): Observable<SupplierPayment[]> {
    return this.http
      .get<SupplierPayment[] | { data: SupplierPayment[] }>(
        `${this.apiBaseUrl}/api/v1/supplier-payments?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  getSupplierPaymentById(id: number): Observable<SupplierPayment> {
    return this.http.get<SupplierPayment>(
      `${this.apiBaseUrl}/api/v1/supplier-payments/${id}`,
    );
  }

  createSupplierPayment(
    payload: SupplierPaymentCreateInput,
    files: File[] = [],
  ): Observable<SupplierPayment> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<SupplierPayment>(
      `${this.apiBaseUrl}/api/v1/supplier-payments`,
      fd,
    );
  }

  updateSupplierPayment(
    id: number,
    payload: SupplierPaymentUpdateInput,
    files: File[] = [],
  ): Observable<SupplierPayment> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<SupplierPayment>(
      `${this.apiBaseUrl}/api/v1/supplier-payments/${id}`,
      fd,
    );
  }

  deleteSupplierPayment(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/supplier-payments/${id}`,
    );
  }
}
