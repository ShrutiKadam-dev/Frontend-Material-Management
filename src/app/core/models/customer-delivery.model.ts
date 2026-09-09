import { Attachment } from './attachment.model';

export interface DeliveryItem {
  id?: number;
  material_name: string;
  hsn_code: string;
  quantity: number;
  unit_price?: number;
  net_amount?: number;
  package_no?: string;
  weight?: number;
}

// 1. Tax Invoice
export interface CustomerTaxInvoice {
  id: number;
  project_id: number;
  invoice_no: string;
  invoice_date: string;
  gst_rate: number;
  gst_amount: number;
  round_off: number;
  net_total: number;
  remark?: string | null;
  items: DeliveryItem[];
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerTaxInvoiceCreateInput {
  project_id: number;
  invoice_no: string;
  invoice_date: string;
  gst_rate: number;
  gst_amount: number;
  round_off: number;
  net_total: number;
  remark?: string;
  items: DeliveryItem[];
}

export interface CustomerTaxInvoiceUpdateInput extends Partial<CustomerTaxInvoiceCreateInput> {}

// 2. Customer Packing List
export interface CustomerPackingList {
  id: number;
  project_id: number;
  packing_list_no: string;
  packing_list_date: string;
  total_no_of_packs: number;
  packing_condition: string;
  net_weight: number | string;
  gross_weight: number | string;
  remark?: string | null;
  items: DeliveryItem[];
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerPackingListCreateInput {
  project_id: number;
  packing_list_no: string;
  packing_list_date: string;
  total_no_of_packs: number;
  packing_condition: string;
  net_weight: number | string;
  gross_weight: number | string;
  remark?: string;
  items: DeliveryItem[];
}

export interface CustomerPackingListUpdateInput extends Partial<CustomerPackingListCreateInput> {}

// 3. Delivery Challan
export interface CustomerDeliveryChallan {
  id: number;
  project_id: number;
  delivery_challan_no: string;
  delivery_challan_date: string;
  remark?: string | null;
  items: DeliveryItem[];
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerDeliveryChallanCreateInput {
  project_id: number;
  delivery_challan_no: string;
  delivery_challan_date: string;
  remark?: string;
  items: DeliveryItem[];
}

export interface CustomerDeliveryChallanUpdateInput extends Partial<CustomerDeliveryChallanCreateInput> {}

// 4. Warranty Certificate
export interface CustomerWarrantyCertificate {
  id: number;
  project_id: number;
  certificate_date: string;
  warranty_period: string;
  po_no: string;
  po_date: string;
  invoice_no: string;
  invoice_date: string;
  remark?: string | null;
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerWarrantyCertificateCreateInput {
  project_id: number;
  certificate_date: string;
  warranty_period: string;
  po_no: string;
  po_date: string;
  invoice_no: string;
  invoice_date: string;
  remark?: string;
}

export interface CustomerWarrantyCertificateUpdateInput extends Partial<CustomerWarrantyCertificateCreateInput> {}

// 5. Transport Details
export type TransportMode = 'road' | 'train' | 'air';

export interface CustomerTransportDetail {
  id: number;
  project_id: number;
  transport_mode: TransportMode;
  lr_no?: string | null;
  rr_no?: string | null;
  awb_no?: string | null;
  date: string;
  from_location: string;
  to_location: string;
  transport_charges: number;
  remark?: string | null;
  attachments?: Attachment[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerTransportDetailCreateInput {
  project_id: number;
  transport_mode: TransportMode;
  lr_no?: string;
  rr_no?: string;
  awb_no?: string;
  date: string;
  from_location: string;
  to_location: string;
  transport_charges: number;
  remark?: string;
}

export interface CustomerTransportDetailUpdateInput extends Partial<CustomerTransportDetailCreateInput> {}

// PO Latest Template for auto-patching
export interface LatestPurchaseOrderTemplate {
  gst_rate?: number;
  gst_amount?: number;
  total_net_amount?: number;
  po_no?: string;
  po_date?: string;
  warranty_period?: string;
  items: Array<{
    material_name: string;
    hsn_code: string;
    quantity: number;
    unit_price: number;
    net_amount: number;
  }>;
}
