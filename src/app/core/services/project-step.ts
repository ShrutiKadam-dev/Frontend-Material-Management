import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { ProjectStep, StepStatus } from '../models/project-step.model';
import { FORM_CATALOG_MAP, getFormDefinition } from '../constants/form-catalog';

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

  getSteps(projectId: number): Observable<ProjectStep[]> {
    return this.http
      .get<ProjectStep[]>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps`)
      .pipe(
        map((backendSteps) => {
          const cached = this.localStepsCache.get(projectId) || [];
          if (!cached.length) return backendSteps;

          // Merge any locally added dynamic steps
          const merged = [...backendSteps];
          for (const c of cached) {
            if (!merged.some((m) => m.id === c.id || (m.form_code && m.form_code === c.form_code))) {
              merged.push(c);
            }
          }
          return merged;
        }),
        catchError(() => {
          // If backend fails or is empty, return any cached steps
          const cached = this.localStepsCache.get(projectId) || [];
          return of(cached);
        }),
      );
  }

  getStepById(projectId: number, stepId: number): Observable<ProjectStep | null> {
    return this.http
      .get<ProjectStep>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps/${stepId}`)
      .pipe(
        catchError(() => {
          const cached = this.localStepsCache.get(projectId) || [];
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
    const payload: AddStepRequest = {
      form_code: formCode,
      step_name: resolvedName,
      description: formDef?.description,
      data: normalizedData,
      status,
      progress_percentage: progressPercentage,
    };

    return this.http
      .post<ProjectStep>(`${this.apiBaseUrl}/api/v1/projects/${projectId}/steps`, payload)
      .pipe(
        map((createdStep) => {
          const cached = this.localStepsCache.get(projectId) || [];
          const stepWithData: ProjectStep = {
            ...createdStep,
            data:
              createdStep.data && Object.keys(createdStep.data).length > 0
                ? createdStep.data
                : normalizedData,
            status: createdStep.status || status,
            progress_percentage: createdStep.progress_percentage ?? progressPercentage,
            form_code: createdStep.form_code || formCode,
            step_name: createdStep.step_name || resolvedName,
          };
          this.localStepsCache.set(projectId, [...cached, stepWithData]);
          return stepWithData;
        }),
        catchError(() => {
          // Graceful fallback for local development before backend endpoint is live
          const cached = this.localStepsCache.get(projectId) || [];
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
            data: normalizedData,
            remarks: [],
            created_at: new Date().toISOString(),
          };
          this.localStepsCache.set(projectId, [...cached, mockStep]);
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
    const payload = {
      data: normalizedData,
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
        catchError(() => {
          // Local fallback
          const cached = this.localStepsCache.get(projectId) || [];
          const idx = cached.findIndex((s) => s.id === stepId || s.step_number === stepId);
          if (idx >= 0) {
            cached[idx] = {
              ...cached[idx],
              data: { ...cached[idx].data, ...data },
              status,
              progress_percentage: progressPercentage,
              completed_at: payload.completed_at,
            };
            this.localStepsCache.set(projectId, [...cached]);
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
          const cached = this.localStepsCache.get(projectId) || [];
          this.localStepsCache.set(
            projectId,
            cached.filter((s) => s.id !== stepId && s.step_number !== stepId),
          );
          return true;
        }),
        catchError(() => {
          const cached = this.localStepsCache.get(projectId) || [];
          this.localStepsCache.set(
            projectId,
            cached.filter((s) => s.id !== stepId && s.step_number !== stepId),
          );
          return of(true);
        }),
      );
  }
}

