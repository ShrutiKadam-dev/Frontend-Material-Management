import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../tokens/api-base-url.token';
import { SupplierQuotationCreateInput, SupplierQuotationUpdateInput } from '../models/supplier-quotation.model';
import { SupplierQuotationService } from './supplier-quotation';

describe('SupplierQuotationService', () => {
  let service: SupplierQuotationService;
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
    service = TestBed.inject(SupplierQuotationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch supplier quotations by project id', () => {
    service.getByProject(1).subscribe((data) => {
      expect(data.length).toBe(1);
      expect(data[0].id).toBe(101);
    });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/supplier-quotations?project_id=1`);
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 101,
        project_id: 1,
        supplier_id: 1,
        quotation_number: 'SQ-2026-00891',
        quotation_date: '2026-09-02',
        quotation_value: '15000.00',
        validity: '60 Days',
        incoterms: 'FOB',
        payment_terms: '50% Advance, 50% against Delivery',
        delivery_period: '5 Weeks',
        remark: 'Prices include standard 1-year operational warranty.',
        attachments: [],
        items: [],
      },
    ]);
  });

  it('should create supplier quotation via POST with exact schema', () => {
    const payload: SupplierQuotationCreateInput = {
      project_id: 1,
      supplier_id: 1,
      quotation_number: 'SQ-2026-00891',
      quotation_date: '2026-09-02',
      quotation_value: '15000.00',
      validity: '60 Days',
      incoterms: 'FOB',
      payment_terms: '50% Advance, 50% against Delivery',
      delivery_period: '5 Weeks',
      remark: 'Prices include standard 1-year operational warranty.',
      items: [
        { material_name: 'High-Pressure Hydraulic Valve', quantity: 10 },
        { material_name: 'Stainless Steel Connecting Pipe', quantity: 50 },
      ],
    };

    service.create(payload).subscribe((res) => {
      expect(res.id).toBe(102);
      expect(res.quotation_number).toBe('SQ-2026-00891');
    });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/supplier-quotations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ id: 102, ...payload, attachments: [] });
  });

  it('should update supplier quotation via PATCH', () => {
    const updatePayload: SupplierQuotationUpdateInput = {
      quotation_number: 'SQ-2026-00891-REV1',
      quotation_value: '16000.00',
      remark: 'Updated warranty terms.',
      items: [
        { material_name: 'High-Pressure Hydraulic Valve', quantity: 12 },
      ],
    };

    service.update(102, updatePayload).subscribe((res) => {
      expect(res.quotation_number).toBe('SQ-2026-00891-REV1');
      expect(res.quotation_value).toBe('16000.00');
    });

    const req = httpMock.expectOne(`${baseUrl}/api/v1/supplier-quotations/102`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({
      id: 102,
      project_id: 1,
      supplier_id: 1,
      quotation_date: '2026-09-02',
      validity: '60 Days',
      incoterms: 'FOB',
      payment_terms: '50% Advance, 50% against Delivery',
      delivery_period: '5 Weeks',
      ...updatePayload,
      attachments: [],
    });
  });

  it('should delete supplier quotation via DELETE', () => {
    service.delete(102).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/api/v1/supplier-quotations/102`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
