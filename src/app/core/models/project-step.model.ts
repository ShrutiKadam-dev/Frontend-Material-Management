export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface ProjectStepRemark {
  id?: number;
  project_id?: number;
  step_number?: number;
  step_id?: number;
  remark: string;
  user?: string;
  user_id?: number;
  created_at?: string;
  updated_at?: string;
  entity_id?: number;
}

export interface ProjectStep {
  id: number | null;
  project_id: number;
  step_number: number;
  step_name: string;
  description: string;
  status: StepStatus;
  progress_percentage: number;
  completed_at: string | null;
  form_code?: string;
  category?: string;
  phase?: string;
  data: Record<string, unknown> | null;
  remarks?: ProjectStepRemark[];
  created_at?: string;
  updated_at?: string;
}
