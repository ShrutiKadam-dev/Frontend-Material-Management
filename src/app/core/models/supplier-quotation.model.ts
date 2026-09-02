import { Attachment } from './attachment.model';

export interface SupplierQuotationItem {
  id?: number;
  material_name: string;
  quantity: string | number;
}

export interface SupplierQuotation {
  id: number;
  project_id: number;
  supplier_id: number;
  supplier_name?: string;
  quotation_number: string;
  quotation_date: string;
  quotation_value: string;
  validity: string;
  incoterms: string;
  payment_terms: string;
  delivery_period: string;
  remark: string;
  attachments: Attachment[];
  items: SupplierQuotationItem[];
  created_at?: string;
  updated_at?: string;
}

export interface SupplierQuotationCreateInput {
  project_id: number;
  supplier_id: number;
  quotation_number: string;
  quotation_date: string;
  quotation_value: string;
  validity: string;
  incoterms: string;
  payment_terms: string;
  delivery_period: string;
  remark: string;
  items: SupplierQuotationItem[];
}

export interface SupplierQuotationUpdateInput {
  project_id?: number;
  supplier_id?: number;
  quotation_number?: string;
  quotation_date?: string;
  quotation_value?: string;
  validity?: string;
  incoterms?: string;
  payment_terms?: string;
  delivery_period?: string;
  remark?: string;
  items?: SupplierQuotationItem[];
}
