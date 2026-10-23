import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  LatestBidSubmission,
  PurchaseOrder,
  PurchaseOrderCreateInput,
  PurchaseOrderUpdateInput,
} from '../models/purchase-order.model';

@Injectable({
  providedIn: 'root',
})
export class PurchaseOrderService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<PurchaseOrder[]> {
    return this.http
      .get<PurchaseOrder[] | { data: PurchaseOrder[] }>(
        `${this.apiBaseUrl}/api/v1/purchase-orders?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  getLatestBidSubmission(projectId?: number): Observable<LatestBidSubmission | null> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http
      .get<LatestBidSubmission | { data: LatestBidSubmission }>(
        `${this.apiBaseUrl}/api/v1/bid-submissions/latest${query}`,
      )
      .pipe(
        map((res: unknown) => {
          if (!res) return null;
          const resObj = res as Record<string, unknown>;
          const data = (resObj['data'] || resObj) as Record<string, unknown>;
          const rawItems = Array.isArray(data['items']) ? (data['items'] as Array<Record<string, unknown>>) : [];
          return {
            gst_rate: data['gst_rate'] as number | undefined,
            delivery_term: (data['delivery_term'] || data['delivery_terms']) as string | undefined,
            delivery_terms: (data['delivery_term'] || data['delivery_terms']) as string | undefined,
            payment_terms: data['payment_terms'] as string | undefined,
            warranty_period: data['warranty_period'] as string | undefined,
            items: rawItems.map((it: Record<string, unknown>) => ({
              description: String(it['description'] || it['material_name'] || ''),
              material_name: String(it['material_name'] || it['description'] || ''),
              quantity: Number(it['quantity']) || 0,
              unit_price: Number(it['unit_price']) || 0,
              hsn_code: String(it['hsn_code'] || it['hsn_sac'] || ''),
              hsn_sac: String(it['hsn_sac'] || it['hsn_code'] || ''),
            })),
          };
        }),
        catchError(() => of(null)),
      );
  }

  getById(id: number): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(
      `${this.apiBaseUrl}/api/v1/purchase-orders/${id}`,
    );
  }

  create(
    payload: PurchaseOrderCreateInput,
    files: File[] = [],
  ): Observable<PurchaseOrder> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<PurchaseOrder>(
      `${this.apiBaseUrl}/api/v1/purchase-orders`,
      fd,
    );
  }

  update(
    id: number,
    payload: PurchaseOrderUpdateInput,
    files: File[] = [],
  ): Observable<PurchaseOrder> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<PurchaseOrder>(
      `${this.apiBaseUrl}/api/v1/purchase-orders/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/purchase-orders/${id}`,
    );
  }
}
