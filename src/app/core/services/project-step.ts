import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { ProjectStep } from '../models/project-step.model';

@Injectable({
  providedIn: 'root',
})
export class ProjectStepService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getSteps(projectId: number): Observable<ProjectStep[]> {
    return this.http.get<ProjectStep[]>(
      `${this.apiBaseUrl}/api/v1/projects/${projectId}/steps`,
    );
  }
}
