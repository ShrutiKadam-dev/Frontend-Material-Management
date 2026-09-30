import { Attachment } from './attachment.model';

export interface ProformaInvoiceItem {
  id?: number;
  proforma_invoice_id?: number;
  material_name: string;
  description?: string;
  hsn_code?: string;
  quantity: number | string;
  unit_price?: number | string;
  net_amount?: number | string;
  weight?: number | string;
  gross_weight?: number | string;
}
export interface LatestProformaInvoice {
  id?: number;
  project_id?: number;
  proforma_invoice_no?: string;
  invoice_no?: string;
  proforma_invoice_date?: string;
  delivery_period?: string;
  delivery_terms?: string;
  shipping_terms?: string;
  incoterms?: string;
  payment_terms?: string;
  warranty_period?: string;
  total_amount?: number | string;
  currency?: string;
  currency_unit?: string;
  currency_symbol?: string;
  items?: Array<{
    id?: number;
    material_name?: string;
    description?: string;
    hsn_code?: string;
    hsn_sac?: string;
    quantity?: number | string;
    unit_price?: number | string;
    net_amount?: number | string;
  }>;
  error_message?: string;
  error_code?: string;
  is_not_found?: boolean;
}

export interface ProformaInvoice {
  id: number;
  project_id: number;
  proforma_invoice_no: string;
  invoice_no?: string;
  proforma_invoice_date: string;
  date?: string;
  currency?: string;
  delivery_terms: string;
  shipping_terms?: string;
  incoterms?: string;
  payment_terms?: string;
  warranty_period?: string;
  delivery_period?: string;
  gross_weight?: number | string;
  weight?: number | string;
  total_amount?: number;
  total_net_amount?: number;
  remark?: string;
  remarks?: Array<{ remark: string }> | string[];
  status?: string;
  attachments?: Attachment[];
  items?: ProformaInvoiceItem[];
  created_at?: string;
  updated_at?: string;
}

export interface ProformaInvoiceCreateInput {
  project_id: number;
  proforma_invoice_no: string;
  proforma_invoice_date: string;
  currency?: string;
  delivery_terms: string;
  payment_terms?: string;
  warranty_period?: string;
  delivery_period?: string;
  gross_weight?: number | string;
  weight?: number | string;
  total_amount?: number;
  total_net_amount?: number;
  remark?: string;
  remarks?: Array<{ remark: string }> | string[];
  items: ProformaInvoiceItem[];
}

export interface ProformaInvoiceUpdateInput {
  project_id?: number;
  proforma_invoice_no?: string;
  proforma_invoice_date?: string;
  currency?: string;
  delivery_terms?: string;
  payment_terms?: string;
  warranty_period?: string;
  delivery_period?: string;
  gross_weight?: number | string;
  weight?: number | string;
  total_amount?: number;
  total_net_amount?: number;
  remark?: string;
  remarks?: Array<{ remark: string }> | string[];
  items?: ProformaInvoiceItem[];
}
