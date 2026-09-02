export interface Attachment {
  id: number;
  customer_query_id?: number;
  file_name: string;
  file_size: number;
  content_type: string;
  storage_key: string;
  uploaded_by?: number;
  created_at?: string;
  updated_at?: string;
  url?: string;
}
