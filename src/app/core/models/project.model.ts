export interface MatchedItem {
  material_name?: string;
  item_code?: string;
  quantity?: string | number;
  step_name?: string;
}

export interface Project {
  id: number;
  project_title: string;
  project_code?: string;
  nickname?: string;
  project_nickname?: string;
  customer_id: number;
  supplier_id: number;
  customer_name?: string;
  supplier_name?: string;
  status?: string; // 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
  current_step_number?: number;
  current_step_name?: string;
  current_form_code?: string;
  total_steps?: number;
  completed_steps_count?: number;
  progress_percentage?: number;
  total_value?: number;
  total_margin?: number;
  currency?: string;
  next_action?: string;
  target_delivery_date?: string | null;
  customer_payment_status?: 'pending' | 'paid' | 'partial' | string;
  supplier_payment_status?: 'pending' | 'paid' | 'partial' | string;
  matched_items?: MatchedItem[];
  items?: MatchedItem[];
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  project_title: string;
  project_code?: string;
  nickname?: string;
  project_nickname?: string;
  customer_id: number;
  supplier_id: number;
  currency?: string;
  total_margin?: number;
  target_delivery_date?: string;
}

export interface ProjectUpdateInput {
  project_title: string;
  project_code?: string;
  nickname?: string;
  project_nickname?: string;
  customer_id: number;
  supplier_id: number;
  status?: string;
  currency?: string;
  total_margin?: number;
  target_delivery_date?: string;
}

