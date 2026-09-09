import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  CustomerTaxInvoice,
  CustomerTaxInvoiceCreateInput,
  CustomerTaxInvoiceUpdateInput,
  CustomerPackingList,
  CustomerPackingListCreateInput,
  CustomerPackingListUpdateInput,
  CustomerDeliveryChallan,
  CustomerDeliveryChallanCreateInput,
  CustomerDeliveryChallanUpdateInput,
  CustomerWarrantyCertificate,
  CustomerWarrantyCertificateCreateInput,
  CustomerWarrantyCertificateUpdateInput,
  CustomerTransportDetail,
  CustomerTransportDetailCreateInput,
  CustomerTransportDetailUpdateInput,
  LatestPurchaseOrderTemplate,
} from '../models/customer-delivery.model';

@Injectable({
  providedIn: 'root',
})
export class CustomerDeliveryService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  // ── 0. Fetch Latest PO Template for Auto-Patching ─────────────
  getLatestPurchaseOrder(projectId: number): Observable<LatestPurchaseOrderTemplate | null> {
    return this.http
      .get<LatestPurchaseOrderTemplate | { data: LatestPurchaseOrderTemplate }>(
        `${this.apiBaseUrl}/api/v1/purchase-orders/latest?project_id=${projectId}`,
      )
      .pipe(
        map((res: unknown) => {
          if (!res || typeof res !== 'object') return null;
          const data = ((res as Record<string, unknown>)['data'] || res) as Record<string, unknown>;
          const rawItems = (data['items'] as unknown[]) || [];
          return {
            gst_rate: Number(data['gst_rate'] ?? 0),
            gst_amount: Number(data['gst_amount'] ?? 0),
            total_net_amount: Number(data['total_net_amount'] ?? data['total_amount'] ?? 0),
            po_no: String(data['po_no'] ?? data['purchase_order_no'] ?? ''),
            po_date: String(data['po_date'] ?? data['date'] ?? ''),
            warranty_period: String(data['warranty_period'] ?? ''),
            items: rawItems.map((it: unknown) => {
              const item = it as Record<string, unknown>;
              return {
                material_name: String(item['material_name'] ?? item['description'] ?? 'Item'),
                hsn_code: String(item['hsn_code'] ?? item['hsn_sac'] ?? ''),
                quantity: Number(item['quantity'] ?? 1),
                unit_price: Number(item['unit_price'] ?? 0),
                net_amount: Number(item['net_amount'] ?? item['total_price'] ?? 0),
              };
            }),
          };
        }),
        catchError(() => {
          // Fallback: try fetching all purchase orders and pick the latest
          return this.http
            .get<unknown[] | { data: unknown[] }>(
              `${this.apiBaseUrl}/api/v1/purchase-orders?project_id=${projectId}`,
            )
            .pipe(
              map((res: unknown) => {
                if (!res || typeof res !== 'object') return null;
                const list = Array.isArray(res)
                  ? res
                  : (res as Record<string, unknown[]>)['data'] || [];
                if (!list.length) return null;
                const data = list[list.length - 1] as Record<string, unknown>;
                const rawItems = (data['items'] as unknown[]) || [];
                return {
                  gst_rate: Number(data['gst_rate'] ?? 0),
                  gst_amount: Number(data['gst_amount'] ?? 0),
                  total_net_amount: Number(data['total_net_amount'] ?? data['total_amount'] ?? 0),
                  po_no: String(data['po_no'] ?? data['purchase_order_no'] ?? ''),
                  po_date: String(data['po_date'] ?? data['date'] ?? ''),
                  warranty_period: String(data['warranty_period'] ?? ''),
                  items: rawItems.map((it: unknown) => {
                    const item = it as Record<string, unknown>;
                    return {
                      material_name: String(item['material_name'] ?? item['description'] ?? 'Item'),
                      hsn_code: String(item['hsn_code'] ?? item['hsn_sac'] ?? ''),
                      quantity: Number(item['quantity'] ?? 1),
                      unit_price: Number(item['unit_price'] ?? 0),
                      net_amount: Number(item['net_amount'] ?? item['total_price'] ?? 0),
                    };
                  }),
                };
              }),
              catchError(() => of(null)),
            );
        }),
      );
  }

  // ── 1. Tax Invoices ────────────────────────────────────────────
  getTaxInvoices(projectId: number): Observable<CustomerTaxInvoice[]> {
    return this.http
      .get<CustomerTaxInvoice[] | { data: CustomerTaxInvoice[] }>(
        `${this.apiBaseUrl}/api/v1/customer-tax-invoices?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() =>
          this.http
            .get<CustomerTaxInvoice[] | { data: CustomerTaxInvoice[] }>(
              `${this.apiBaseUrl}/api/v1/tax-invoices?project_id=${projectId}`,
            )
            .pipe(
              map((r) => (Array.isArray(r) ? r : r?.data || [])),
              catchError(() => of([])),
            ),
        ),
      );
  }

  createTaxInvoice(
    payload: CustomerTaxInvoiceCreateInput,
    files: File[] = [],
  ): Observable<CustomerTaxInvoice> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.post<CustomerTaxInvoice>(
      `${this.apiBaseUrl}/api/v1/customer-tax-invoices`,
      fd,
    );
  }

  updateTaxInvoice(
    id: number,
    payload: CustomerTaxInvoiceUpdateInput,
    files: File[] = [],
  ): Observable<CustomerTaxInvoice> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.patch<CustomerTaxInvoice>(
      `${this.apiBaseUrl}/api/v1/customer-tax-invoices/${id}`,
      fd,
    );
  }

  deleteTaxInvoice(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/customer-tax-invoices/${id}`,
    );
  }

  // ── 2. Customer Packing Lists ──────────────────────────────────
  getPackingLists(projectId: number): Observable<CustomerPackingList[]> {
    return this.http
      .get<CustomerPackingList[] | { data: CustomerPackingList[] }>(
        `${this.apiBaseUrl}/api/v1/customer-packing-lists?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() =>
          this.http
            .get<CustomerPackingList[] | { data: CustomerPackingList[] }>(
              `${this.apiBaseUrl}/api/v1/delivery-packing-lists?project_id=${projectId}`,
            )
            .pipe(
              map((r) => (Array.isArray(r) ? r : r?.data || [])),
              catchError(() => of([])),
            ),
        ),
      );
  }

  createPackingList(
    payload: CustomerPackingListCreateInput,
    files: File[] = [],
  ): Observable<CustomerPackingList> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.post<CustomerPackingList>(
      `${this.apiBaseUrl}/api/v1/customer-packing-lists`,
      fd,
    );
  }

  updatePackingList(
    id: number,
    payload: CustomerPackingListUpdateInput,
    files: File[] = [],
  ): Observable<CustomerPackingList> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.patch<CustomerPackingList>(
      `${this.apiBaseUrl}/api/v1/customer-packing-lists/${id}`,
      fd,
    );
  }

  deletePackingList(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/customer-packing-lists/${id}`,
    );
  }

  // ── 3. Delivery Challans ───────────────────────────────────────
  getDeliveryChallans(projectId: number): Observable<CustomerDeliveryChallan[]> {
    return this.http
      .get<CustomerDeliveryChallan[] | { data: CustomerDeliveryChallan[] }>(
        `${this.apiBaseUrl}/api/v1/delivery-challans?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  createDeliveryChallan(
    payload: CustomerDeliveryChallanCreateInput,
    files: File[] = [],
  ): Observable<CustomerDeliveryChallan> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.post<CustomerDeliveryChallan>(
      `${this.apiBaseUrl}/api/v1/delivery-challans`,
      fd,
    );
  }

  updateDeliveryChallan(
    id: number,
    payload: CustomerDeliveryChallanUpdateInput,
    files: File[] = [],
  ): Observable<CustomerDeliveryChallan> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.patch<CustomerDeliveryChallan>(
      `${this.apiBaseUrl}/api/v1/delivery-challans/${id}`,
      fd,
    );
  }

  deleteDeliveryChallan(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/delivery-challans/${id}`,
    );
  }

  // ── 4. Warranty Certificates ───────────────────────────────────
  getWarrantyCertificates(projectId: number): Observable<CustomerWarrantyCertificate[]> {
    return this.http
      .get<CustomerWarrantyCertificate[] | { data: CustomerWarrantyCertificate[] }>(
        `${this.apiBaseUrl}/api/v1/warranty-certificates?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  createWarrantyCertificate(
    payload: CustomerWarrantyCertificateCreateInput,
    files: File[] = [],
  ): Observable<CustomerWarrantyCertificate> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.post<CustomerWarrantyCertificate>(
      `${this.apiBaseUrl}/api/v1/warranty-certificates`,
      fd,
    );
  }

  updateWarrantyCertificate(
    id: number,
    payload: CustomerWarrantyCertificateUpdateInput,
    files: File[] = [],
  ): Observable<CustomerWarrantyCertificate> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.patch<CustomerWarrantyCertificate>(
      `${this.apiBaseUrl}/api/v1/warranty-certificates/${id}`,
      fd,
    );
  }

  deleteWarrantyCertificate(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/warranty-certificates/${id}`,
    );
  }

  // ── 5. Transport Details ───────────────────────────────────────
  getTransportDetails(projectId: number): Observable<CustomerTransportDetail[]> {
    return this.http
      .get<CustomerTransportDetail[] | { data: CustomerTransportDetail[] }>(
        `${this.apiBaseUrl}/api/v1/transport-details?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() =>
          this.http
            .get<CustomerTransportDetail[] | { data: CustomerTransportDetail[] }>(
              `${this.apiBaseUrl}/api/v1/delivery-transports?project_id=${projectId}`,
            )
            .pipe(
              map((r) => (Array.isArray(r) ? r : r?.data || [])),
              catchError(() => of([])),
            ),
        ),
      );
  }

  createTransportDetail(
    payload: CustomerTransportDetailCreateInput,
    files: File[] = [],
  ): Observable<CustomerTransportDetail> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.post<CustomerTransportDetail>(
      `${this.apiBaseUrl}/api/v1/transport-details`,
      fd,
    );
  }

  updateTransportDetail(
    id: number,
    payload: CustomerTransportDetailUpdateInput,
    files: File[] = [],
  ): Observable<CustomerTransportDetail> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.patch<CustomerTransportDetail>(
      `${this.apiBaseUrl}/api/v1/transport-details/${id}`,
      fd,
    );
  }

  deleteTransportDetail(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/transport-details/${id}`,
    );
  }
}
