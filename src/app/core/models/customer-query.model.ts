import { Attachment } from './attachment.model';

export interface CustomerQueryItem {
  id?: number;
  material_name: string;
  quantity: string;
}

export interface CustomerQuery {
  id: number;
  project_id: number;
  customer_id: number;
  qo_date: string;
  remark: string;
  attachments: Attachment[];
  items: CustomerQueryItem[];
  created_at?: string;
  updated_at?: string;
}

export interface CustomerQueryCreateInput {
  project_id: number;
  customer_id: number;
  qo_date: string;
  attachments?: string[];
  remark: string;
  items: CustomerQueryItem[];
}

export interface CustomerQueryUpdateInput {
  project_id?: number;
  customer_id?: number;
  qo_date?: string;
  attachments?: string[];
  remark?: string;
  items?: CustomerQueryItem[];
}
