import { Attachment } from './attachment.model';

export interface SupplierPayment {
  id: number;
  project_id: number;
  supplier_id?: number;
  supplier_name?: string;
  po_number?: string;
  invoice_no?: string;
  total_supplier_value?: number;
  payment_percentage?: number;
  currency: string;
  amount_paid: number;
  payment_date: string;
  transaction_details: string;
  pending_amount?: number;
  remark?: string;
  remarks?: Array<{ remark: string }> | string[];
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;

  // Foreign Exchange & Bank Charges
  exchange_rate?: number;
  total_with_exchange?: number;
  bank_charges_currency?: string;
  bank_charges?: number;
  total_with_bank_charges?: number;
}

export interface SupplierPaymentCreateInput {
  project_id: number;
  payment_percentage?: number | null;
  currency: string;
  amount_paid: number;
  payment_date: string;
  transaction_details: string;
  pending_amount?: number | null;
  total_supplier_value?: number | null;
  remark?: string;
  remarks?: Array<{ remark: string }> | string[];

  // Foreign Exchange & Bank Charges
  exchange_rate?: number | null;
  total_with_exchange?: number | null;
  bank_charges_currency?: string | null;
  bank_charges?: number | null;
  total_with_bank_charges?: number | null;
}

export interface SupplierPaymentUpdateInput {
  payment_percentage?: number | null;
  currency?: string;
  amount_paid?: number;
  payment_date?: string;
  transaction_details?: string;
  pending_amount?: number | null;
  total_supplier_value?: number | null;
  remark?: string;
  remarks?: Array<{ remark: string }> | string[];

  // Foreign Exchange & Bank Charges
  exchange_rate?: number | null;
  total_with_exchange?: number | null;
  bank_charges_currency?: string | null;
  bank_charges?: number | null;
  total_with_bank_charges?: number | null;
}
