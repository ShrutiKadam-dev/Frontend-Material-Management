import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { getCurrencySymbol } from '../constants/dropdown-options.constant';
import {
  LatestOrderConfirmation,
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
      .get<Record<string, unknown>>(
        `${this.apiBaseUrl}/api/v1/supplier-quotations/latest${query}`,
      )
      .pipe(
        map((res: Record<string, unknown>) => {
          if (!res) return null;
          let data = (res['data'] !== undefined ? res['data'] : res) as Record<string, unknown>;
          if (Array.isArray(data)) {
            data = (data as Array<Record<string, unknown>>)[0];
          }
          if (data && typeof data === 'object') {
            if (data['supplier_quotation']) data = data['supplier_quotation'] as Record<string, unknown>;
            else if (data['quotation']) data = data['quotation'] as Record<string, unknown>;
          }
          if (!data || typeof data !== 'object') return null;

          const incoterms = (data['incoterms'] || data['shipping_terms'] || '') as string;
          const shippingTerms = (data['shipping_terms'] || data['incoterms'] || '') as string;
          const paymentTerms = (data['payment_terms'] || '') as string;
          const warrantyPeriod = (data['warranty_period'] || data['warranty'] || '') as string;
          const deliveryPeriod = (data['delivery_period'] || data['delivery_terms'] || data['delivery_time'] || '') as string;
          const currencyUnit = (data['currency_unit'] || data['currency'] || '') as string;
          const currencySymbol = (data['currency_symbol'] || (currencyUnit ? getCurrencySymbol(currencyUnit) : '')) as string;

          const rawItems = Array.isArray(data['items']) ? (data['items'] as Array<Record<string, unknown>>) : [];
          return {
            currency_unit: currencyUnit,
            currency_symbol: currencySymbol,
            currency: currencyUnit,
            incoterms,
            shipping_terms: shippingTerms,
            payment_terms: paymentTerms,
            warranty_period: warrantyPeriod,
            delivery_period: deliveryPeriod,
            items: rawItems.map((it: Record<string, unknown>) => ({
              material_name: (it['material_name'] || it['item_name'] || it['description'] || '') as string,
              description: (it['description'] || it['material_name'] || it['item_name'] || '') as string,
              quantity: it['quantity'] != null ? Number(it['quantity']) : (it['qty'] != null ? Number(it['qty']) : 0),
              unit_price: it['unit_price'] != null ? Number(it['unit_price']) : (it['rate'] != null ? Number(it['rate']) : (it['price'] != null ? Number(it['price']) : 0)),
              net_amount: it['net_amount'] != null ? Number(it['net_amount']) : (Number(it['quantity'] || it['qty'] || 0) * Number(it['unit_price'] || it['rate'] || 0)),
              hsn_code: (it['hsn_code'] || it['hsn_sac'] || it['hsn'] || '') as string,
            })),
          };
      }),
      catchError(() => of(null)),
    );
  }

  getLatestOrderConfirmation(projectId?: number): Observable<LatestOrderConfirmation | null> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http
      .get<Record<string, unknown>>(
        `${this.apiBaseUrl}/api/v1/order-confirmations/latest${query}`,
      )
      .pipe(
        map((res: Record<string, unknown>) => {
          if (!res) return null;
          let data = (res['data'] !== undefined ? res['data'] : res) as Record<string, unknown>;
          if (Array.isArray(data)) {
            data = (data as Array<Record<string, unknown>>)[0];
          }
          if (data && typeof data === 'object') {
            if (data['order_confirmation']) data = data['order_confirmation'] as Record<string, unknown>;
            else if (data['order']) data = data['order'] as Record<string, unknown>;
          }
          if (!data || typeof data !== 'object') return null;

          const rawTotal = data['total_amount'] ?? data['amount'] ?? data['total_value'] ?? data['total_net_amount'];
          const totalAmount = rawTotal != null && rawTotal !== '' && !isNaN(Number(rawTotal)) ? Number(rawTotal) : undefined;

          const incoterms = (data['incoterms'] || data['shipping_terms'] || data['delivery_terms'] || '') as string;
          const shippingTerms = (data['shipping_terms'] || data['delivery_terms'] || data['incoterms'] || '') as string;
          const deliveryTerms = (data['delivery_terms'] || data['shipping_terms'] || data['incoterms'] || '') as string;
          const paymentTerms = (data['payment_terms'] || '') as string;
          const warrantyPeriod = (data['warranty_period'] || data['warranty'] || '') as string;
          const deliveryPeriod = (data['delivery_period'] || data['delivery_terms'] || data['delivery_time'] || '') as string;

          const currencyUnit = (data['currency_unit'] || data['currency'] || '') as string;
          const currencySymbol = (data['currency_symbol'] || (currencyUnit ? getCurrencySymbol(currencyUnit) : '')) as string;

          const rawItems = Array.isArray(data['items']) ? (data['items'] as Array<Record<string, unknown>>) : [];
          return {
            total_amount: totalAmount,
            currency_unit: currencyUnit,
            currency_symbol: currencySymbol,
            currency: currencyUnit,
            payment_terms: paymentTerms,
            warranty_period: warrantyPeriod,
            shipping_terms: shippingTerms,
            delivery_terms: deliveryTerms,
            incoterms,
            delivery_period: deliveryPeriod,
            items: rawItems.map((it: Record<string, unknown>) => ({
              material_name: (it['material_name'] || it['item_name'] || it['description'] || '') as string,
              description: (it['description'] || it['material_name'] || it['item_name'] || '') as string,
              quantity: it['quantity'] != null ? Number(it['quantity']) : (it['qty'] != null ? Number(it['qty']) : 0),
              unit_price: it['unit_price'] != null ? Number(it['unit_price']) : (it['rate'] != null ? Number(it['rate']) : (it['price'] != null ? Number(it['price']) : 0)),
              net_amount: it['net_amount'] != null ? Number(it['net_amount']) : (Number(it['quantity'] || it['qty'] || 0) * Number(it['unit_price'] || it['rate'] || 0)),
              hsn_code: (it['hsn_code'] || it['hsn_sac'] || it['hsn'] || '') as string,
            })),
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
