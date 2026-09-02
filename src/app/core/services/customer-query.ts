import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { CustomerQuery, CustomerQueryCreateInput } from '../models/customer-query.model';

@Injectable({
  providedIn: 'root',
})
export class CustomerQueryService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<CustomerQuery[]> {
    return this.http.get<CustomerQuery[]>(
      `${this.apiBaseUrl}/api/v1/customer-queries?project_id=${projectId}`,
    );
  }

  /**
   * Single API call — sends JSON payload + files together as multipart/form-data.
   * - `data` part: JSON blob with application/json content-type (backend deserializes normally)
   * - `attachments` part: one entry per file (binary stream)
   * Browser sets the correct Content-Type + boundary automatically.
   */
  create(
    payload: CustomerQueryCreateInput,
    files: File[] = [],
  ): Observable<CustomerQuery> {
    const fd = new FormData();
    // Append JSON as a string
    fd.append('data', JSON.stringify(payload));
    // Append each file as a binary part
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<CustomerQuery>(
      `${this.apiBaseUrl}/api/v1/customer-queries`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/api/v1/customer-queries/${id}`);
  }
}
