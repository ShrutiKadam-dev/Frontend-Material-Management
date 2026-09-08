import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  PackingList,
  PackingListCreateInput,
  PackingListUpdateInput,
} from '../models/packing-list.model';

@Injectable({
  providedIn: 'root',
})
export class PackingListService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<PackingList[]> {
    return this.http
      .get<PackingList[] | { data: PackingList[] }>(
        `${this.apiBaseUrl}/api/v1/supplier-packing-lists?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  getById(id: number): Observable<PackingList> {
    return this.http.get<PackingList>(
      `${this.apiBaseUrl}/api/v1/supplier-packing-lists/${id}`,
    );
  }

  create(
    payload: PackingListCreateInput,
    files: File[] = [],
  ): Observable<PackingList> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<PackingList>(
      `${this.apiBaseUrl}/api/v1/supplier-packing-lists`,
      fd,
    );
  }

  update(
    id: number,
    payload: PackingListUpdateInput,
    files: File[] = [],
  ): Observable<PackingList> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<PackingList>(
      `${this.apiBaseUrl}/api/v1/supplier-packing-lists/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/supplier-packing-lists/${id}`,
    );
  }
}
