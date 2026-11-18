export interface TechnoCommercialTenderItem {
  id?: number;
  sr_no?: number;
  description: string;
  unit?: string;
  quantity: number;
}

export interface TechnoCommercialTender {
  id?: number;
  project_id?: number;
  pqb_no?: string;
  tender_title: string;
  tender_no: string;
  tender_issue_date?: string;
  bid_submission_due_date_time?: string;
  bid_opening_date_time?: string;
  tender_fee?: number | string;
  emd?: number | string;
  tender_validity?: string;
  items?: TechnoCommercialTenderItem[];
  created_at?: string;
  updated_at?: string;
}

export interface TechnoCommercialTenderCreateInput {
  project_id: number;
  pqb_no?: string;
  tender_title: string;
  tender_no: string;
  tender_issue_date?: string;
  bid_submission_due_date_time?: string;
  bid_opening_date_time?: string;
  tender_fee?: number | string;
  emd?: number | string;
  tender_validity?: string;
  items?: TechnoCommercialTenderItem[];
}

export interface TechnoCommercialTenderUpdateInput {
  pqb_no?: string;
  tender_title?: string;
  tender_no?: string;
  tender_issue_date?: string;
  bid_submission_due_date_time?: string;
  bid_opening_date_time?: string;
  tender_fee?: number | string;
  emd?: number | string;
  tender_validity?: string;
  items?: TechnoCommercialTenderItem[];
}
