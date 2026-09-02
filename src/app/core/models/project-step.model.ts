export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface ProjectStep {
  id: number | null;
  project_id: number;
  step_number: number;
  step_name: string;
  description: string;
  status: StepStatus;
  progress_percentage: number;
  completed_at: string | null;
  data: unknown | null;
}
