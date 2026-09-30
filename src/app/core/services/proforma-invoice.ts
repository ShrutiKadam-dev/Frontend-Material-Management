import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  LatestProformaInvoice,
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

  getLatest(projectId?: number): Observable<LatestProformaInvoice | null> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http
      .get<any>(
        `${this.apiBaseUrl}/api/v1/proforma-invoices/latest${query}`,
      )
      .pipe(
        map((res: any) => {
          if (!res) return null;
          let data = res.data !== undefined ? res.data : res;
          if (Array.isArray(data)) {
            data = data[0];
          }
          if (data && typeof data === 'object') {
            if (data.proforma_invoice) data = data.proforma_invoice;
            else if (data.proforma) data = data.proforma;
            else if (data.invoice) data = data.invoice;
          }
          if (!data || typeof data !== 'object') return null;

          const rawTotal = data.total_amount ?? data.amount ?? data.total_value ?? data.total_net_amount;
          const totalAmount =
            rawTotal != null && rawTotal !== '' && !isNaN(Number(rawTotal))
              ? Number(rawTotal)
              : rawTotal;

          const deliveryTerms = data.delivery_terms || data.shipping_terms || data.incoterms || '';
          const shippingTerms = data.shipping_terms || data.delivery_terms || data.incoterms || '';
          const incoterms = data.incoterms || data.delivery_terms || data.shipping_terms || '';
          const paymentTerms = data.payment_terms || '';
          const warrantyPeriod = data.warranty_period || data.warranty || '';
          const deliveryPeriod = data.delivery_period || data.delivery_terms || data.delivery_time || '';

          return {
            id: data.id,
            project_id: data.project_id,
            proforma_invoice_no: data.proforma_invoice_no || data.invoice_no,
            invoice_no: data.invoice_no || data.proforma_invoice_no,
            proforma_invoice_date: data.proforma_invoice_date || data.date,
            delivery_period: deliveryPeriod,
            delivery_terms: deliveryTerms,
            shipping_terms: shippingTerms,
            incoterms: incoterms,
            payment_terms: paymentTerms,
            warranty_period: warrantyPeriod,
            total_amount: totalAmount,
            currency: data.currency || data.currency_unit || '',
            currency_unit: data.currency_unit || data.currency || '',
            items: Array.isArray(data.items)
              ? data.items.map((it: any) => ({
                  id: it.id,
                  material_name: it.material_name || it.item_name || it.description || 'Material Item',
                  description: it.description || it.material_name || it.item_name || '',
                  hsn_code: it.hsn_code || it.hsn_sac || it.hsn || '',
                  quantity:
                    it.quantity != null
                      ? isNaN(Number(it.quantity))
                        ? it.quantity
                        : Number(it.quantity)
                      : 1,
                  unit_price:
                    it.unit_price != null
                      ? isNaN(Number(it.unit_price))
                        ? it.unit_price
                        : Number(it.unit_price)
                      : 0,
                  net_amount:
                    it.net_amount != null
                      ? isNaN(Number(it.net_amount))
                        ? it.net_amount
                        : Number(it.net_amount)
                      : (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
                }))
              : [],
          };
        }),
        catchError((err) => {
          const backendMsg =
            err?.error?.error?.message ||
            err?.error?.message ||
            (err?.status === 404
              ? (projectId
                  ? `No proforma invoice found for project ID ${projectId}.`
                  : 'No proforma invoice found for this project.')
              : null);
          const backendCode =
            err?.error?.error?.code ||
            err?.error?.code ||
            (err?.status === 404 ? 'PROFORMA_INVOICE_NOT_FOUND' : undefined);

          return of({
            items: [],
            error_message: backendMsg || undefined,
            error_code: backendCode || undefined,
            is_not_found: true,
          } as LatestProformaInvoice);
        }),
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
