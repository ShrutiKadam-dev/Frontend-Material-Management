import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { unwrapLatestApiRecord } from '../utils/api-response.utils';
import {
  TechnoCommercialTender,
  TechnoCommercialTenderCreateInput,
  TechnoCommercialTenderUpdateInput,
} from '../models/techno-commercial-tender.model';

@Injectable({
  providedIn: 'root',
})
export class TechnoCommercialTenderService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<TechnoCommercialTender[]> {
    return this.http
      .get<TechnoCommercialTender[] | { data: TechnoCommercialTender[] }>(
        `${this.apiBaseUrl}/api/v1/techno-commercial-tenders?project_id=${projectId}`,
      )
      .pipe(
        map((res) => {
          if (!res) return [];
          if (Array.isArray(res)) return res;
          if (typeof res === 'object' && Array.isArray((res as { data?: unknown[] }).data)) {
            return (res as { data: TechnoCommercialTender[] }).data;
          }
          return [];
        }),
        catchError(() => of([])),
      );
  }

  /**
   * Retrieves the latest Techno Commercial Tender (FORM_30_TECHNO_COMMERCIAL_TENDER)
   * for auto-patching fields into downstream forms like Bid Document - Techno Commercial Tender
   * (FORM_29_BID_DOC_TECHNO_COMMERCIAL) and Corrigendum (FORM_03_CORRIGENDUM).
   *
   * Route: GET /api/v1/techno-commercial-tenders/latest?project_id={projectId}
   */
  getLatest(projectId?: number): Observable<TechnoCommercialTender | null> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http
      .get<Record<string, unknown> | { data: Record<string, unknown> }>(
        `${this.apiBaseUrl}/api/v1/techno-commercial-tenders/latest${query}`,
      )
      .pipe(
        map((res: unknown) => this.unwrapAndNormalize(res)),
        catchError(() => of(null)),
      );
  }

  getById(id: number): Observable<TechnoCommercialTender> {
    return this.http.get<TechnoCommercialTender>(
      `${this.apiBaseUrl}/api/v1/techno-commercial-tenders/${id}`,
    );
  }

  create(
    payload: TechnoCommercialTenderCreateInput | Record<string, unknown>,
    files: File[] = [],
  ): Observable<TechnoCommercialTender> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<TechnoCommercialTender>(
      `${this.apiBaseUrl}/api/v1/techno-commercial-tenders`,
      fd,
    );
  }

  update(
    id: number,
    payload: TechnoCommercialTenderUpdateInput | Record<string, unknown>,
    files: File[] = [],
  ): Observable<TechnoCommercialTender> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http
      .patch<TechnoCommercialTender>(
        `${this.apiBaseUrl}/api/v1/techno-commercial-tenders/${id}`,
        fd,
      )
      .pipe(
        catchError((err: unknown) => {
          if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 405) {
            return this.http.put<TechnoCommercialTender>(
              `${this.apiBaseUrl}/api/v1/techno-commercial-tenders/${id}`,
              fd,
            );
          }
          return throwError(() => err);
        }),
      );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/techno-commercial-tenders/${id}`,
    );
  }

  private unwrapAndNormalize(res: unknown): TechnoCommercialTender | null {
    const raw = unwrapLatestApiRecord(res);
    if (!raw) return null;

    const title = String(raw['tender_title'] ?? raw['title'] ?? '').trim();
    const tenderNo = String(raw['tender_no'] ?? raw['number'] ?? '').trim();
    const issueDate = String(
      raw['tender_issue_date'] ?? raw['issue_date'] ?? raw['tender_date'] ?? '',
    ).trim();
    const pqbNo = String(
      raw['pqb_no'] ?? raw['pqbNo'] ?? raw['pqb_number'] ?? raw['pqbNumber'] ?? '',
    ).trim();
    const dueDateTime = String(raw['bid_submission_due_date_time'] ?? '').trim();
    const openingDateTime = String(raw['bid_opening_date_time'] ?? '').trim();
    const validity = String(raw['tender_validity'] ?? '').trim();

    const rawItems = raw['items'] || raw['table_items'] || raw['requirements'];
    const items = Array.isArray(rawItems)
      ? (rawItems as Array<Record<string, unknown>>).map((it, idx) => ({
          id: typeof it['id'] === 'number' ? it['id'] : undefined,
          sr_no: Number(it['sr_no'] ?? idx + 1),
          description: String(it['description'] || it['material_name'] || it['name'] || '').trim(),
          unit: it['unit'] ? String(it['unit']).trim() : undefined,
          quantity: it['quantity'] !== null && it['quantity'] !== undefined ? Number(it['quantity']) : 0,
        }))
      : undefined;

    return {
      id: Number(raw['id']) || undefined,
      project_id: Number(raw['project_id']) || undefined,
      pqb_no: pqbNo || undefined,
      tender_title: title,
      tender_no: tenderNo,
      tender_issue_date: issueDate || undefined,
      bid_submission_due_date_time: dueDateTime || undefined,
      bid_opening_date_time: openingDateTime || undefined,
      tender_fee: (raw['tender_fee'] as number | string | undefined) ?? undefined,
      emd: (raw['emd'] as number | string | undefined) ?? undefined,
      tender_validity: validity || undefined,
      items,
      created_at: raw['created_at'] ? String(raw['created_at']) : undefined,
      updated_at: raw['updated_at'] ? String(raw['updated_at']) : undefined,
    };
  }
}
