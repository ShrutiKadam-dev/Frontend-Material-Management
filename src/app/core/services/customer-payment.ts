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
            const raw = item as unknown as Record<string, unknown>;
            const invVal = Number(raw['invoice_value'] ?? raw['invoice_amount'] ?? raw['net_total'] ?? 0);
            const payAmt = Number(raw['payment_amount'] ?? raw['amount_paid'] ?? raw['amount'] ?? 0);
            const ldAmt = Number(raw['ld'] ?? raw['liquidated_damages'] ?? 0);
            const tdsAmt = Number(raw['tds'] ?? 0);
            const totalDed = ldAmt + tdsAmt;

            const pendingAmt = raw['pending_amount'] != null && !isNaN(Number(raw['pending_amount']))
              ? Number(raw['pending_amount'])
              : (raw['balance_amount'] !== undefined && !isNaN(Number(raw['balance_amount']))
                ? Number(raw['balance_amount'])
                : Math.max(0, invVal - payAmt - totalDed));

            const totalPaid = raw['total_paid_amount'] != null && !isNaN(Number(raw['total_paid_amount']))
              ? Number(raw['total_paid_amount'])
              : payAmt;

            const cumPercent = raw['cumulative_payment_percentage'] != null && !isNaN(Number(raw['cumulative_payment_percentage']))
              ? Number(raw['cumulative_payment_percentage'])
              : undefined;

            const payPercent = raw['payment_percentage'] != null && !isNaN(Number(raw['payment_percentage']))
              ? Number(raw['payment_percentage'])
              : undefined;

            const pendPercent = raw['pending_percentage'] != null && !isNaN(Number(raw['pending_percentage']))
              ? Number(raw['pending_percentage'])
              : undefined;

            const isCompleted = raw['is_payment_completed'] !== undefined
              ? Boolean(raw['is_payment_completed'])
              : (raw['payment_status'] === 'completed' || pendingAmt <= 0.01);

            const status = String(raw['payment_status'] || (isCompleted ? 'completed' : 'partial'));
            const statusMsg = raw['payment_status_message'] ? String(raw['payment_status_message']) : undefined;

            const invoiceNo = String(raw['invoice_no'] ?? raw['invoice_number'] ?? '');

            return {
              ...item,
              invoice_no: invoiceNo,
              invoice_number: invoiceNo,
              invoice_value: invVal,
              payment_amount: payAmt,
              amount_paid: payAmt,
              ld: ldAmt,
              liquidated_damages: ldAmt,
              tds: tdsAmt,
              total_deductions: totalDed,
              balance_amount: pendingAmt,
              pending_amount: pendingAmt,
              total_paid_amount: totalPaid,
              cumulative_payment_percentage: cumPercent,
              payment_percentage: payPercent,
              pending_percentage: pendPercent,
              is_payment_completed: isCompleted,
              payment_status: status,
              payment_status_message: statusMsg,
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
    const cleanPayload: Record<string, unknown> = {
      ...payload,
      invoice_number: payload.invoice_number || payload.invoice_no,
      amount_paid: payload.amount_paid ?? payload.payment_amount,
      liquidated_damages: payload.liquidated_damages ?? payload.ld,
    };
    fd.append('data', JSON.stringify(cleanPayload));
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
    const cleanPayload: Record<string, unknown> = {
      ...payload,
      ...(payload.invoice_no ? { invoice_number: payload.invoice_no } : {}),
      ...(payload.payment_amount !== undefined ? { amount_paid: payload.payment_amount } : {}),
      ...(payload.ld !== undefined ? { liquidated_damages: payload.ld } : {}),
    };
    fd.append('data', JSON.stringify(cleanPayload));
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
