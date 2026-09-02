import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { QuotationRequestCreateInput, QuotationRequestUpdateInput } from '../models/quotation-request.model';
import { QuotationRequestService } from './quotation-request';

describe('QuotationRequestService', () => {
  let service: QuotationRequestService;
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
    service = TestBed.inject(QuotationRequestService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get quotation requests by project id', () => {
    service.getByProject(1).subscribe((data) => {
      expect(data.length).toBe(1);
    });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/quotation-requests?project_id=1`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 1, project_id: 1, supplier_id: 2, quotation_requested_date: '2026-09-02', supplier_contacted: true, remarks: '', attachments: [], items: [] }]);
  });

  it('should create quotation request via POST', () => {
    const payload: QuotationRequestCreateInput = {
      project_id: 1,
      supplier_id: 2,
      quotation_requested_date: '2026-09-02',
      supplier_contacted: true,
      remarks: 'Test',
      items: [{ material_name: 'Pipe', quantity: '10' }],
    };

    service.create(payload).subscribe((res) => {
      expect(res.id).toBe(20);
    });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/quotation-requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ id: 20, ...payload, attachments: [] });
  });

  it('should update quotation request via PATCH', () => {
    const updatePayload: QuotationRequestUpdateInput = {
      remarks: 'Updated remark',
      supplier_contacted: false,
    };

    service.update(20, updatePayload).subscribe((res) => {
      expect(res.remarks).toBe('Updated remark');
    });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/quotation-requests/20`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ id: 20, project_id: 1, supplier_id: 2, quotation_requested_date: '2026-09-02', ...updatePayload, attachments: [], items: [] });
  });

  it('should delete quotation request via DELETE', () => {
    service.delete(20).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/quotation-requests/20`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
