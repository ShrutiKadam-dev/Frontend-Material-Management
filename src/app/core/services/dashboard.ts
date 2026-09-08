import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  DashboardApiResponse,
  DashboardData,
  DashboardMetric,
  DashboardProject,
} from '../models/dashboard.model';
import { ProjectService } from './project';
import { CustomerService } from './customer';
import { SupplierService } from './supplier';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly supplierService = inject(SupplierService);

  /**
   * Fetches dashboard data. Tries dedicated endpoint first (/api/v1/dashboard/summary or /api/v1/dashboard).
   * If not available (e.g. 404), falls back dynamically by aggregating live data from
   * projects, customers, and suppliers APIs.
   */
  getDashboardData(): Observable<DashboardData> {
    return this.http.get<DashboardApiResponse | DashboardData>(`${this.apiBaseUrl}/api/v1/dashboard/summary`).pipe(
      map((res) => this.normalizeResponse(res)),
      catchError(() => {
        // Fallback: try alternate endpoint /api/v1/dashboard
        return this.http.get<DashboardApiResponse | DashboardData>(`${this.apiBaseUrl}/api/v1/dashboard`).pipe(
          map((res) => this.normalizeResponse(res)),
          catchError(() => this.aggregateLiveDataFallback()),
        );
      }),
    );
  }

  private normalizeResponse(res: unknown): DashboardData {
    if (!res || typeof res !== 'object') {
      return { metrics: [], recent_projects: [] };
    }

    const payload = res as Record<string, unknown>;
    const nestedData = (payload['data'] && typeof payload['data'] === 'object'
      ? payload['data']
      : payload) as Record<string, unknown>;

    const metricsRaw = nestedData['metrics'] ?? [];
    const projectsRaw =
      nestedData['recent_projects'] ??
      nestedData['recentProjects'] ??
      nestedData['projects'] ??
      [];

    const metrics: DashboardMetric[] = Array.isArray(metricsRaw)
      ? metricsRaw.map((m: Record<string, unknown>) => ({
          label: String(m['label'] ?? m['title'] ?? 'Metric'),
          value: String(m['value'] ?? '0'),
          trend: String(m['trend'] ?? m['subtitle'] ?? m['description'] ?? ''),
          tone: (m['tone'] as DashboardMetric['tone']) || 'success',
        }))
      : [];

    const recent_projects: DashboardProject[] = Array.isArray(projectsRaw)
      ? projectsRaw.map((p: Record<string, unknown>, index: number) => ({
          id: Number(p['id'] ?? p['project_id'] ?? index + 1),
          title: String(p['title'] ?? p['project_title'] ?? 'Untitled Project'),
          supplier: String(p['supplier'] ?? p['supplier_name'] ?? 'N/A'),
          customer: String(p['customer'] ?? p['customer_name'] ?? 'N/A'),
          step: String(p['step'] ?? (p['current_step_number'] ? `Step ${p['current_step_number']} of 15` : 'Step 1 of 15')),
          milestone: String(p['milestone'] ?? p['current_step_name'] ?? 'In Progress'),
          progress: Number(p['progress'] ?? p['progress_percentage'] ?? 0),
          status: (p['status'] as DashboardProject['status']) || 'In Progress',
          current_step_number: p['current_step_number'] ? Number(p['current_step_number']) : undefined,
          total_steps: p['total_steps'] ? Number(p['total_steps']) : 15,
          total_value: p['total_value'] ? Number(p['total_value']) : undefined,
          currency: String(p['currency'] ?? 'INR'),
          health_status: String(p['health_status'] ?? 'on_track'),
          next_action: p['next_action'] ? String(p['next_action']) : undefined,
          target_delivery_date: p['target_delivery_date'] ? String(p['target_delivery_date']) : null,
          customer_payment_status: p['customer_payment_status'] ? String(p['customer_payment_status']) : undefined,
          supplier_payment_status: p['supplier_payment_status'] ? String(p['supplier_payment_status']) : undefined,
        }))
      : [];

    const overview_stats = (nestedData['overview_stats'] ?? payload['overview_stats']) as DashboardData['overview_stats'] | undefined;

    return { metrics, recent_projects, overview_stats };
  }

  /**
   * Generates dynamic dashboard data from individual resources (projects, customers, suppliers)
   * by computing portfolio-level summaries and mapping project records.
   */
  private aggregateLiveDataFallback(): Observable<DashboardData> {
    return forkJoin({
      projects: this.projectService.getProjects().pipe(catchError(() => of([]))),
      customers: this.customerService.getCustomers().pipe(catchError(() => of([]))),
      suppliers: this.supplierService.getSuppliers().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ projects, customers, suppliers }) => {
        const totalProjects = projects.length;
        const totalSuppliers = suppliers.length;
        const totalCustomers = customers.length;

        const customerMap = new Map<number, string>(customers.map((c) => [c.id, c.name]));
        const supplierMap = new Map<number, string>(suppliers.map((s) => [s.id, s.name]));

    const totalValue = projects.reduce((sum, p) => sum + (Number(p.total_value) || 0), 0);
        const onTrackCount = projects.filter((p) => p.health_status === 'on_track').length;
        const delayedCount = projects.filter((p) => p.health_status === 'delayed' || p.health_status === 'at_risk').length;
        const completedCount = projects.filter((p) => p.status === 'completed' || p.progress_percentage === 100).length;

        const avgProgress = totalProjects > 0
          ? Math.round(
              projects.reduce((sum, p) => {
                const prog = p.progress_percentage !== undefined && p.progress_percentage !== null
                  ? p.progress_percentage
                  : Math.round(((p.current_step_number || 1) / 15) * 100);
                return sum + prog;
              }, 0) / totalProjects,
            )
          : 0;

        // Stage breakdown
        const sourcingCount = projects.filter((p) => (p.current_step_number || 1) <= 5).length;
        const logisticsCount = projects.filter((p) => (p.current_step_number || 1) >= 6 && (p.current_step_number || 1) <= 11).length;
        const clearanceCount = projects.filter((p) => (p.current_step_number || 1) >= 12).length;

        // Commercial payments
        const customerPaid = projects.filter((p) => p.customer_payment_status?.toLowerCase() === 'paid').length;
        const customerPartial = projects.filter((p) => p.customer_payment_status?.toLowerCase() === 'partial').length;
        const customerPending = totalProjects - customerPaid - customerPartial;

        const supplierPaid = projects.filter((p) => p.supplier_payment_status?.toLowerCase() === 'paid').length;
        const supplierPartial = projects.filter((p) => p.supplier_payment_status?.toLowerCase() === 'partial').length;
        const supplierPending = totalProjects - supplierPaid - supplierPartial;

        // Formatted currency value helper
        const formattedTotalValue = `₹ ${totalValue.toLocaleString('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

        // Compute overall dashboard metrics
        const metrics: DashboardMetric[] = [
          {
            label: 'Active Pipelines',
            value: totalProjects,
            trend: `Across ${totalCustomers} client${totalCustomers === 1 ? '' : 's'}`,
            tone: 'info',
          },
          {
            label: 'Total Portfolio Value',
            value: formattedTotalValue,
            trend: 'Contracted procurement volume',
            tone: 'success',
          },
          {
            label: 'Pipeline Health',
            value: `${onTrackCount} On Track`,
            trend: delayedCount > 0 ? `${delayedCount} delayed/attention` : '100% on schedule',
            tone: delayedCount > 0 ? 'warning' : 'success',
          },
          {
            label: 'Average Completion',
            value: `${avgProgress}%`,
            trend: 'Across 15 milestone stages',
            tone: 'info',
          },
        ];

        // Overview stats
        const overview_stats = {
          total_projects: totalProjects,
          total_portfolio_value: totalValue,
          total_customers: totalCustomers,
          total_suppliers: totalSuppliers,
          on_track_count: onTrackCount,
          delayed_count: delayedCount,
          completed_count: completedCount,
          avg_progress: avgProgress,
          customer_payments: {
            paid: customerPaid,
            pending: customerPending,
            partial: customerPartial,
          },
          supplier_payments: {
            paid: supplierPaid,
            pending: supplierPending,
            partial: supplierPartial,
          },
          stage_breakdown: {
            sourcing: sourcingCount,
            logistics: logisticsCount,
            clearance: clearanceCount,
          },
        };

        // Format recent projects
        const recent_projects: DashboardProject[] = projects.slice(0, 8).map((proj) => {
          const supplierName =
            proj.supplier_name ||
            (proj.supplier_id ? supplierMap.get(proj.supplier_id) : '') ||
            `Supplier #${proj.supplier_id}`;
          const customerName =
            proj.customer_name ||
            (proj.customer_id ? customerMap.get(proj.customer_id) : '') ||
            `Customer #${proj.customer_id}`;
          const stepNum = proj.current_step_number || 1;
          const stepName = proj.current_step_name || 'Customer Query Initiated';
          const progress =
            proj.progress_percentage !== undefined && proj.progress_percentage !== null
              ? proj.progress_percentage
              : Math.round((stepNum / 15) * 100);

          return {
            id: proj.id,
            title: proj.project_title || `Project #${proj.id}`,
            supplier: supplierName,
            customer: customerName,
            step: `Step ${stepNum} of ${proj.total_steps || 15}`,
            milestone: stepName,
            progress: progress,
            status: (proj.status === 'completed'
              ? 'Completed'
              : proj.status === 'on_hold'
                ? 'On Hold'
                : 'In Progress') as DashboardProject['status'],
            current_step_number: stepNum,
            total_steps: proj.total_steps || 15,
            total_value: proj.total_value ? Number(proj.total_value) : undefined,
            currency: proj.currency || 'INR',
            health_status: proj.health_status || 'on_track',
            next_action: proj.next_action,
            target_delivery_date: proj.target_delivery_date,
            customer_payment_status: proj.customer_payment_status,
            supplier_payment_status: proj.supplier_payment_status,
          };
        });

        return { metrics, recent_projects, overview_stats };
      }),
    );
  }
}
