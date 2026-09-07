import { Attachment } from './attachment.model';

export interface SupplierInvoiceItem {
  id?: number;
  supplier_invoice_id?: number;
  invoice_id?: number;
  material_name: string;
  description?: string;
  hsn_code?: string;
  quantity: number | string;
  unit_price?: number | string;
  net_amount?: number | string;
}

export interface SupplierInvoice {
  id: number;
  project_id: number;
  invoice_no: string;
  invoice_date: string;
  date?: string;
  currency: string;
  delivery_terms: string;
  shipping_terms?: string;
  incoterms?: string;
  payment_terms?: string;
  warranty_period?: string;
  delivery_period?: string;
  total_amount?: number;
  total_net_amount?: number;
  remark?: string;
  status?: string;
  attachments?: Attachment[];
  items?: SupplierInvoiceItem[];
  created_at?: string;
  updated_at?: string;
}

export interface SupplierInvoiceCreateInput {
  project_id: number;
  invoice_no: string;
  invoice_date: string;
  delivery_terms: string;
  payment_terms?: string;
  warranty_period?: string;
  delivery_period?: string;
  total_amount?: number;
  total_net_amount?: number;
  remark?: string;
  items: SupplierInvoiceItem[];
}

export interface SupplierInvoiceUpdateInput {
  project_id?: number;
  invoice_no?: string;
  invoice_date?: string;
  currency?: string;
  delivery_terms?: string;
  payment_terms?: string;
  warranty_period?: string;
  delivery_period?: string;
  total_amount?: number;
  total_net_amount?: number;
  remark?: string;
  items?: SupplierInvoiceItem[];
}
