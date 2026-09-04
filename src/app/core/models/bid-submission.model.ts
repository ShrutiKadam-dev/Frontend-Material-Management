import { Attachment } from './attachment.model';

export interface BidSubmissionItem {
  id?: number;
  bid_submission_id?: number;
  item_code?: string;
  material_name: string;
  hsn_sac?: string;
  quantity: number | string;
  unit_price?: number | string;
  net_amount?: number | string;
}

export interface BidSubmission {
  id: number;
  project_id: number;
  customer_id: number;
  customer_name?: string;
  customer_tender_id?: number;
  tender_title?: string;
  tender_number?: string;
  validity?: string;
  delivery_terms?: string;
  delivery_period?: string;
  payment_terms?: string;
  warranty_period?: string;
  submission_date: string;
  status?: string;
  remark?: string;
  attachments?: Attachment[];
  items?: BidSubmissionItem[];
  created_at?: string;
  updated_at?: string;
}

export interface BidSubmissionCreateInput {
  project_id: number;
  customer_id: number;
  customer_tender_id?: number;
  tender_title?: string;
  tender_number?: string;
  validity?: string;
  delivery_terms?: string;
  delivery_period?: string;
  payment_terms?: string;
  warranty_period?: string;
  submission_date: string;
  remark?: string;
  items: BidSubmissionItem[];
}

export interface BidSubmissionUpdateInput {
  project_id?: number;
  customer_id?: number;
  customer_tender_id?: number;
  tender_title?: string;
  tender_number?: string;
  validity?: string;
  delivery_terms?: string;
  delivery_period?: string;
  payment_terms?: string;
  warranty_period?: string;
  submission_date?: string;
  remark?: string;
  items?: BidSubmissionItem[];
}
