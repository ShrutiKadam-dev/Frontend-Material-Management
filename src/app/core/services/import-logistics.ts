import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  ImportLogistics,
  ImportLogisticsCreateInput,
  ImportLogisticsUpdateInput,
} from '../models/import-logistics.model';

@Injectable({
  providedIn: 'root',
})
export class ImportLogisticsService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<ImportLogistics[]> {
    return this.http
      .get<ImportLogistics[] | { data: ImportLogistics[] }>(
        `${this.apiBaseUrl}/api/v1/import-logistics?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  getById(id: number): Observable<ImportLogistics> {
    return this.http.get<ImportLogistics>(
      `${this.apiBaseUrl}/api/v1/import-logistics/${id}`,
    );
  }

  create(
    payload: ImportLogisticsCreateInput,
    files: File[] = [],
  ): Observable<ImportLogistics> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<ImportLogistics>(
      `${this.apiBaseUrl}/api/v1/import-logistics`,
      fd,
    );
  }

  update(
    id: number,
    payload: ImportLogisticsUpdateInput,
    files: File[] = [],
  ): Observable<ImportLogistics> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<ImportLogistics>(
      `${this.apiBaseUrl}/api/v1/import-logistics/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/import-logistics/${id}`,
    );
  }
}
