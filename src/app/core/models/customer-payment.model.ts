import { Attachment } from './attachment.model';

export interface CustomerTaxInvoiceLatest {
  invoice_no: string;
  invoice_date: string;
  net_total: number; // this is invoice value
}

export interface CustomerPaymentRemarkItem {
  id?: number | string;
  entity_id?: number;
  project_id?: number;
  remark?: string;
  text?: string;
  step_number?: number;
  user?: string;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerPayment {
  id: number;
  project_id: number;
  customer_id?: number;
  invoice_no: string;
  invoice_number?: string;
  invoice_date: string;
  invoice_value: number; // or net_total from tax invoice
  payment_amount: number;
  amount_paid?: number | string;
  payment_date: string;
  ld: number; // Liquidated Damages deduction
  liquidated_damages?: number | string;
  tds: number; // Tax Deducted at Source
  total_deductions?: number;
  balance_amount?: number;

  // Milestone Settlement Fields
  payment_percentage?: number | string;
  cumulative_payment_percentage?: number | string;
  pending_amount?: number | string;
  pending_percentage?: number | string;
  remaining_amount_before_transaction?: number | string;
  total_paid_amount?: number | string;
  payment_status?: string; // e.g. 'completed' | 'partial'
  payment_status_message?: string;
  is_payment_completed?: boolean;

  remark?: string;
  remarks?: CustomerPaymentRemarkItem[] | Array<{ remark: string }> | string[];
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerPaymentCreateInput {
  project_id: number;
  customer_id?: number;
  invoice_no: string;
  invoice_number?: string;
  invoice_date: string;
  invoice_value: number;
  payment_amount: number;
  amount_paid?: number;
  payment_date: string;
  ld: number;
  liquidated_damages?: number;
  tds: number;
  payment_percentage?: number;
  remark?: string;
  remarks?: Array<{ remark: string }> | string[];
}

export interface CustomerPaymentUpdateInput extends Partial<CustomerPaymentCreateInput> {}

