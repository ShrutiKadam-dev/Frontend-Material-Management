import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  CustomerTender,
  CustomerTenderCreateInput,
  CustomerTenderUpdateInput,
  PacTender,
  PacTenderCreateInput,
  PacTenderUpdateInput,
} from '../models/customer-tender.model';

@Injectable({
  providedIn: 'root',
})
export class CustomerTenderService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<CustomerTender[]> {
    return this.http.get<CustomerTender[]>(
      `${this.apiBaseUrl}/api/v1/pac-tenders?project_id=${projectId}`,
    );
  }

  getLatestByProject(projectId?: number): Observable<CustomerTender | CustomerTender[]> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http.get<CustomerTender | CustomerTender[]>(
      `${this.apiBaseUrl}/api/v1/pac-tenders/latest${query}`,
    );
  }

  getById(id: number): Observable<CustomerTender> {
    return this.http.get<CustomerTender>(
      `${this.apiBaseUrl}/api/v1/pac-tenders/${id}`,
    );
  }

  create(
    payload: CustomerTenderCreateInput | PacTenderCreateInput,
    files: File[] = [],
  ): Observable<CustomerTender> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<CustomerTender>(
      `${this.apiBaseUrl}/api/v1/pac-tenders`,
      fd,
    );
  }

  update(
    id: number,
    payload: CustomerTenderUpdateInput | PacTenderUpdateInput,
    files: File[] = [],
  ): Observable<CustomerTender> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<CustomerTender>(
      `${this.apiBaseUrl}/api/v1/pac-tenders/${id}`,
      fd,
    ).pipe(
      catchError((err: unknown) => {
        if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 405) {
          return this.http.put<CustomerTender>(
            `${this.apiBaseUrl}/api/v1/pac-tenders/${id}`,
            fd,
          );
        }
        return throwError(() => err);
      }),
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/pac-tenders/${id}`,
    );
  }
}

export { CustomerTenderService as PacTenderService };
