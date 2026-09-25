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
  LatestCustomerTaxInvoiceTemplate,
  LatestSupplierPackingListTemplate,
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
          const poNumber = String(data['po_number'] ?? data['po_no'] ?? data['purchase_order_no'] ?? '');
          return {
            po_number: poNumber,
            po_no: poNumber,
            po_date: String(data['po_date'] ?? data['date'] ?? ''),
            warranty_period: String(data['warranty_period'] ?? ''),
            gst_rate: Number(data['gst_rate'] ?? 0),
            gst_amount: Number(data['gst_amount'] ?? 0),
            total_net_amount: Number(data['total_net_amount'] ?? data['total_amount'] ?? 0),
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
                const poNumber = String(data['po_number'] ?? data['po_no'] ?? data['purchase_order_no'] ?? '');
                return {
                  po_number: poNumber,
                  po_no: poNumber,
                  po_date: String(data['po_date'] ?? data['date'] ?? ''),
                  warranty_period: String(data['warranty_period'] ?? ''),
                  gst_rate: Number(data['gst_rate'] ?? 0),
                  gst_amount: Number(data['gst_amount'] ?? 0),
                  total_net_amount: Number(data['total_net_amount'] ?? data['total_amount'] ?? 0),
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

  // ── 0.1 Fetch Latest Customer Tax Invoice for Auto-Patching ────
  getLatestCustomerTaxInvoice(projectId: number): Observable<LatestCustomerTaxInvoiceTemplate | null> {
    return this.http
      .get<LatestCustomerTaxInvoiceTemplate | { data: LatestCustomerTaxInvoiceTemplate }>(
        `${this.apiBaseUrl}/api/v1/customer-tax-invoices/latest?project_id=${projectId}`,
      )
      .pipe(
        map((res: unknown) => {
          if (!res || typeof res !== 'object') return null;
          const data = ((res as Record<string, unknown>)['data'] || res) as Record<string, unknown>;
          return {
            invoice_no: String(data['invoice_no'] ?? data['tax_invoice_no'] ?? ''),
            invoice_date: String(data['invoice_date'] ?? data['date'] ?? ''),
            net_total: Number(data['net_total'] ?? data['total_amount'] ?? 0),
            gst_rate: data['gst_rate'] !== undefined ? Number(data['gst_rate']) : undefined,
            gst_amount: data['gst_amount'] !== undefined ? Number(data['gst_amount']) : undefined,
            round_off: data['round_off'] !== undefined ? Number(data['round_off']) : undefined,
          };
        }),
        catchError(() => {
          // Fallback: try /api/v1/tax-invoices/latest
          return this.http
            .get<LatestCustomerTaxInvoiceTemplate | { data: LatestCustomerTaxInvoiceTemplate }>(
              `${this.apiBaseUrl}/api/v1/tax-invoices/latest?project_id=${projectId}`,
            )
            .pipe(
              map((res: unknown) => {
                if (!res || typeof res !== 'object') return null;
                const data = ((res as Record<string, unknown>)['data'] || res) as Record<string, unknown>;
                return {
                  invoice_no: String(data['invoice_no'] ?? data['tax_invoice_no'] ?? ''),
                  invoice_date: String(data['invoice_date'] ?? data['date'] ?? ''),
                  net_total: Number(data['net_total'] ?? data['total_amount'] ?? 0),
                  gst_rate: data['gst_rate'] !== undefined ? Number(data['gst_rate']) : undefined,
                  gst_amount: data['gst_amount'] !== undefined ? Number(data['gst_amount']) : undefined,
                  round_off: data['round_off'] !== undefined ? Number(data['round_off']) : undefined,
                };
              }),
              catchError(() => of(null)),
            );
        }),
      );
  }

  // ── 0.2 Fetch Latest Supplier Packing List for Auto-Patching ───
  getLatestSupplierPackingList(projectId: number): Observable<LatestSupplierPackingListTemplate | null> {
    return this.http
      .get<any>(`${this.apiBaseUrl}/api/v1/supplier-packing-lists/latest?project_id=${projectId}`)
      .pipe(
        map((res: any) => {
          if (!res) return null;
          let data = res.data !== undefined ? res.data : res;
          if (Array.isArray(data)) {
            if (!data.length) return null;
            data = data[0];
          }
          if (data && typeof data === 'object') {
            if (data.supplier_packing_list) data = data.supplier_packing_list;
            else if (data.packing_list) data = data.packing_list;
          }
          if (!data || typeof data !== 'object') return null;

          const totalWeight =
            data.total_weight ??
            data.net_weight ??
            data.weight ??
            data.total_net_weight ??
            '';

          const grossWeight =
            data.total_gross_weight_kg ??
            data.total_gross_weight ??
            data.gross_weight ??
            data.gross_weight_kg ??
            '';

          const rawItems = Array.isArray(data.items)
            ? data.items
            : Array.isArray(data.packing_items)
            ? data.packing_items
            : Array.isArray(data.materials)
            ? data.materials
            : [];

          return {
            ...data,
            total_weight: totalWeight,
            net_weight: totalWeight,
            total_gross_weight_kg: grossWeight,
            gross_weight: grossWeight,
            total_gross_weight: grossWeight,
            packing_list_no: data.packing_list_no || data.packing_no || '',
            packing_list_date: data.packing_list_date || data.date || '',
            packing_condition: data.packing_condition || '',
            total_no_of_packs: data.total_no_of_packs || data.packs || 1,
            items: rawItems.map((it: any) => ({
              material_name: String(
                it.material_name ||
                it.item_name ||
                it.description ||
                it.material_description ||
                it.name ||
                it.item_code ||
                'Item'
              ).trim(),
              hsn_code: String(it.hsn_code || it.hsn_sac || it.hsn || '').trim(),
              quantity: Number(it.quantity ?? it.qty ?? 1) || 1,
              weight: Number(it.weight ?? it.total_weight ?? it.unit_weight ?? 0) || 0,
              unit_weight: Number(it.unit_weight ?? it.weight ?? 0) || 0,
              total_weight: Number(it.total_weight ?? it.weight ?? 0) || 0,
            })),
          } as LatestSupplierPackingListTemplate;
        }),
        catchError(() => of(null)),
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
