export interface Project {
  id: number;
  project_title: string;
  customer_id: number;
  supplier_id: number;
  customer_name?: string;
  supplier_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  project_title: string;
  customer_id: number;
  supplier_id: number;
}

export interface ProjectUpdateInput {
  project_title: string;
  customer_id: number;
  supplier_id: number;
}
