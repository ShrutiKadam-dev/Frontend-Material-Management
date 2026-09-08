import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  CustomsClearance,
  CustomsClearanceCreateInput,
  CustomsClearanceUpdateInput,
} from '../models/customs-clearance.model';

@Injectable({
  providedIn: 'root',
})
export class CustomsClearanceService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<CustomsClearance[]> {
    return this.http
      .get<CustomsClearance[] | { data: CustomsClearance[] }>(
        `${this.apiBaseUrl}/api/v1/customs-clearances?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  getById(id: number): Observable<CustomsClearance> {
    return this.http.get<CustomsClearance>(
      `${this.apiBaseUrl}/api/v1/customs-clearances/${id}`,
    );
  }

  create(
    payload: CustomsClearanceCreateInput,
    dutyChallanFiles: File[] = [],
    boeFiles: File[] = [],
    otherDocsFiles: File[] = [],
  ): Observable<CustomsClearance> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    dutyChallanFiles.forEach((file) => fd.append('duty_challan_file', file, file.name));
    boeFiles.forEach((file) => fd.append('boe_file', file, file.name));
    otherDocsFiles.forEach((file) => fd.append('other_docs_file', file, file.name));
    // Also append to general 'file' for fallback backend support
    // [...dutyChallanFiles, ...boeFiles, ...otherDocsFiles].forEach((file) =>
    //   fd.append('file', file, file.name),
    // );

    return this.http.post<CustomsClearance>(
      `${this.apiBaseUrl}/api/v1/customs-clearances`,
      fd,
    );
  }

  update(
    id: number,
    payload: CustomsClearanceUpdateInput,
    dutyChallanFiles: File[] = [],
    boeFiles: File[] = [],
    otherDocsFiles: File[] = [],
  ): Observable<CustomsClearance> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    dutyChallanFiles.forEach((file) => fd.append('duty_challan_file', file, file.name));
    boeFiles.forEach((file) => fd.append('boe_file', file, file.name));
    otherDocsFiles.forEach((file) => fd.append('other_docs_file', file, file.name));
    [...dutyChallanFiles, ...boeFiles, ...otherDocsFiles].forEach((file) =>
      fd.append('file', file, file.name),
    );

    return this.http.patch<CustomsClearance>(
      `${this.apiBaseUrl}/api/v1/customs-clearances/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/customs-clearances/${id}`,
    );
  }
}
