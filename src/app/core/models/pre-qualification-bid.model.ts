export interface PreQualificationBidItem {
  id?: number;
  sr_no?: number;
  description: string;
  unit?: string;
  quantity: number;
}

export interface PreQualificationBid {
  id?: number;
  project_id?: number;
  pqb_title: string;
  pqb_no: string;
  pqb_issuing_date?: string;
  pqb_issue_date?: string;
  pqb_closing_date_time?: string;
  pqb_opening_date_time?: string;
  mode_of_bid_submission?: string;
  supply_location?: string[] | string;
  items?: PreQualificationBidItem[];
  created_at?: string;
  updated_at?: string;
}

export interface PreQualificationBidCreateInput {
  project_id: number;
  pqb_title: string;
  pqb_no: string;
  pqb_issuing_date?: string;
  pqb_closing_date_time?: string;
  pqb_opening_date_time?: string;
  mode_of_bid_submission?: string;
  supply_location?: string[] | string;
  items?: PreQualificationBidItem[];
}

export interface PreQualificationBidUpdateInput {
  pqb_title?: string;
  pqb_no?: string;
  pqb_issuing_date?: string;
  pqb_closing_date_time?: string;
  pqb_opening_date_time?: string;
  mode_of_bid_submission?: string;
  supply_location?: string[] | string;
  items?: PreQualificationBidItem[];
}

