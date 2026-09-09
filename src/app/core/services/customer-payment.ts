import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  CustomerPayment,
  CustomerPaymentCreateInput,
  CustomerPaymentUpdateInput,
  CustomerTaxInvoiceLatest,
} from '../models/customer-payment.model';

@Injectable({
  providedIn: 'root',
})
export class CustomerPaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /**
   * Fetch Latest Customer Tax Invoice template for auto-populating
   * Invoice No, Invoice Date, and Net Total (Invoice Value).
   */
  getLatestCustomerTaxInvoice(
    projectId: number,
  ): Observable<CustomerTaxInvoiceLatest | null> {
    return this.http
      .get<CustomerTaxInvoiceLatest | { data: CustomerTaxInvoiceLatest }>(
        `${this.apiBaseUrl}/api/v1/customer-tax-invoices/latest?project_id=${projectId}`,
      )
      .pipe(
        map((res: unknown) => {
          if (!res || typeof res !== 'object') return null;
          const data = ((res as Record<string, unknown>)['data'] || res) as Record<string, unknown>;
          return {
            invoice_no: String(data['invoice_no'] ?? ''),
            invoice_date: String(data['invoice_date'] ?? ''),
            net_total: Number(data['net_total'] ?? data['total_amount'] ?? data['invoice_value'] ?? 0),
          };
        }),
        catchError(() => {
          // Fallback: try fetching all customer tax invoices and pick the latest one
          return this.http
            .get<unknown[] | { data: unknown[] }>(
              `${this.apiBaseUrl}/api/v1/customer-tax-invoices?project_id=${projectId}`,
            )
            .pipe(
              map((res: unknown) => {
                if (!res || typeof res !== 'object') return null;
                const list = Array.isArray(res)
                  ? res
                  : (res as Record<string, unknown[]>)['data'] || [];
                if (!list.length) return null;
                const data = list[list.length - 1] as Record<string, unknown>;
                return {
                  invoice_no: String(data['invoice_no'] ?? ''),
                  invoice_date: String(data['invoice_date'] ?? ''),
                  net_total: Number(data['net_total'] ?? data['total_amount'] ?? data['invoice_value'] ?? 0),
                };
              }),
              catchError(() => of(null)),
            );
        }),
      );
  }

  /**
   * Fetch all recorded customer payments for a project.
   */
  getCustomerPayments(projectId: number): Observable<CustomerPayment[]> {
    return this.http
      .get<CustomerPayment[] | { data: CustomerPayment[] }>(
        `${this.apiBaseUrl}/api/v1/customer-payments?project_id=${projectId}`,
      )
      .pipe(
        map((res) => {
          const list = Array.isArray(res) ? res : res?.data || [];
          return list.map((item) => {
            const invVal = Number(item.invoice_value ?? (item as any).invoice_amount ?? (item as any).net_total ?? 0);
            const payAmt = Number(item.payment_amount ?? (item as any).amount ?? 0);
            const ldAmt = Number(item.ld ?? 0);
            const tdsAmt = Number(item.tds ?? 0);
            const totalDed = ldAmt + tdsAmt;
            const balance = item.balance_amount !== undefined
              ? Number(item.balance_amount)
              : Math.max(0, invVal - payAmt - totalDed);

            return {
              ...item,
              invoice_value: invVal,
              payment_amount: payAmt,
              ld: ldAmt,
              tds: tdsAmt,
              total_deductions: totalDed,
              balance_amount: balance,
            };
          });
        }),
        catchError(() =>
          this.http
            .get<CustomerPayment[] | { data: CustomerPayment[] }>(
              `${this.apiBaseUrl}/api/v1/payments?project_id=${projectId}&payment_type=customer`,
            )
            .pipe(
              map((r) => (Array.isArray(r) ? r : r?.data || [])),
              catchError(() => of([])),
            ),
        ),
      );
  }

  /**
   * Record a new customer payment with optional file attachments.
   */
  createCustomerPayment(
    payload: CustomerPaymentCreateInput,
    files: File[] = [],
  ): Observable<CustomerPayment> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.post<CustomerPayment>(
      `${this.apiBaseUrl}/api/v1/customer-payments`,
      fd,
    );
  }

  /**
   * Update an existing customer payment record.
   */
  updateCustomerPayment(
    id: number,
    payload: CustomerPaymentUpdateInput,
    files: File[] = [],
  ): Observable<CustomerPayment> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((f) => fd.append('file', f, f.name));
    return this.http.patch<CustomerPayment>(
      `${this.apiBaseUrl}/api/v1/customer-payments/${id}`,
      fd,
    );
  }

  /**
   * Delete a customer payment record.
   */
  deleteCustomerPayment(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/customer-payments/${id}`,
    );
  }
}
