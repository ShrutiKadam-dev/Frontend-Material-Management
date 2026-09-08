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
  total_value?: number;
  currency?: string;
  health_status?: string;
  next_action?: string;
  target_delivery_date?: string | null;
  customer_payment_status?: string;
  supplier_payment_status?: string;
}

export interface DashboardOverviewStats {
  total_projects: number;
  total_portfolio_value: number;
  total_customers: number;
  total_suppliers: number;
  on_track_count: number;
  delayed_count: number;
  completed_count: number;
  avg_progress: number;
  customer_payments: {
    paid: number;
    pending: number;
    partial: number;
  };
  supplier_payments: {
    paid: number;
    pending: number;
    partial: number;
  };
  stage_breakdown: {
    sourcing: number;
    logistics: number;
    clearance: number;
  };
}

export interface DashboardData {
  metrics: DashboardMetric[];
  recent_projects: DashboardProject[];
  overview_stats?: DashboardOverviewStats;
}

export interface DashboardApiResponse {
  data?: {
    metrics?: DashboardMetric[];
    recent_projects?: DashboardProject[];
    recentProjects?: DashboardProject[];
    overview_stats?: DashboardOverviewStats;
  };
  metrics?: DashboardMetric[];
  recent_projects?: DashboardProject[];
  recentProjects?: DashboardProject[];
  overview_stats?: DashboardOverviewStats;
  message?: string;
  success?: boolean;
}

