import { Attachment } from './attachment.model';

export interface PackingListItem {
  id?: number;
  packing_list_id?: number;
  material_name: string;
  description?: string;
  hsn_code?: string;
  quantity: number | string;
  unit_price?: number | string;
  net_amount?: number | string;
  package_type?: string;
  weight?: number | string;
  unit_weight?: number | string;
  total_weight?: number | string;
}

export interface PackingList {
  id: number;
  project_id: number;
  packing_list_no: string;
  packing_list_date: string;
  date?: string;
  packing_condition: string;
  gross_weight?: number | string;
  net_weight?: number | string;
  weight?: number | string;
  total_weight?: number | string;
  remark?: string;
  status?: string;
  attachments?: Attachment[];
  items?: PackingListItem[];
  created_at?: string;
  updated_at?: string;
}

export interface PackingListCreateInput {
  project_id: number;
  packing_list_no: string;
  packing_list_date: string;
  packing_condition: string;
  gross_weight?: number | string;
  net_weight?: number | string;
  weight?: number | string;
  total_weight?: number | string;
  remark?: string;
  items?: PackingListItem[];
}

export interface PackingListUpdateInput {
  project_id?: number;
  packing_list_no?: string;
  packing_list_date?: string;
  packing_condition?: string;
  gross_weight?: number | string;
  net_weight?: number | string;
  weight?: number | string;
  total_weight?: number | string;
  remark?: string;
  items?: PackingListItem[];
}
