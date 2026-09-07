import { Attachment } from './attachment.model';

export interface PurchaseOrderItem {
  id?: number;
  purchase_order_id?: number;
  item_code?: string;
  material_name?: string;
  description?: string;
  hsn_code?: string;
  hsn_sac?: string;
  quantity: number | string;
  unit_price?: number | string;
  net_amount?: number | string;
}

export interface LatestBidSubmission {
  gst_rate?: number;
  delivery_term?: string;
  delivery_terms?: string;
  payment_terms?: string;
  warranty_period?: string;
  items?: Array<{
    description?: string;
    material_name?: string;
    quantity?: number | string;
    unit_price?: number | string;
    hsn_code?: string;
    hsn_sac?: string;
  }>;
}

export interface PurchaseOrder {
  id: number;
  project_id: number;
  customer_id?: number;
  customer_name?: string;
  poc_name: string;
  email: string;
  po_no: string;
  po_number?: string;
  po_title: string;
  po_date: string;
  delivery_term: string;
  delivery_terms?: string;
  payment_terms: string;
  warranty_period: string;
  delivery_date: string;
  gst_rate: number;
  gst_amount?: number;
  total_net_amount: number;
  total_gross_amount?: number;
  total_amount?: number;
  remark?: string;
  status?: string;
  attachments?: Attachment[];
  items?: PurchaseOrderItem[];
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrderCreateInput {
  project_id: number;
  customer_id?: number;
  poc_name: string;
  email: string;
  po_no: string;
  po_title: string;
  po_date: string;
  delivery_term: string;
  payment_terms: string;
  warranty_period: string;
  delivery_date: string;
  gst_rate: number;
  gst_amount?: number;
  total_net_amount: number;
  total_gross_amount: number;
  remark?: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderUpdateInput {
  project_id?: number;
  customer_id?: number;
  poc_name?: string;
  email?: string;
  po_no?: string;
  po_title?: string;
  po_date?: string;
  delivery_term?: string;
  payment_terms?: string;
  warranty_period?: string;
  delivery_date?: string;
  gst_rate?: number;
  gst_amount?: number;
  total_net_amount?: number;
  total_gross_amount?: number;
  remark?: string;
  items?: PurchaseOrderItem[];
}
