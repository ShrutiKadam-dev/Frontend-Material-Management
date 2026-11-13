import { Attachment } from './attachment.model';
import { RemarkPayloadItem } from './step-remark.model';

export interface QuotationRequestItem {
  id?: number;
  material_name: string;
  quantity: string;
}

export interface QuotationRequest {
  id: number;
  project_id: number;
  supplier_id: number;
  supplier_name?: string;
  quotation_requested_date: string;
  supplier_contacted: boolean;
  remarks?: RemarkPayloadItem[] | string[] | string;
  attachments: Attachment[];
  items: QuotationRequestItem[];
  created_at?: string;
  updated_at?: string;
}

export interface QuotationRequestCreateInput {
  project_id: number;
  supplier_id: number;
  quotation_requested_date: string;
  supplier_contacted: boolean;
  remarks: RemarkPayloadItem[] | string[];
  items: QuotationRequestItem[];
}

export interface QuotationRequestUpdateInput {
  project_id?: number;
  supplier_id?: number;
  quotation_requested_date?: string;
  supplier_contacted?: boolean;
  remarks?: RemarkPayloadItem[] | string[];
  items?: QuotationRequestItem[];
}

