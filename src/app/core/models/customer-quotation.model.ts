import { Attachment } from './attachment.model';

export interface CustomerQuotationItem {
  id?: number;
  cost_sheet_item_id?: number;
  quotation_number?: string;
  material_name: string;
  item_code?: string;
  quantity: string | number;
  unit_price?: string | number;
  net_amount?: string | number;
  customs_duty_rate?: number;
}

export interface CustomerQuotation {
  id: number;
  project_id: number;
  customer_id: number;
  customer_name?: string;
  quotation_number: string;
  quotation_date: string;
  quotation_value: string;
  currency_unit?: string;
  currency_symbol?: string;
  total_net_amount?: number;
  validity: string;
  incoterms?: string;
  payment_terms?: string;
  delivery_period?: string;
  remark: string;
  attachments: Attachment[];
  items: CustomerQuotationItem[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerQuotationCreateInput {
  project_id: number;
  customer_id: number;
  quotation_number: string;
  quotation_date: string;
  quotation_value: string;
  currency_unit?: string;
  currency_symbol?: string;
  total_net_amount?: number;
  validity: string;
  incoterms?: string;
  payment_terms?: string;
  delivery_period?: string;
  remark: string;
  items: CustomerQuotationItem[];
}

export interface CustomerQuotationUpdateInput {
  project_id?: number;
  customer_id?: number;
  quotation_number?: string;
  quotation_date?: string;
  quotation_value?: string;
  currency_unit?: string;
  currency_symbol?: string;
  total_net_amount?: number;
  validity?: string;
  incoterms?: string;
  payment_terms?: string;
  delivery_period?: string;
  remark?: string;
  items?: CustomerQuotationItem[];
}
