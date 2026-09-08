export interface DashboardMetric {
  label: string;
  value: string | number;
  trend: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
}

export interface DashboardProject {
  id: number;
  title: string;
  supplier: string;
  customer: string;
  step: string;
  milestone: string;
  progress: number;
  status: 'In Progress' | 'Completed' | 'Pending' | 'On Hold';
  current_step_number?: number;
  total_steps?: number;
}

export interface DashboardData {
  metrics: DashboardMetric[];
  recent_projects: DashboardProject[];
}

export interface DashboardApiResponse {
  data?: {
    metrics?: DashboardMetric[];
    recent_projects?: DashboardProject[];
    recentProjects?: DashboardProject[];
  };
  metrics?: DashboardMetric[];
  recent_projects?: DashboardProject[];
  recentProjects?: DashboardProject[];
  message?: string;
  success?: boolean;
}
