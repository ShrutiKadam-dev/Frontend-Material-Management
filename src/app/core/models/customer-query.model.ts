import { Attachment } from './attachment.model';

export interface CustomerQueryItem {
  id?: number;
  material_name: string;
  quantity: string | number;
}

export interface CustomerQueryRemark {
  id: string;
  text: string;
  created_at: string;
}

export interface RemarkPayloadItem {
  remark: string;
}

export interface CustomerQueryRemarkItem {
  id?: number | string;
  remark?: string;
  text?: string;
  user?: string;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerQuery {
  id: number;
  project_id: number;
  customer_id: number;
  qo_date: string;
  qo_amount?: string;
  qo_validity?: string;
  remarks?: string[] | string | unknown;
  remark?: string;
  attachments: Attachment[];
  items: CustomerQueryItem[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerQueryCreateInput {
  project_id: number;
  customer_id: number;
  qo_date: string;
  qo_amount?: string;
  qo_validity?: string;
  attachments?: string[];
  remarks: string[];
  remark?: string;
  items: CustomerQueryItem[];
}

export interface CustomerQueryUpdateInput {
  project_id?: number;
  customer_id?: number;
  qo_date?: string;
  qo_amount?: string;
  qo_validity?: string;
  attachments?: string[];
  remarks?: string[];
  remark?: string;
  items?: CustomerQueryItem[];
}

