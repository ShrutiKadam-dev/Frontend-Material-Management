import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Project, ProjectCreateInput, ProjectUpdateInput } from '../models/project.model';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiBaseUrl}/api/v1/projects`);
  }

  getProjectById(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.apiBaseUrl}/api/v1/projects/${id}`);
  }

  createProject(project: ProjectCreateInput): Observable<Project> {
    return this.http.post<Project>(`${this.apiBaseUrl}/api/v1/projects`, project);
  }

  updateProject(id: number, project: ProjectUpdateInput): Observable<Project> {
    return this.http.put<Project>(`${this.apiBaseUrl}/api/v1/projects/${id}`, project);
  }
}
