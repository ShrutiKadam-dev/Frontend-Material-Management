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
import { DashboardMetric, DashboardOverviewStats, DashboardProject } from '../../../core/models/dashboard.model';

@Component({
  selector: 'app-dashbord',
  imports: [RouterLink, ButtonModule, TooltipModule, DatePipe, DecimalPipe],
  templateUrl: './dashbord.html',
  styleUrl: './dashbord.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashbord implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly metrics = signal<DashboardMetric[]>([]);
  protected readonly recentProjects = signal<DashboardProject[]>([]);
  protected readonly overviewStats = signal<DashboardOverviewStats | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);

  // ── Executive Greeting ─────────────────────────────────────────
  protected readonly greetingTitle = computed(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) {
      timeGreeting = 'Good afternoon';
    } else if (hour >= 17) {
      timeGreeting = 'Good evening';
    }

    const user = this.authService.currentUser();
    const name = user?.name ? user.name.split(' ')[0] : 'Admin';
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

  protected readonly onTrackCount = computed(() => {
    if (this.overviewStats()?.on_track_count !== undefined) {
      return this.overviewStats()!.on_track_count;
    }
    return this.recentProjects().filter((p) => p.health_status === 'on_track').length;
  });

  protected readonly delayedCount = computed(() => {
    if (this.overviewStats()?.delayed_count !== undefined) {
      return this.overviewStats()!.delayed_count;
    }
    return this.recentProjects().filter(
      (p) => p.health_status === 'delayed' || p.health_status === 'at_risk',
    ).length;
  });

  protected readonly completedCount = computed(() => {
    if (this.overviewStats()?.completed_count !== undefined) {
      return this.overviewStats()!.completed_count;
    }
    return this.recentProjects().filter(
      (p) => p.status === 'Completed' || p.progress === 100,
    ).length;
  });

  // 15-Step Lifecycle Stage Breakdown
  protected readonly sourcingStageCount = computed(() => {
    if (this.overviewStats()?.stage_breakdown) {
      return this.overviewStats()!.stage_breakdown.sourcing;
    }
    return this.recentProjects().filter((p) => (p.current_step_number || 1) <= 5).length;
  });

  protected readonly logisticsStageCount = computed(() => {
    if (this.overviewStats()?.stage_breakdown) {
      return this.overviewStats()!.stage_breakdown.logistics;
    }
    return this.recentProjects().filter(
      (p) => (p.current_step_number || 1) >= 6 && (p.current_step_number || 1) <= 11,
    ).length;
  });

  protected readonly clearanceStageCount = computed(() => {
    if (this.overviewStats()?.stage_breakdown) {
      return this.overviewStats()!.stage_breakdown.clearance;
    }
    return this.recentProjects().filter((p) => (p.current_step_number || 1) >= 12).length;
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

  protected navigateToProject(projectId: number): void {
    if (projectId) {
      this.router.navigate(['/projects', projectId, 'steps']);
    }
  }

  protected getHealthBadgeClass(health?: string): string {
    switch (health) {
      case 'on_track':
        return 'health-pill--on-track';
      case 'delayed':
        return 'health-pill--delayed';
      case 'at_risk':
        return 'health-pill--at-risk';
      default:
        return 'health-pill--normal';
    }
  }

  protected getHealthLabel(health?: string): string {
    switch (health) {
      case 'on_track':
        return 'On Track';
      case 'delayed':
        return 'Delayed';
      case 'at_risk':
        return 'At Risk';
      default:
        return 'Active';
    }
  }

  protected getStatusBadgeClass(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'status-badge--completed';
      case 'on_hold':
      case 'on hold':
        return 'status-badge--on-hold';
      default:
        return 'status-badge--in-progress';
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

  protected getProgressPercent(project: DashboardProject): number {
    if (project.progress !== undefined && project.progress !== null && !isNaN(project.progress)) {
      return project.progress;
    }
    const step = project.current_step_number || 1;
    return Math.round((step / 15) * 100);
  }

  protected getPercentage(count: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round((count / total) * 100);
  }
}

