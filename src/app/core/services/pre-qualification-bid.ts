import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import {
  PreQualificationBid,
  PreQualificationBidCreateInput,
  PreQualificationBidUpdateInput,
} from '../models/pre-qualification-bid.model';

@Injectable({
  providedIn: 'root',
})
export class PreQualificationBidService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  getByProject(projectId: number): Observable<PreQualificationBid[]> {
    return this.http
      .get<PreQualificationBid[] | { data: PreQualificationBid[] }>(
        `${this.apiBaseUrl}/api/v1/pre-qualification-bids?project_id=${projectId}`,
      )
      .pipe(
        map((res) => {
          if (!res) return [];
          if (Array.isArray(res)) return res;
          if (typeof res === 'object' && Array.isArray((res as { data?: unknown[] }).data)) {
            return (res as { data: PreQualificationBid[] }).data;
          }
          return [];
        }),
        catchError(() => of([])),
      );
  }

  /**
   * Retrieves the latest National Pre-Qualification Bid (PQB) for auto-patching fields
   * into downstream forms like Bid Document for PQB (FORM_02_PQB_BID_DOCUMENT).
   *
   * Route: GET /api/v1/pre-qualification-bids/latest?project_id={projectId}
   */
  getLatest(projectId?: number): Observable<PreQualificationBid | null> {
    const query = projectId ? `?project_id=${projectId}` : '';
    return this.http
      .get<Record<string, unknown> | { data: Record<string, unknown> }>(
        `${this.apiBaseUrl}/api/v1/pre-qualification-bids/latest${query}`,
      )
      .pipe(
        map((res: unknown) => {
          if (!res || typeof res !== 'object') return null;
          const data = ((res as Record<string, unknown>)['data'] || res) as Record<string, unknown>;
          return this.normalizePqb(data);
        }),
        catchError(() => of(null)),
      );
  }

  getById(id: number): Observable<PreQualificationBid> {
    return this.http.get<PreQualificationBid>(
      `${this.apiBaseUrl}/api/v1/pre-qualification-bids/${id}`,
    );
  }

  create(
    payload: PreQualificationBidCreateInput | Record<string, unknown>,
    files: File[] = [],
  ): Observable<PreQualificationBid> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.post<PreQualificationBid>(
      `${this.apiBaseUrl}/api/v1/pre-qualification-bids`,
      fd,
    );
  }

  update(
    id: number,
    payload: PreQualificationBidUpdateInput | Record<string, unknown>,
    files: File[] = [],
  ): Observable<PreQualificationBid> {
    const fd = new FormData();
    fd.append('data', JSON.stringify(payload));
    files.forEach((file) => fd.append('file', file, file.name));
    return this.http.patch<PreQualificationBid>(
      `${this.apiBaseUrl}/api/v1/pre-qualification-bids/${id}`,
      fd,
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/v1/pre-qualification-bids/${id}`,
    );
  }

  private normalizePqb(raw: Record<string, unknown>): PreQualificationBid {
    let unwrapped = raw;
    if (typeof raw['data'] === 'string') {
      try {
        unwrapped = { ...raw, ...(JSON.parse(raw['data']) as Record<string, unknown>) };
      } catch {
        unwrapped = raw;
      }
    } else if (raw['data'] && typeof raw['data'] === 'object') {
      unwrapped = { ...raw, ...(raw['data'] as Record<string, unknown>) };
    }

    const title = String(
      unwrapped['pqb_title'] ??
        unwrapped['pqbTitle'] ??
        unwrapped['title'] ??
        unwrapped['bid_title'] ??
        unwrapped['name'] ??
        '',
    ).trim();

    const no = String(
      unwrapped['pqb_no'] ??
        unwrapped['pqbNo'] ??
        unwrapped['pqb_number'] ??
        unwrapped['pqbNumber'] ??
        unwrapped['bid_no'] ??
        unwrapped['bid_number'] ??
        unwrapped['number'] ??
        '',
    ).trim();

    const issueDate = String(
      unwrapped['pqb_issuing_date'] ??
        unwrapped['pqb_issue_date'] ??
        unwrapped['issue_date'] ??
        unwrapped['issuing_date'] ??
        '',
    ).trim();

    const closingDate = String(
      unwrapped['pqb_closing_date_time'] ?? unwrapped['closing_date_time'] ?? '',
    ).trim();

    const openingDate = String(
      unwrapped['pqb_opening_date_time'] ?? unwrapped['opening_date_time'] ?? '',
    ).trim();

    return {
      id: Number(unwrapped['id']) || undefined,
      project_id: Number(unwrapped['project_id']) || undefined,
      pqb_title: title,
      pqb_no: no,
      pqb_issuing_date: issueDate || undefined,
      pqb_issue_date: issueDate || undefined,
      pqb_closing_date_time: closingDate || undefined,
      pqb_opening_date_time: openingDate || undefined,
      mode_of_bid_submission: unwrapped['mode_of_bid_submission']
        ? String(unwrapped['mode_of_bid_submission'])
        : undefined,
    };
  }
}

