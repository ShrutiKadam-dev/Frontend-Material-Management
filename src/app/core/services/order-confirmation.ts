import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  LatestSupplierQuotation,
  OrderConfirmation,
  OrderConfirmationCreateInput,
  OrderConfirmationUpdateInput,
} from '../models/order-confirmation.model';

@Injectable({
  providedIn: 'root',
})
export class OrderConfirmationService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<OrderConfirmation[]> {
    return this.http
      .get<OrderConfirmation[] | { data: OrderConfirmation[] }>(
        `${this.apiBaseUrl}/api/v1/order-confirmations?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  getLatestSupplierQuotation(projectId?: number): Observable<LatestSupplierQuotation | null> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http
      .get<LatestSupplierQuotation | { data: LatestSupplierQuotation }>(
        `${this.apiBaseUrl}/api/v1/supplier-quotations/latest${query}`,
      )
      .pipe(
        map((res: any) => {
          if (!res) return null;
          const data = res.data || res;
          return {
            incoterms: data.incoterms || data.shipping_terms || '',
            shipping_terms: data.shipping_terms || data.incoterms || '',
            payment_terms: data.payment_terms || '',
            warranty_period: data.warranty_period || '',
            delivery_period: data.delivery_period || '',
            items: Array.isArray(data.items)
              ? data.items.map((it: any) => ({
                material_name: it.material_name || it.description || '',
                description: it.description || it.material_name || '',
                quantity: it.quantity || 0,
                unit_price: it.unit_price || 0,
                net_amount: it.net_amount || (Number(it.quantity || 0) * Number(it.unit_price || 0)),
                hsn_code: it.hsn_code || it.hsn_sac || '',
              }))
              : [],
          };
        }),
        catchError(() => of(null)),
      );
  }

  getById(id: number): Observable<OrderConfirmation> {
    return this.http.get<OrderConfirmation>(
      `${this.apiBaseUrl}/api/v1/order-confirmations/${id}`,
    );
  }

  create(
    payload: OrderConfirmationCreateInput,
    files: File[] = [],
  ): Observable<OrderConfirmation> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<OrderConfirmation>(
      `${this.apiBaseUrl}/api/v1/order-confirmations`,
      fd,
    );
  }

  update(
    id: number,
    payload: OrderConfirmationUpdateInput,
    files: File[] = [],
  ): Observable<OrderConfirmation> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<OrderConfirmation>(
      `${this.apiBaseUrl}/api/v1/order-confirmations/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/order-confirmations/${id}`,
    );
  }
}
