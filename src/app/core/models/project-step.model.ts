export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface ProjectStepRemark {
  id?: number;
  project_id?: number;
  step_number?: number;
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
  data: Record<string, unknown> | null;
  remarks?: ProjectStepRemark[];
}
