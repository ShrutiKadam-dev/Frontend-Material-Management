export interface StepRemarkItem {
  id: string;
  text: string;
  created_at: string;
  user?: string;
  user_id?: number;
}

export interface RemarkPayloadItem {
  remark: string;
}
