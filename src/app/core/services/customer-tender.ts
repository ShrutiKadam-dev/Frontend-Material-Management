import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  CustomerTender,
  CustomerTenderCreateInput,
  CustomerTenderUpdateInput,
} from '../models/customer-tender.model';

@Injectable({
  providedIn: 'root',
})
export class CustomerTenderService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<CustomerTender[]> {
    return this.http.get<CustomerTender[]>(
      `${this.apiBaseUrl}/api/v1/customer-tenders?project_id=${projectId}`,
    );
  }

  getLatestByProject(projectId?: number): Observable<CustomerTender | CustomerTender[]> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http.get<CustomerTender | CustomerTender[]>(
      `${this.apiBaseUrl}/api/customer-tender/latest${query}`,
    );
  }

  getById(id: number): Observable<CustomerTender> {
    return this.http.get<CustomerTender>(
      `${this.apiBaseUrl}/api/v1/customer-tenders/${id}`,
    );
  }

  create(
    payload: CustomerTenderCreateInput,
    files: File[] = [],
  ): Observable<CustomerTender> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<CustomerTender>(
      `${this.apiBaseUrl}/api/v1/customer-tenders`,
      fd,
    );
  }

  update(
    id: number,
    payload: CustomerTenderUpdateInput,
    files: File[] = [],
  ): Observable<CustomerTender> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<CustomerTender>(
      `${this.apiBaseUrl}/api/v1/customer-tenders/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/customer-tenders/${id}`,
    );
  }
}
