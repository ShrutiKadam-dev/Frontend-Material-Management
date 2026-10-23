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
      .get<Record<string, unknown>>(
        `${this.apiBaseUrl}/api/v1/bills-of-entry/latest${query}`,
      )
      .pipe(
        map((res: Record<string, unknown>) => {
          if (!res) return null;
          let data = (res['data'] !== undefined ? res['data'] : res) as Record<string, unknown>;
          if (Array.isArray(data)) {
            data = (data as Array<Record<string, unknown>>)[0];
          }
          if (data && typeof data === 'object') {
            if (data['bill_of_entry']) data = data['bill_of_entry'] as Record<string, unknown>;
            else if (data['boe']) data = data['boe'] as Record<string, unknown>;
          }
          if (!data || typeof data !== 'object') return null;

          const boeNo = String(
            data['bill_of_entry_no'] ||
            data['bill_of_entry_number'] ||
            data['boe_no'] ||
            data['boe_number'] ||
            data['bill_no'] ||
            '',
          );

          const boeDate = String(
            data['date'] ||
            data['boe_date'] ||
            data['bill_of_entry_date'] ||
            data['entry_date'] ||
            '',
          );

          const bcd = data['bcd'] != null && !isNaN(Number(data['bcd'])) ? Number(data['bcd']) : undefined;
          const sws = data['sws'] != null && !isNaN(Number(data['sws'])) ? Number(data['sws']) : undefined;
          const igst =
            data['igst'] != null && !isNaN(Number(data['igst']))
              ? Number(data['igst'])
              : data['igst_amount'] != null && !isNaN(Number(data['igst_amount']))
              ? Number(data['igst_amount'])
              : undefined;

          const totalDuty =
            data['total_duty'] != null && !isNaN(Number(data['total_duty']))
              ? Number(data['total_duty'])
              : data['duty'] != null && !isNaN(Number(data['duty']))
              ? Number(data['duty'])
              : undefined;

          const totalAssessableValue =
            data['total_assessable_value'] != null && !isNaN(Number(data['total_assessable_value']))
              ? Number(data['total_assessable_value'])
              : undefined;

          return {
            ...data,
            id: data['id'] as number | undefined,
            project_id: data['project_id'] as number | undefined,
            bill_of_entry_no: boeNo,
            bill_of_entry_number: boeNo,
            boe_no: boeNo,
            date: boeDate,
            boe_date: boeDate,
            bill_of_entry_date: boeDate,
            bcd,
            sws,
            igst,
            igst_amount: igst,
            duty: totalDuty,
            total_duty: totalDuty,
            total_assessable_value: totalAssessableValue,
          } as LatestBillOfEntry;
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
