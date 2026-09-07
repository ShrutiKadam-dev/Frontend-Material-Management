import { Attachment } from './attachment.model';

export interface OrderConfirmationItem {
  id?: number;
  order_confirmation_id?: number;
  item_code?: string;
  material_name: string;
  description?: string;
  hsn_code?: string;
  hsn_sac?: string;
  quantity: number | string;
  unit_price?: number | string;
  net_amount?: number | string;
}

export interface LatestSupplierQuotation {
  incoterms?: string;
  shipping_terms?: string;
  payment_terms?: string;
  warranty_period?: string;
  delivery_period?: string;
  items?: Array<{
    material_name?: string;
    description?: string;
    quantity?: number | string;
    unit_price?: number | string;
    net_amount?: number | string;
    hsn_code?: string;
    hsn_sac?: string;
  }>;
}

export interface LatestOrderConfirmation {
  payment_terms?: string;
  warranty_period?: string;
  shipping_terms?: string;
  incoterms?: string;
  delivery_period?: string;
  delivery_terms?: string;
  items?: Array<{
    material_name?: string;
    description?: string;
    quantity?: number | string;
    unit_price?: number | string;
    hsn_code?: string;
    hsn_sac?: string;
    net_amount?: number | string;
  }>;
}

export interface OrderConfirmation {
  id: number;
  project_id: number;
  order_confirmation_date: string;
  confirmation_date?: string;
  order_date?: string;
  email: string;
  ref_no: string;
  reference_number?: string;
  order_no?: string;
  shipping_terms: string;
  incoterms?: string;
  delivery_terms?: string;
  warranty_period: string;
  delivery_period: string;
  payment_terms?: string;
  total_amount?: number;
  total_net_amount?: number;
  remark?: string;
  status?: string;
  attachments?: Attachment[];
  items?: OrderConfirmationItem[];
  created_at?: string;
  updated_at?: string;
}

export interface OrderConfirmationCreateInput {
  project_id: number;
  order_confirmation_date: string;
  email: string;
  ref_no: string;
  shipping_terms: string;
  warranty_period: string;
  delivery_period: string;
  payment_terms?: string;
  total_amount?: number;
  total_net_amount?: number;
  remark?: string;
  items: OrderConfirmationItem[];
}

export interface OrderConfirmationUpdateInput {
  project_id?: number;
  order_confirmation_date?: string;
  email?: string;
  ref_no?: string;
  shipping_terms?: string;
  warranty_period?: string;
  delivery_period?: string;
  payment_terms?: string;
  total_amount?: number;
  total_net_amount?: number;
  remark?: string;
  items?: OrderConfirmationItem[];
}
