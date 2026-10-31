import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';

import { API_BASE_URL } from '../tokens/api-base-url.token';

export interface LocationLookupResult {
  city: string;
  state: string;
  country: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private countriesCache$?: Observable<string[]>;

  /**
   * Normalizes strings by removing unicode diacritical marks/macrons (e.g. Kolhāpur -> Kolhapur)
   * and deduplicates case-insensitively while preserving order.
   */
  private deduplicateLocations(items: string[]): string[] {
    const map = new Map<string, string>();
    for (const item of items) {
      if (!item || typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed) continue;

      const normalized = trimmed.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      const key = normalized.toLowerCase();

      if (!map.has(key)) {
        map.set(key, normalized);
      } else {
        const existing = map.get(key)!;
        if (/[^\x00-\x7F]/.test(existing) && !/[^\x00-\x7F]/.test(normalized)) {
          map.set(key, normalized);
        }
      }
    }
    return Array.from(map.values());
  }

  /**
   * Retrieves the dynamic list of countries from backend.
   * Cached in-memory to minimize network calls.
   */
  getCountries(): Observable<string[]> {
    if (!this.countriesCache$) {
      this.countriesCache$ = this.http
        .get<ApiResponse<string[]>>(`${this.apiBaseUrl}/api/v1/locations/countries`)
        .pipe(
          map((res) => this.deduplicateLocations(res && Array.isArray(res.data) ? res.data : [])),
          catchError(() => of(['India'])),
          shareReplay(1)
        );
    }
    return this.countriesCache$;
  }

  /**
   * Retrieves states dynamically for a selected country.
   */
  getStates(country?: string | null): Observable<string[]> {
    let params = new HttpParams();
    if (country?.trim()) {
      params = params.set('country', country.trim());
    }

    return this.http
      .get<ApiResponse<string[]>>(`${this.apiBaseUrl}/api/v1/locations/states`, { params })
      .pipe(
        map((res) => this.deduplicateLocations(res && Array.isArray(res.data) ? res.data : [])),
        catchError(() => of([]))
      );
  }

  /**
   * Retrieves cities dynamically filtered by country, state, and optional search query.
   */
  getCities(
    country?: string | null,
    state?: string | null,
    search?: string | null,
  ): Observable<string[]> {
    let params = new HttpParams();
    if (country?.trim()) {
      params = params.set('country', country.trim());
    }
    if (state?.trim()) {
      params = params.set('state', state.trim());
    }
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http
      .get<ApiResponse<string[]>>(`${this.apiBaseUrl}/api/v1/locations/cities`, { params })
      .pipe(
        map((res) => this.deduplicateLocations(res && Array.isArray(res.data) ? res.data : [])),
        catchError(() => of([]))
      );
  }

  /**
   * Dynamic lookup: given a city name (and optional contextual country and state),
   * resolves corresponding state and country.
   */
  lookupCity(
    cityName?: string | null,
    country?: string | null,
    state?: string | null,
  ): Observable<LocationLookupResult | null> {
    if (!cityName?.trim()) {
      return of(null);
    }

    let params = new HttpParams().set('city', cityName.trim());
    if (country?.trim()) {
      params = params.set('country', country.trim());
    }
    if (state?.trim()) {
      params = params.set('state', state.trim());
    }

    return this.http
      .get<ApiResponse<LocationLookupResult>>(`${this.apiBaseUrl}/api/v1/locations/lookup`, { params })
      .pipe(
        map((res) => {
          if (!res || !res.success || !res.data) return null;
          return {
            city: res.data.city ? res.data.city.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim() : '',
            state: res.data.state ? res.data.state.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim() : '',
            country: res.data.country ? res.data.country.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim() : '',
          };
        }),
        catchError(() => of(null))
      );
  }
}
