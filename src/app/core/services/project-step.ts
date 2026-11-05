import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { ProjectStep, StepStatus } from '../models/project-step.model';
import { FORM_CATALOG_MAP, getFormDefinition } from '../constants/form-catalog';
import { sanitizePayloadDates } from '../utils/date.utils';

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

  // In-memory fallback cache for dynamic steps added before backend implementation
  private readonly localStepsCache = new Map<number, ProjectStep[]>();

  private getCachedSteps(projectId: number): ProjectStep[] {
    const memory = this.localStepsCache.get(projectId);
    if (memory && memory.length > 0) return memory;
    try {
      const stored = localStorage.getItem(`material_management_project_steps_${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as ProjectStep[];
        if (Array.isArray(parsed)) {
          this.localStepsCache.set(projectId, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore JSON parse/localStorage errors
    }
    return [];
  }

  private setCachedSteps(projectId: number, steps: ProjectStep[]): void {
    this.localStepsCache.set(projectId, steps);
    try {
      localStorage.setItem(`material_management_project_steps_${projectId}`, JSON.stringify(steps));
    } catch {
      // ignore localStorage quota errors
    }
  }

  addStepToLocalCache(projectId: number, step: ProjectStep): void {
    const cached = this.getCachedSteps(projectId);
    const formCode = (step.form_code || '').trim();
    const def = formCode
      ? getFormDefinition(formCode)
      : step.step_name
        ? getFormDefinition(step.step_name)
        : undefined;
    const resolvedCode = formCode || def?.formCode;

    const existingIdx = cached.findIndex(
      (s) =>
        (s.id && step.id && s.id === step.id) ||
        (s.form_code && resolvedCode && s.form_code === resolvedCode) ||
        (s.step_name && step.step_name && s.step_name.toLowerCase().trim() === step.step_name.toLowerCase().trim()),
    );

    const stepWithMeta: ProjectStep = {
      ...step,
      project_id: projectId,
      form_code: resolvedCode || step.form_code,
      step_name: step.step_name || def?.name || 'Step Details',
      phase: step.phase || def?.phaseId,
      category: step.category || def?.category,
    };

    if (existingIdx >= 0) {
      const copy = [...cached];
      copy[existingIdx] = {
        ...copy[existingIdx],
        ...stepWithMeta,
        data: { ...copy[existingIdx].data, ...stepWithMeta.data },
      };
      this.setCachedSteps(projectId, copy);
    } else {
      const nextOrder = cached.length + 1;
      if (!stepWithMeta.step_number) {
        stepWithMeta.step_number = nextOrder;
      }
      this.setCachedSteps(projectId, [...cached, stepWithMeta]);
    }
  }

  getSteps(projectId: number): Observable<ProjectStep[]> {
    return this.http
      .get<ProjectStep[] | { data: ProjectStep[] }>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps`)
      .pipe(
        map((backendSteps) => {
          const cached = this.getCachedSteps(projectId);
          const rawSteps = Array.isArray(backendSteps)
            ? backendSteps
            : backendSteps &&
                typeof backendSteps === 'object' &&
                'data' in backendSteps &&
                Array.isArray((backendSteps as { data: ProjectStep[] }).data)
              ? (backendSteps as { data: ProjectStep[] }).data
              : [];
          const normalized = rawSteps.map((s) => {
            const def = s.form_code
              ? getFormDefinition(s.form_code)
              : s.step_name
                ? getFormDefinition(s.step_name)
                : undefined;
            return {
              ...s,
              form_code: s.form_code || def?.formCode,
              phase: s.phase || def?.phaseId,
              category: s.category || def?.category,
            };
          });

          if (!cached.length) return normalized;

          // Merge any locally added dynamic steps
          const merged = [...normalized];
          for (const c of cached) {
            const exists = merged.some(
              (m) =>
                (m.id && c.id && m.id === c.id) ||
                (m.form_code && c.form_code && m.form_code === c.form_code) ||
                (m.step_name && c.step_name && m.step_name.toLowerCase().trim() === c.step_name.toLowerCase().trim()),
            );
            if (!exists) {
              const def = c.form_code
                ? getFormDefinition(c.form_code)
                : c.step_name
                  ? getFormDefinition(c.step_name)
                  : undefined;
              merged.push({
                ...c,
                form_code: c.form_code || def?.formCode,
                phase: c.phase || def?.phaseId,
                category: c.category || def?.category,
              });
            }
          }
          merged.sort((a, b) => (a.step_order ?? a.step_number ?? 0) - (b.step_order ?? b.step_number ?? 0));
          return merged;
        }),
        catchError(() => {
          // If backend fails or is empty, return any cached steps
          const cached = this.getCachedSteps(projectId);
          return of(cached);
        }),
      );
  }

  getStepById(projectId: number, stepId: number): Observable<ProjectStep | null> {
    return this.http
      .get<ProjectStep>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps/${stepId}`)
      .pipe(
        catchError(() => {
          const cached = this.getCachedSteps(projectId);
          const match = cached.find((s) => s.id === stepId || s.step_number === stepId);
          return of(match ?? null);
        }),
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
          const cached = this.getCachedSteps(projectId);
          const stepWithData: ProjectStep = {
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
          const filtered = cached.filter((s) => s.form_code !== formCode && s.id !== stepWithData.id);
          this.setCachedSteps(projectId, [...filtered, stepWithData]);
          return stepWithData;
        }),
        catchError(() => {
          // Graceful fallback for local development before backend endpoint is live
          const cached = this.getCachedSteps(projectId);
          const nextOrder = cached.length + 1;
          const mockStep: ProjectStep = {
            id: Date.now(),
            project_id: projectId,
            step_number: nextOrder,
            step_name: resolvedName,
            description: formDef?.description || '',
            status,
            progress_percentage: progressPercentage,
            completed_at: status === 'completed' ? new Date().toISOString() : null,
            form_code: formCode,
            category: formDef?.category,
            phase: formDef?.phaseId,
            data: sanitizedDataClean,
            remarks: [],
            created_at: new Date().toISOString(),
          };
          const filtered = cached.filter((s) => s.form_code !== formCode && s.id !== mockStep.id);
          this.setCachedSteps(projectId, [...filtered, mockStep]);
          return of(mockStep);
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

    return this.http
      .put<ProjectStep>(
        `${this.apiBaseUrl}/api/v1/projects/${projectId}/steps/${stepId}`,
        payload,
      )
      .pipe(
        map((updated) => {
          const cached = this.getCachedSteps(projectId);
          const idx = cached.findIndex((s) => s.id === stepId || s.step_number === stepId);
          if (idx >= 0) {
            cached[idx] = {
              ...cached[idx],
              ...updated,
              data: { ...cached[idx].data, ...data },
              status,
              progress_percentage: progressPercentage,
            };
            this.setCachedSteps(projectId, [...cached]);
          }
          return updated;
        }),
        catchError(() => {
          // Local fallback
          const cached = this.getCachedSteps(projectId);
          const idx = cached.findIndex((s) => s.id === stepId || s.step_number === stepId);
          if (idx >= 0) {
            cached[idx] = {
              ...cached[idx],
              data: { ...cached[idx].data, ...data },
              status,
              progress_percentage: progressPercentage,
              completed_at: payload.completed_at,
            };
            this.setCachedSteps(projectId, [...cached]);
            return of(cached[idx]);
          }
          const fallback: ProjectStep = {
            id: stepId,
            project_id: projectId,
            step_number: stepId,
            step_name: 'Step Details',
            description: '',
            status,
            progress_percentage: progressPercentage,
            completed_at: payload.completed_at,
            data,
          };
          return of(fallback);
        }),
      );
  }

  removeStep(projectId: number, stepId: number): Observable<boolean> {
    return this.http
      .delete<void>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps/${stepId}`)
      .pipe(
        map(() => {
          const cached = this.getCachedSteps(projectId);
          this.setCachedSteps(
            projectId,
            cached.filter((s) => s.id !== stepId && s.step_number !== stepId),
          );
          return true;
        }),
        catchError(() => {
          const cached = this.getCachedSteps(projectId);
          this.setCachedSteps(
            projectId,
            cached.filter((s) => s.id !== stepId && s.step_number !== stepId),
          );
          return of(true);
        }),
      );
  }
}
