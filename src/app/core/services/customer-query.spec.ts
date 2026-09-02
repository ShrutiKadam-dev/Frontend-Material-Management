import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { CustomerQueryCreateInput, CustomerQueryUpdateInput } from '../models/customer-query.model';
import { CustomerQueryService } from './customer-query';

describe('CustomerQueryService', () => {
  let service: CustomerQueryService;
  let httpMock: HttpTestingController;
  const baseUrl = 'http://127.0.0.1:5000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: baseUrl },
      ],
    });
    service = TestBed.inject(CustomerQueryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get customer queries by project id', () => {
    service.getByProject(1).subscribe((data) => {
      expect(data.length).toBe(1);
    });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/customer-queries?project_id=1`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, project_id: 1, customer_id: 1, qo_date: '2026-09-02', remark: '', attachments: [], items: [] }]);
  });

  it('should create customer query via POST', () => {
    const payload: CustomerQueryCreateInput = {
      project_id: 1,
      customer_id: 1,
      qo_date: '2026-09-02',
      remark: 'New Query',
      items: [{ material_name: 'Item 1', quantity: '5' }],
    };

    service.create(payload).subscribe((res) => {
      expect(res.id).toBe(10);
    });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/customer-queries`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ id: 10, ...payload, attachments: [] });
  });

  it('should update customer query via PATCH', () => {
    const updatePayload: CustomerQueryUpdateInput = {
      remark: 'Updated Remark',
      items: [{ material_name: 'Item 1', quantity: '10' }],
    };

    service.update(10, updatePayload).subscribe((res) => {
      expect(res.remark).toBe('Updated Remark');
    });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/customer-queries/10`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ id: 10, project_id: 1, customer_id: 1, qo_date: '2026-09-02', ...updatePayload, attachments: [] });
  });

  it('should delete customer query via DELETE', () => {
    service.delete(10).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/customer-queries/10`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
