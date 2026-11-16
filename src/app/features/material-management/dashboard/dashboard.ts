import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { AuthService } from '../../../core/services/auth';
import { DashboardService } from '../../../core/services/dashboard';
import { ProjectService } from '../../../core/services/project';
import { DashboardMetric, DashboardOverviewStats, DashboardProject } from '../../../core/models/dashboard.model';
import { Project } from '../../../core/models/project.model';
import { getFormDefinition } from '../../../core/constants/form-catalog';

import { AppDatePipe } from '../../../core/pipes/app-date.pipe';
import { resolveTimeGreeting, resolveUserDisplayName } from '../../../core/utils/user.utils';

export interface DashboardStatusBreakdownItem {
  id: string;
  title: string;
  count: number;
  percentage: number;
  badgeClass: string;
  fillClass: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, ButtonModule, TooltipModule, DatePipe, AppDatePipe, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly projectService = inject(ProjectService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly metrics = signal<DashboardMetric[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly latestProjects = computed(() => {
    const list = this.projects();
    if (!list || list.length === 0) return [];
    return [...list]
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
      .slice(0, 2);
  });
  protected readonly recentProjects = signal<DashboardProject[]>([]);
  protected readonly overviewStats = signal<DashboardOverviewStats | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  // ── Executive Greeting ─────────────────────────────────────────
  protected readonly greetingTitle = computed(() => {
    const timeGreeting = resolveTimeGreeting();
    const user = this.authService.currentUser();
    const name = resolveUserDisplayName(user);
    return `${timeGreeting}, ${name}`;
  });

  protected readonly currentDate = computed(() => {
    return new Date();
  });

  // ── Derived Overall Portfolio Analytics ─────────────────────────
  protected readonly totalProjectsCount = computed(() => {
    return this.overviewStats()?.total_projects ?? this.recentProjects().length;
  });

  protected readonly totalPortfolioValue = computed(() => {
    if (this.overviewStats()?.total_portfolio_value !== undefined) {
      return this.overviewStats()!.total_portfolio_value;
    }
    return this.recentProjects().reduce((sum, p) => sum + (p.total_value || 0), 0);
  });

  protected readonly averageDealValue = computed(() => {
    const count = this.totalProjectsCount();
    if (count === 0) return 0;
    return this.totalPortfolioValue() / count;
  });

  protected readonly completedCount = computed(() => {
    if (this.overviewStats()?.completed_count !== undefined) {
      return this.overviewStats()!.completed_count;
    }
    return this.recentProjects().filter(
      (p) => p.status === 'Completed' || p.progress === 100,
    ).length;
  });

  protected readonly inProgressCount = computed<number>(() => {
    if (this.overviewStats()?.in_progress_count !== undefined) {
      return this.overviewStats()!.in_progress_count ?? 0;
    }
    return Math.max(0, this.totalProjectsCount() - this.completedCount());
  });

  // ── Dynamic Pipeline Status Breakdown ─────────────────────────
  protected readonly statusBreakdown = computed<DashboardStatusBreakdownItem[]>(() => {
    const list = this.projects().length > 0 ? this.projects() : (this.recentProjects() as unknown as Project[]);
    const total = this.totalProjectsCount() || list.length;

    let inProg = 0;
    let completed = 0;
    let pending = 0;

    for (const p of list) {
      const status = (p.status || '').toLowerCase();
      const rawProg = p.progress_percentage !== undefined
        ? p.progress_percentage
        : (p as unknown as { progress?: number }).progress;
      const prog = Number(rawProg ?? 0);
      if (status === 'completed' || prog === 100) {
        completed++;
      } else if (status === 'in_progress' || status === 'active' || prog > 0) {
        inProg++;
      } else {
        pending++;
      }
    }

    if (list.length === 0) {
      completed = this.completedCount();
      inProg = this.inProgressCount() ?? 0;
      pending = Math.max(0, total - completed - inProg);
    }

    return [
      {
        id: 'in_progress',
        title: 'In Progress',
        count: inProg,
        percentage: total > 0 ? Math.round((inProg / total) * 100) : 0,
        badgeClass: 'stage-badge-pill--orders',
        fillClass: 'stage-fill--p3',
      },
      {
        id: 'completed',
        title: 'Completed',
        count: completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        badgeClass: 'stage-badge-pill--settlement',
        fillClass: 'stage-fill--p5',
      },
      {
        id: 'pending',
        title: 'Pending / Queued',
        count: pending,
        percentage: total > 0 ? Math.round((pending / total) * 100) : 0,
        badgeClass: 'stage-badge-pill--bidding',
        fillClass: 'stage-fill--p1',
      },
    ];
  });

  protected readonly totalAttachedStepsCount = computed(() => {
    const list = this.projects();
    return list.reduce((sum, p) => sum + (p.total_steps || 0), 0);
  });

  // Backward-compatible getters for legacy references
  protected readonly sourcingStageCount = computed(() => {
    return this.overviewStats()?.stage_breakdown?.sourcing ?? 0;
  });

  protected readonly logisticsStageCount = computed(() => {
    return this.overviewStats()?.stage_breakdown?.logistics ?? 0;
  });

  protected readonly clearanceStageCount = computed(() => {
    return this.overviewStats()?.stage_breakdown?.clearance ?? 0;
  });

  // Commercial Payments Breakdown
  protected readonly customerPayments = computed(() => {
    if (this.overviewStats()?.customer_payments) {
      return this.overviewStats()!.customer_payments;
    }
    const list = this.recentProjects();
    const paid = list.filter((p) => p.customer_payment_status?.toLowerCase() === 'paid').length;
    const partial = list.filter((p) => p.customer_payment_status?.toLowerCase() === 'partial').length;
    const pending = list.length - paid - partial;
    return { paid, pending, partial };
  });

  protected readonly supplierPayments = computed(() => {
    if (this.overviewStats()?.supplier_payments) {
      return this.overviewStats()!.supplier_payments;
    }
    const list = this.recentProjects();
    const paid = list.filter((p) => p.supplier_payment_status?.toLowerCase() === 'paid').length;
    const partial = list.filter((p) => p.supplier_payment_status?.toLowerCase() === 'partial').length;
    const pending = list.length - paid - partial;
    return { paid, pending, partial };
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  protected loadDashboardData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.projectService.getProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
      },
      error: (err: unknown) => {
        console.error('Failed to load projects for dashboard', err);
      },
    });

    this.dashboardService.getDashboardData().subscribe({
      next: (data) => {
        this.metrics.set(data.metrics);
        this.recentProjects.set(data.recent_projects);
        if (data.overview_stats) {
          this.overviewStats.set(data.overview_stats);
        }
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load dashboard data', err);
        this.error.set('Failed to load dashboard data. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected navigateToProject(projectId?: number): void {
    if (projectId) {
      this.router.navigate(['/projects', projectId, 'steps']);
    }
  }

  protected getStatusBadgeClass(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'status-badge--completed';
      case 'on_hold':
      case 'on hold':
        return 'status-badge--on-hold';
      case 'cancelled':
        return 'status-badge--cancelled';
      default:
        return 'status-badge--in-progress';
    }
  }

  protected getStatusLabel(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'Completed';
      case 'on_hold':
      case 'on hold':
        return 'On Hold';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'In Progress';
    }
  }

  protected getPaymentBadgeClass(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'payment-chip--paid';
      case 'partial':
        return 'payment-chip--partial';
      default:
        return 'payment-chip--pending';
    }
  }

  protected getProgressPercent(project: Project | DashboardProject): number {
    if (
      'progress_percentage' in project &&
      project.progress_percentage !== undefined &&
      project.progress_percentage !== null &&
      !isNaN(project.progress_percentage)
    ) {
      return Math.min(100, Math.max(0, project.progress_percentage));
    }
    if (
      'progress' in project &&
      project.progress !== undefined &&
      project.progress !== null &&
      !isNaN(project.progress)
    ) {
      return Math.min(100, Math.max(0, project.progress));
    }
    const total = project.total_steps;
    const current = project.current_step_number;
    if (total && total > 0) {
      const completed = (project as Project).completed_steps_count ?? current ?? 0;
      return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
    }
    if (current) {
      return Math.min(100, Math.round((current / (total || 15)) * 100));
    }
    if (project.status === 'Completed' || project.status === 'completed') {
      return 100;
    }
    return 0;
  }

  protected getStepDisplayLabel(project: Project | DashboardProject): string {
    const total = project.total_steps;
    const current = project.current_step_number;
    if (project.status?.toLowerCase() === 'completed') {
      return total && total > 0 ? `${total}/${total} Steps Done` : 'Completed';
    }
    if (total && total > 0) {
      const completed = (project as Project).completed_steps_count;
      if (completed !== undefined && completed >= total) {
        return `${total}/${total} Steps Done`;
      }
      return `Step ${current || 1} of ${total}`;
    }
    if (current) {
      return `Step ${current}`;
    }
    return 'Active Step';
  }

  protected getProjectStepTitle(project: Project | DashboardProject): string {
    return (
      (project as Project).current_step_name ||
      (project as DashboardProject).milestone ||
      'Workflow in progress'
    );
  }

  protected getPercentage(count: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round((count / total) * 100);
  }
}

