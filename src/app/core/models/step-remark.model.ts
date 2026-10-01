export interface StepRemarkItem {
  id: string;
  text: string;
  created_at: string;
  user?: string;
  user_id?: number;
}

export interface RemarkPayloadItem {
  id?: number | string;
  remark: string;
  user?: string;
  user_id?: number;
  created_at?: string;
}
