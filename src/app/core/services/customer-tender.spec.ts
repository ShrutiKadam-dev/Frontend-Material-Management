import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { CustomerTenderService, PacTenderService } from './customer-tender';
import { CustomerTender, PacTender } from '../models/customer-tender.model';

describe('CustomerTenderService / PacTenderService', () => {
  const mockPacTender: CustomerTender = {
    id: 101,
    project_id: 16,
    customer_id: 5,
    tender_title: 'Defense PAC Tender',
    tender_number: 'PAC-16-001',
    tender_date: '2026-11-10',
  };

  it('getByProject should call GET /api/v1/pac-tenders?project_id=16', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(of([mockPacTender])),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = Object.create(CustomerTenderService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://127.0.0.1:5000';

    const result = await new Promise<CustomerTender[]>((resolve) => {
      service.getByProject(16).subscribe(resolve);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('http://127.0.0.1:5000/api/v1/pac-tenders?project_id=16');
    expect(result).toHaveLength(1);
    expect(result[0].tender_number).toBe('PAC-16-001');
  });

  it('getLatestByProject should call GET /api/v1/pac-tenders/latest?project_id=16', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(of(mockPacTender)),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = Object.create(CustomerTenderService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://127.0.0.1:5000';

    const result = await new Promise<CustomerTender | CustomerTender[]>((resolve) => {
      service.getLatestByProject(16).subscribe(resolve);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('http://127.0.0.1:5000/api/v1/pac-tenders/latest?project_id=16');
    expect(result).toEqual(mockPacTender);
  });

  it('create should call POST /api/v1/pac-tenders', async () => {
    const mockHttp = {
      get: vi.fn(),
      post: vi.fn().mockReturnValue(of(mockPacTender)),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = Object.create(CustomerTenderService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://127.0.0.1:5000';

    const result = await new Promise<CustomerTender>((resolve) => {
      service.create({ project_id: 16, tender_title: 'Defense PAC Tender' } as any).subscribe(resolve);
    });

    expect(mockHttp.post).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/v1/pac-tenders',
      expect.any(FormData),
    );
    expect(result.tender_number).toBe('PAC-16-001');
  });

  it('update should call PATCH /api/v1/pac-tenders/:id', async () => {
    const mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn().mockReturnValue(of({ ...mockPacTender, tender_title: 'Updated' })),
      delete: vi.fn(),
    };

    const service = Object.create(CustomerTenderService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://127.0.0.1:5000';

    const result = await new Promise<CustomerTender>((resolve) => {
      service.update(101, { tender_title: 'Updated' }).subscribe(resolve);
    });

    expect(mockHttp.patch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/v1/pac-tenders/101',
      expect.any(FormData),
    );
    expect(result.tender_title).toBe('Updated');
  });

  it('delete should call DELETE /api/v1/pac-tenders/:id', async () => {
    const mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    const service = Object.create(CustomerTenderService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://127.0.0.1:5000';

    await new Promise<void>((resolve) => {
      service.delete(101).subscribe(resolve);
    });

    expect(mockHttp.delete).toHaveBeenCalledWith('http://127.0.0.1:5000/api/v1/pac-tenders/101');
  });
});
