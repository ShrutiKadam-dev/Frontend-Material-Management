import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  CostSheet,
  CostSheetCreateInput,
  CostSheetUpdateInput,
} from '../models/cost-sheet.model';

@Injectable({
  providedIn: 'root',
})
export class CostSheetService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<CostSheet[]> {
    return this.http.get<CostSheet[]>(
      `${this.apiBaseUrl}/api/cost-sheet?project_id=${projectId}`,
    );
  }

  getAll(): Observable<CostSheet[]> {
    return this.http.get<CostSheet[]>(`${this.apiBaseUrl}/api/cost-sheet`);
  }

  getById(id: number): Observable<CostSheet> {
    return this.http.get<CostSheet>(`${this.apiBaseUrl}/api/cost-sheet/${id}`);
  }

  create(payload: CostSheetCreateInput): Observable<CostSheet> {
    return this.http.post<CostSheet>(
      `${this.apiBaseUrl}/api/cost-sheet`,
      payload,
    );
  }

  export(costSheetId: number): Observable<Blob> {
    return this.http.get(`${this.apiBaseUrl}/api/cost-sheet/${costSheetId}/export`, {
      responseType: 'blob',
    });
  }
}
