export interface Project {
  id: number;
  project_title: string;
  customer_id: number;
  supplier_id: number;
  customer_name?: string;
  supplier_name?: string;
  status?: string; // 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
  current_step_number?: number;
  current_step_name?: string;
  total_steps?: number;
  progress_percentage?: number;
  total_value?: number;
  currency?: string;
  health_status?: 'on_track' | 'delayed' | 'at_risk' | string;
  next_action?: string;
  target_delivery_date?: string | null;
  customer_payment_status?: 'pending' | 'paid' | 'partial' | string;
  supplier_payment_status?: 'pending' | 'paid' | 'partial' | string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  project_title: string;
  customer_id: number;
  supplier_id: number;
  currency?: string;
  target_delivery_date?: string;
}

export interface ProjectUpdateInput {
  project_title: string;
  customer_id: number;
  supplier_id: number;
  status?: string;
  currency?: string;
  target_delivery_date?: string;
}
