import { Attachment } from './attachment.model';

export interface CustomerTenderItem {
  id?: number;
  tender_id?: number;
  item_code?: string;
  material_name: string;
  quantity: string | number;
  unit_price?: string | number;
}

export interface CustomerTender {
  id: number;
  project_id: number;
  customer_id: number;
  customer_name?: string;
  officer_name?: string;
  email?: string;
  address?: string;
  website?: string;
  contact_number?: string;
  tender_title: string;
  tender_number: string;
  tender_date: string;
  opening_date_time?: string;
  closing_date_time?: string;
  tender_fee?: number | string;
  validity?: string;
  delivery_terms?: string;
  delivery_period?: string;
  payment_terms?: string;
  warranty_period?: string;
  remark?: string;
  attachments?: Attachment[];
  items?: CustomerTenderItem[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerTenderCreateInput {
  project_id: number;
  customer_id: number;
  officer_name?: string;
  email?: string;
  address?: string;
  website?: string;
  contact_number?: string;
  tender_title: string;
  tender_number: string;
  tender_date: string;
  opening_date_time?: string;
  closing_date_time?: string;
  tender_fee?: number | string;
  validity?: string;
  delivery_terms?: string;
  delivery_period?: string;
  payment_terms?: string;
  warranty_period?: string;
  remark?: string;
  items: CustomerTenderItem[];
}

export interface CustomerTenderUpdateInput {
  project_id?: number;
  customer_id?: number;
  officer_name?: string;
  email?: string;
  address?: string;
  website?: string;
  contact_number?: string;
  tender_title?: string;
  tender_number?: string;
  tender_date?: string;
  opening_date_time?: string;
  closing_date_time?: string;
  tender_fee?: number | string;
  validity?: string;
  delivery_terms?: string;
  delivery_period?: string;
  payment_terms?: string;
  warranty_period?: string;
  remark?: string;
  items?: CustomerTenderItem[];
}
