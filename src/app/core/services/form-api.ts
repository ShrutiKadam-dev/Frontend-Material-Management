import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { ProjectStep, ProjectStepRemark, StepStatus } from '../models/project-step.model';
import { FormDefinition } from '../constants/form-catalog';

export function normalizeBackendEntityToStep(
  item: Record<string, unknown>,
  formDef: FormDefinition,
  projectId: number,
): ProjectStep {
  const stepId = Number(item['id']) || Date.now();
  const rawStatus = String(item['status'] || 'completed').toLowerCase();
  const status: StepStatus =
    rawStatus === 'in_progress' || rawStatus === 'pending' || rawStatus === 'skipped'
      ? (rawStatus as StepStatus)
      : 'completed';

  const rawTableItems = (item['items'] || item['table_items'] || item['materials'] || []) as unknown[];
  const rawAttachments = (item['attachments'] || []) as unknown[];
  const rawRemarks = (item['remarks'] || []) as unknown[];

  const combinedData: Record<string, unknown> = {
    ...item,
    table_items: rawTableItems,
    items: rawTableItems,
    attachments: rawAttachments,
    remarks: rawRemarks,
  };

  return {
    id: stepId,
    project_id: Number(item['project_id']) || projectId,
    step_number: Number(item['step_number'] ?? stepId),
    step_name: String(item['step_name'] || formDef.name),
    description: String(item['description'] || formDef.description || ''),
    status,
    progress_percentage: Number(
      item['progress_percentage'] ?? (status === 'completed' ? 100 : 50),
    ),
    completed_at: item['completed_at']
      ? String(item['completed_at'])
      : status === 'completed'
        ? item['created_at']
          ? String(item['created_at'])
          : new Date().toISOString()
        : null,
    form_code: formDef.formCode,
    category: formDef.category,
    phase: formDef.phaseId,
    data: combinedData,
    remarks: Array.isArray(rawRemarks) ? (rawRemarks as ProjectStepRemark[]) : [],
    created_at: item['created_at'] ? String(item['created_at']) : undefined,
    updated_at: item['updated_at'] ? String(item['updated_at']) : undefined,
  };
}

@Injectable({
  providedIn: 'root',
})
export class FormApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  /**
   * Retrieves all entries for a given form definition and project using its dedicated individual REST endpoint.
   * Does NOT call /projects/:id/steps.
   */
  getEntries(formDef: FormDefinition, projectId: number): Observable<ProjectStep[]> {
    if (!formDef.apiEndpoint) {
      return of([]);
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}?project_id=${projectId}`;
    return this.http.get<unknown[] | { data: unknown[] }>(endpointUrl).pipe(
      map((res) => {
        const rawItems = Array.isArray(res)
          ? res
          : res && typeof res === 'object' && Array.isArray((res as Record<string, unknown>)['data'])
            ? ((res as Record<string, unknown>)['data'] as unknown[])
            : [];
        return rawItems.map((it) =>
          normalizeBackendEntityToStep(it as Record<string, unknown>, formDef, projectId),
        );
      }),
      catchError((err) => {
        console.error(`[FormApiService] Failed to fetch entries from ${formDef.apiEndpoint}:`, err);
        return of([]);
      }),
    );
  }

  /**
   * Retrieves a single entry by ID from its dedicated individual REST endpoint.
   */
  getEntryById(formDef: FormDefinition, stepId: number, projectId = 0): Observable<ProjectStep> {
    if (!formDef.apiEndpoint) {
      return throwError(() => new Error(`No individual API endpoint for ${formDef.name}`));
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}/${stepId}`;
    return this.http.get<Record<string, unknown> | { data: Record<string, unknown> }>(endpointUrl).pipe(
      map((res) => {
        const item = (res && typeof res === 'object' && 'data' in res ? res['data'] : res) as Record<string, unknown>;
        return normalizeBackendEntityToStep(item, formDef, projectId);
      }),
    );
  }

  /**
   * Creates a new entry using the dedicated REST endpoint (multipart/form-data or json).
   */
  createEntry(
    formDef: FormDefinition,
    projectId: number,
    payload: Record<string, unknown>,
    files: File[] = [],
  ): Observable<ProjectStep> {
    if (!formDef.apiEndpoint) {
      return throwError(() => new Error(`No individual API endpoint for ${formDef.name}`));
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}`;
    const bodyPayload: Record<string, unknown> = {
      project_id: projectId,
      items: payload['table_items'] || payload['items'] || [],
      ...payload,
    };

    const fd = new FormData();
    fd.append('data', JSON.stringify(bodyPayload));
    files.forEach((file) => fd.append('file', file, file.name));

    return this.http.post<Record<string, unknown>>(endpointUrl, fd).pipe(
      map((res) => {
        const item = (res && typeof res === 'object' && 'data' in res ? res['data'] : res) as Record<string, unknown>;
        return normalizeBackendEntityToStep(item || bodyPayload, formDef, projectId);
      }),
    );
  }

  /**
   * Updates an existing entry via PATCH to the dedicated REST endpoint.
   */
  updateEntry(
    formDef: FormDefinition,
    projectId: number,
    stepId: number,
    payload: Record<string, unknown>,
    files: File[] = [],
  ): Observable<ProjectStep> {
    if (!formDef.apiEndpoint) {
      return throwError(() => new Error(`No individual API endpoint for ${formDef.name}`));
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}/${stepId}`;
    const bodyPayload: Record<string, unknown> = {
      project_id: projectId,
      items: payload['table_items'] || payload['items'] || [],
      ...payload,
    };

    const fd = new FormData();
    fd.append('data', JSON.stringify(bodyPayload));
    files.forEach((file) => fd.append('file', file, file.name));

    return this.http.patch<Record<string, unknown>>(endpointUrl, fd).pipe(
      map((res) => {
        const item = (res && typeof res === 'object' && 'data' in res ? res['data'] : res) as Record<string, unknown>;
        return normalizeBackendEntityToStep(item || bodyPayload, formDef, projectId);
      }),
    );
  }

  /**
   * Deletes an entry via the dedicated REST endpoint.
   */
  deleteEntry(
    formDef: FormDefinition,
    projectId: number,
    stepId: number,
  ): Observable<boolean> {
    if (!formDef.apiEndpoint) {
      return of(false);
    }

    const endpointUrl = `${this.apiBaseUrl}${formDef.apiEndpoint}/${stepId}`;
    return this.http.delete<void>(endpointUrl).pipe(
      map(() => true),
    );
  }
}
