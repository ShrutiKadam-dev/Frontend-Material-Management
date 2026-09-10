import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  BillOfEntry,
  BillOfEntryCreateInput,
  BillOfEntryUpdateInput,
  LatestBillOfEntry,
} from '../models/bill-of-entry.model';

@Injectable({
  providedIn: 'root',
})
export class BillOfEntryService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getLatest(projectId?: number): Observable<LatestBillOfEntry | null> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http
      .get<LatestBillOfEntry | { data: LatestBillOfEntry }>(
        `${this.apiBaseUrl}/api/v1/bills-of-entry/latest${query}`,
      )
      .pipe(
        map((res) => {
          if (!res) return null;
          if (typeof res === 'object' && 'data' in res && res.data) {
            return res.data as LatestBillOfEntry;
          }
          return res as LatestBillOfEntry;
        }),
        catchError(() => of(null)),
      );
  }

  getByProject(projectId: number): Observable<BillOfEntry[]> {
    return this.http
      .get<BillOfEntry[] | { data: BillOfEntry[] }>(
        `${this.apiBaseUrl}/api/v1/bills-of-entry?project_id=${projectId}`,
      )
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data || [])),
        catchError(() => of([])),
      );
  }

  getById(id: number): Observable<BillOfEntry> {
    return this.http.get<BillOfEntry>(
      `${this.apiBaseUrl}/api/v1/bills-of-entry/${id}`,
    );
  }

  create(
    payload: BillOfEntryCreateInput,
    files: File[] = [],
  ): Observable<BillOfEntry> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<BillOfEntry>(
      `${this.apiBaseUrl}/api/v1/bills-of-entry`,
      fd,
    );
  }

  update(
    id: number,
    payload: BillOfEntryUpdateInput,
    files: File[] = [],
  ): Observable<BillOfEntry> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<BillOfEntry>(
      `${this.apiBaseUrl}/api/v1/bills-of-entry/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/bills-of-entry/${id}`,
    );
  }
}
