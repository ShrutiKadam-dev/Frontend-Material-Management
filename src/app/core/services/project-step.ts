import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { ProjectStep, StepStatus } from '../models/project-step.model';
import { FORM_CATALOG_MAP, getFormDefinition } from '../constants/form-catalog';
import { formatLocalDate, sanitizePayloadDates } from '../utils/date.utils';

export interface AddStepRequest {
  form_code: string;
  step_name?: string;
  description?: string;
  data?: Record<string, unknown>;
  status?: StepStatus;
  progress_percentage?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectStepService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  constructor() {
    this.clearLegacyLocalStorageCache();
  }

  /**
   * Clears legacy localStorage cache keys so stale cached project steps
   * do not interfere with dynamic backend data.
   */
  clearCachedSteps(projectId?: number): void {
    this.clearLegacyLocalStorageCache(projectId);
  }

  private clearLegacyLocalStorageCache(projectId?: number): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (projectId) {
        localStorage.removeItem(`material_management_project_steps_${projectId}`);
      } else {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('material_management_project_steps_')) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      // ignore JSON parse/localStorage errors
    }
  }

  /**
   * Deprecated: Caching has been completely removed in favor of direct, dynamic backend persistence.
   */
  addStepToLocalCache(_projectId: number, _step: ProjectStep): void {
    // No-op: steps are persisted dynamically to the backend
  }

  getSteps(projectId: number): Observable<ProjectStep[]> {
    return this.http
      .get<ProjectStep[] | { data: ProjectStep[] }>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps`)
      .pipe(
        map((backendSteps) => {
          const rawSteps = Array.isArray(backendSteps)
            ? backendSteps
            : backendSteps &&
              typeof backendSteps === 'object' &&
              'data' in backendSteps &&
              Array.isArray((backendSteps as { data: ProjectStep[] }).data)
              ? (backendSteps as { data: ProjectStep[] }).data
              : [];
          const catMap: Record<string, string> = {
            'Pre-Bidding & Tenders': 'phase-1',
            'Sourcing & Quotations': 'phase-2',
            'Supplier Orders & Invoices': 'phase-3',
            'Logistics & Customs': 'phase-4',
            'Customer & Supplier Settlement': 'phase-5',
          };
          const systemKeys = new Set([
            'id',
            'project_id',
            'step_number',
            'step_order',
            'step_name',
            'description',
            'status',
            'progress_percentage',
            'completed_at',
            'form_code',
            'category',
            'phase',
            'phase_id',
            'remarks',
            'created_at',
            'updated_at',
            'attachments',
            'icon',
            'data',
          ]);

          const normalized = rawSteps.map((s) => {
            const def = s.form_code
              ? getFormDefinition(s.form_code)
              : s.step_name
                ? getFormDefinition(s.step_name)
                : undefined;
            const resolvedCategory = s.category || def?.category;
            const resolvedPhase =
              def?.phaseId ||
              (resolvedCategory && catMap[resolvedCategory] ? catMap[resolvedCategory] : undefined) ||
              s.phase ||
              ((s as Record<string, unknown>)['phase_id'] as string) ||
              'phase-1';

            // Gather root backend attributes into data if not already present
            const rootExtraData: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(s)) {
              if (!systemKeys.has(k) && v !== undefined && v !== null && v !== '') {
                rootExtraData[k] = v;
              }
            }

            const existingData =
              s.data && typeof s.data === 'object' && !Array.isArray(s.data)
                ? (s.data as Record<string, unknown>)
                : {};

            const mergedData = { ...rootExtraData, ...existingData };

            if (
              s.form_code === 'FORM_09_RFQ' ||
              (def && def.formCode === 'FORM_09_RFQ') ||
              (s.step_name && s.step_name.toLowerCase().includes('quotation'))
            ) {
              const rfqDate =
                formatLocalDate(mergedData['request_date'] as string | Date) ||
                formatLocalDate(mergedData['quotation_requested_date'] as string | Date);
              if (rfqDate) {
                mergedData['request_date'] = rfqDate;
              }
            }

            return {
              ...s,
              form_code: s.form_code || def?.formCode,
              phase: resolvedPhase,
              phase_id: resolvedPhase,
              category: resolvedCategory,
              data: Object.keys(mergedData).length > 0 ? mergedData : null,
            };
          });
          return normalized;
        }),
      );
  }

  getStepById(projectId: number, stepId: number): Observable<ProjectStep | null> {
    return this.http
      .get<ProjectStep>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps/${stepId}`)
      .pipe(
        catchError(() => of(null)),
      );
  }

  addStep(
    projectId: number,
    formCode: string,
    stepName?: string,
    data: Record<string, unknown> = {},
    status: StepStatus = 'in_progress',
    progressPercentage: number = 0,
  ): Observable<ProjectStep> {
    const formDef = getFormDefinition(formCode);
    const resolvedName = stepName || formDef?.name || `Form ${formCode}`;
    const { table_items, ...sanitizedData } = data;
    const normalizedData: Record<string, unknown> = {
      ...sanitizedData,
      ...(table_items !== undefined || sanitizedData['items'] !== undefined
        ? { items: (sanitizedData['items'] ?? table_items ?? []) as unknown[] }
        : {}),
    };
    const sanitizedDataClean = sanitizePayloadDates(normalizedData, formDef?.fields, formDef?.tableConfig?.columns);
    const payload: AddStepRequest = {
      form_code: formCode,
      step_name: resolvedName,
      description: formDef?.description,
      data: sanitizedDataClean,
      status,
      progress_percentage: progressPercentage,
    };

    return this.http
      .post<ProjectStep>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps`, payload)
      .pipe(
        map((createdStep) => {
          return {
            ...createdStep,
            project_id: projectId,
            data:
              createdStep.data && Object.keys(createdStep.data).length > 0
                ? createdStep.data
                : sanitizedDataClean,
            status: createdStep.status || status,
            progress_percentage: createdStep.progress_percentage ?? progressPercentage,
            form_code: createdStep.form_code || formCode,
            step_name: createdStep.step_name || resolvedName,
            phase: createdStep.phase || formDef?.phaseId,
            category: createdStep.category || formDef?.category,
          };
        }),
      );
  }

  updateStep(
    projectId: number,
    stepId: number,
    data: Record<string, unknown>,
    status: StepStatus = 'in_progress',
    progressPercentage: number = 50,
  ): Observable<ProjectStep> {
    const { table_items, ...sanitizedData } = data;
    const normalizedData: Record<string, unknown> = {
      ...sanitizedData,
      ...(table_items !== undefined || sanitizedData['items'] !== undefined
        ? { items: (sanitizedData['items'] ?? table_items ?? []) as unknown[] }
        : {}),
    };
    const sanitizedDataClean = sanitizePayloadDates(normalizedData);
    const payload = {
      data: sanitizedDataClean,
      status,
      progress_percentage: progressPercentage,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    };

    return this.http.put<ProjectStep>(
      `${this.apiBaseUrl}/api/v1/projects/${projectId}/steps/${stepId}`,
      payload,
    );
  }

  removeStep(projectId: number, stepId: number): Observable<boolean> {
    return this.http
      .delete<void>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps/${stepId}`)
      .pipe(
        map(() => true),
      );
  }
}
