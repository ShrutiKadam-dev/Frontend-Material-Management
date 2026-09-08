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
        }))
      : [];

    return { metrics, recent_projects };
  }

  /**
   * Generates dynamic dashboard data from individual resources (projects, customers, suppliers)
   * as a reliable fallback until the dedicated backend summary endpoint is ready.
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

        // Calculate metrics
        const metrics: DashboardMetric[] = [
          {
            label: 'Active Projects',
            value: totalProjects > 0 ? totalProjects : 0,
            trend: `Across ${totalSuppliers} supplier${totalSuppliers === 1 ? '' : 's'}`,
            tone: 'success',
          },
          {
            label: 'Completed',
            value: 0,
            trend: 'Fully paid & closed',
            tone: 'success',
          },
          {
            label: 'Suppliers',
            value: totalSuppliers,
            trend: 'Foreign & domestic',
            tone: 'success',
          },
          {
            label: 'Customers',
            value: totalCustomers,
            trend: `${totalCustomers} active accounts`,
            tone: totalCustomers > 0 ? 'success' : 'warning',
          },
        ];

        // Format recent projects (take up to 6 latest)
        const recent_projects: DashboardProject[] = projects.slice(0, 6).map((proj) => {
          const supplierName = proj.supplier_name || (proj.supplier_id ? supplierMap.get(proj.supplier_id) : '') || `Supplier #${proj.supplier_id}`;
          const customerName = proj.customer_name || (proj.customer_id ? customerMap.get(proj.customer_id) : '') || `Customer #${proj.customer_id}`;

          return {
            id: proj.id,
            title: proj.project_title || `Project #${proj.id}`,
            supplier: supplierName,
            customer: customerName,
            step: 'In Progress',
            milestone: 'Project Initiated',
            progress: 10,
            status: 'In Progress',
          };
        });

        return { metrics, recent_projects };
      }),
    );
  }
}
