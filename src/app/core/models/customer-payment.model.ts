import { Attachment } from './attachment.model';

export interface CustomerTaxInvoiceLatest {
  invoice_no: string;
  invoice_date: string;
  net_total: number; // this is invoice value
}

export interface CustomerPayment {
  id: number;
  project_id: number;
  invoice_no: string;
  invoice_date: string;
  invoice_value: number; // or net_total from tax invoice
  payment_amount: number;
  payment_date: string;
  ld: number; // Liquidated Damages deduction
  tds: number; // Tax Deducted at Source
  total_deductions?: number;
  balance_amount?: number;
  remark?: string;
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerPaymentCreateInput {
  project_id: number;
  invoice_no: string;
  invoice_date: string;
  invoice_value: number;
  payment_amount: number;
  payment_date: string;
  ld: number;
  tds: number;
  remark?: string;
}

export interface CustomerPaymentUpdateInput extends Partial<CustomerPaymentCreateInput> {}
