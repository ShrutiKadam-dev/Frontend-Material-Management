import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { PreQualificationBidService } from './pre-qualification-bid';

describe('PreQualificationBidService', () => {
  it('should fetch latest National PQB and normalize pqb_title and pqb_no', () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(
        of({
          data: {
            id: 1,
            project_id: 10,
            pqb_title: 'National Thermal Power Grid Expansion',
            pqb_no: 'NTPC-PQB-2026-09',
            pqb_issuing_date: '2026-03-01',
            pqb_closing_date_time: '2026-03-20T17:00',
            pqb_opening_date_time: '2026-03-21T11:00',
            created_at: '2026-03-01T09:00:00Z',
            updated_at: '2026-03-02T12:00:00Z',
            items: [
              { id: 1, sr_no: 1, description: 'Power Cable', unit: 'Mtr', quantity: 500 },
            ],
          },
        }),
      ),
    };

    const service = Object.create(PreQualificationBidService.prototype);
    (service as unknown as { http: typeof mockHttp }).http = mockHttp;
    (service as unknown as { apiBaseUrl: string }).apiBaseUrl = 'http://localhost:3000';

    service.getLatest(10).subscribe((res: unknown) => {
      expect(res).toBeDefined();
      const pqb = res as Record<string, unknown>;
      expect(pqb['pqb_title']).toBe('National Thermal Power Grid Expansion');
      expect(pqb['pqb_no']).toBe('NTPC-PQB-2026-09');
      expect(pqb['pqb_issue_date']).toBe('2026-03-01');
      expect(pqb['created_at']).toBe('2026-03-01T09:00:00Z');
      expect(pqb['updated_at']).toBe('2026-03-02T12:00:00Z');
      expect(pqb['items']).toBeDefined();
      expect((pqb['items'] as Array<unknown>).length).toBe(1);
    });

    expect(mockHttp.get).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/pre-qualification-bids/latest?project_id=10',
    );
  });

  it('should return null when /latest fails without calling any fallback endpoint', () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(throwError(() => new Error('Not found'))),
    };

    const service = Object.create(PreQualificationBidService.prototype);
    (service as unknown as { http: typeof mockHttp }).http = mockHttp;
    (service as unknown as { apiBaseUrl: string }).apiBaseUrl = 'http://localhost:3000';

    service.getLatest(10).subscribe((res: unknown) => {
      expect(res).toBeNull();
    });

    expect(mockHttp.get).toHaveBeenCalledTimes(1);
    expect(mockHttp.get).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/pre-qualification-bids/latest?project_id=10',
    );
  });

  it('should handle unwrapped stringified JSON data property', () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(
        of({
          id: 5,
          project_id: 20,
          data: JSON.stringify({
            pqb_title: 'Grid Overhaul PQB',
            pqb_no: 'GRID-PQB-77',
          }),
        }),
      ),
    };

    const service = Object.create(PreQualificationBidService.prototype);
    (service as unknown as { http: typeof mockHttp }).http = mockHttp;
    (service as unknown as { apiBaseUrl: string }).apiBaseUrl = 'http://localhost:3000';

    service.getLatest(20).subscribe((res: unknown) => {
      const pqb = res as Record<string, unknown>;
      expect(pqb['pqb_title']).toBe('Grid Overhaul PQB');
      expect(pqb['pqb_no']).toBe('GRID-PQB-77');
    });
  });

  it('should return null when /latest returns an error envelope or data: null', () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(
        of({
          error: {
            code: 'NOT_FOUND',
            message: 'Pre-qualification bid not found.',
          },
          success: false,
        }),
      ),
    };

    const service = Object.create(PreQualificationBidService.prototype);
    (service as unknown as { http: typeof mockHttp }).http = mockHttp;
    (service as unknown as { apiBaseUrl: string }).apiBaseUrl = 'http://localhost:3000';

    service.getLatest(10).subscribe((res: unknown) => {
      expect(res).toBeNull();
    });

    mockHttp.get.mockReturnValue(of({ success: true, data: null }));
    service.getLatest(10).subscribe((res: unknown) => {
      expect(res).toBeNull();
    });
  });

  it('should return empty array on getByProject error', () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(throwError(() => new Error('Network error'))),
    };

    const service = Object.create(PreQualificationBidService.prototype);
    (service as unknown as { http: typeof mockHttp }).http = mockHttp;
    (service as unknown as { apiBaseUrl: string }).apiBaseUrl = 'http://localhost:3000';

    service.getByProject(10).subscribe((res: unknown[]) => {
      expect(res).toEqual([]);
    });
  });
});

