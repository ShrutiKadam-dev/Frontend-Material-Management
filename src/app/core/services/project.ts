import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { Project, ProjectCreateInput, ProjectUpdateInput } from '../models/project.model';
import { API_BASE_URL } from '../tokens/api-base-url.token';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getProjects(): Observable<Project[]> {
    return this.http
      .get<Project[] | { data: Project[]; message?: string; success?: boolean }>(
        `${this.apiBaseUrl}/api/v1/projects`,
      )
      .pipe(map((res) => (Array.isArray(res) ? res : res?.data || [])));
  }

  getProjectById(id: number): Observable<Project> {
    return this.http
      .get<Project | { data: Project; message?: string; success?: boolean }>(
        `${this.apiBaseUrl}/api/v1/projects/${id}`,
      )
      .pipe(map((res) => (res && 'data' in res && res.data ? res.data : (res as Project))));
  }

  createProject(project: ProjectCreateInput): Observable<Project> {
    return this.http
      .post<Project | { data: Project }>(`${this.apiBaseUrl}/api/v1/projects`, project)
      .pipe(map((res) => (res && 'data' in res && res.data ? res.data : (res as Project))));
  }

  updateProject(id: number, project: ProjectUpdateInput): Observable<Project> {
    return this.http
      .put<Project | { data: Project }>(`${this.apiBaseUrl}/api/v1/projects/${id}`, project)
      .pipe(map((res) => (res && 'data' in res && res.data ? res.data : (res as Project))));
  }
}
