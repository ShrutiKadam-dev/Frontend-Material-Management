import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { FormApiService, normalizeBackendEntityToStep } from './form-api';
import { FormDefinition } from '../constants/form-catalog';
import { ProjectStep } from '../models/project-step.model';

describe('FormApiService', () => {
  const sampleDef: FormDefinition = {
    id: 9,
    formCode: 'FORM_09_RFQ',
    name: 'Request for Quotation (RFQ)',
    category: 'Sourcing & Quotations',
    phaseId: 'phase-1',
    icon: 'pi pi-send',
    description: 'Dispatch RFQ to prospective vendors and suppliers with requirements',
    apiEndpoint: '/api/v1/quotation-requests',
    fields: [
      { key: 'supplier_name', label: 'Supplier Name', type: 'text' },
      { key: 'request_date', label: 'Request Date', type: 'date' },
    ],
    uploads: [],
  };

  const sampleDefWithoutEndpoint: FormDefinition = {
    id: 1,
    formCode: 'FORM_01_PQB',
    name: 'National Pre-Qualification Bid (PQB)',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-1',
    icon: 'pi pi-file-edit',
    description: 'Pre-qualification bid terms',
    fields: [],
    uploads: [],
  };

  it('normalizeBackendEntityToStep should properly normalize backend fields into ProjectStep', () => {
    const rawBackendItem = {
      id: 42,
      project_id: 10,
      step_name: 'Custom Step Title',
      supplier_name: 'Acme Steel Corp',
      request_date: '2026-10-15',
      items: [{ description: 'High-tensile Bolt', quantity: 100 }],
      attachments: [{ file_name: 'quote_doc.pdf', size: '1.2 MB' }],
      remarks: [{ remark: 'Verified by Engineer', user: 'Shruti Kadam' }],
      status: 'in_progress',
      created_at: '2026-10-15T09:00:00.000Z',
    };

    const step = normalizeBackendEntityToStep(rawBackendItem, sampleDef, 10);

    expect(step.id).toBe(42);
    expect(step.project_id).toBe(10);
    expect(step.form_code).toBe('FORM_09_RFQ');
    expect(step.status).toBe('in_progress');
    expect(step.data).toBeDefined();
    expect(step.data?.['items']).toEqual([
      expect.objectContaining({ description: 'High-tensile Bolt', quantity: 100, material_name: 'High-tensile Bolt' }),
    ]);
    expect(step.data?.['table_items']).toBeUndefined();
    expect(step.data?.['supplier_name']).toBe('Acme Steel Corp');
  });

  it('getEntries should call dedicated REST endpoint when apiEndpoint is provided', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(
        of([
          {
            id: 1,
            project_id: 7,
            supplier_name: 'Beta Supplies',
            items: [],
            attachments: [],
            remarks: [],
          },
        ]),
      ),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const mockProjectStepService = {
      getSteps: vi.fn().mockReturnValue(of([])),
      addStep: vi.fn(),
      updateStep: vi.fn(),
      removeStep: vi.fn(),
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';
    service.projectStepService = mockProjectStepService;

    const entries = await new Promise<ProjectStep[]>((resolve) => {
      service.getEntries(sampleDef, 7).subscribe(resolve);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('http://localhost:5000/api/v1/quotation-requests?project_id=7');
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(1);
    expect(entries[0].form_code).toBe('FORM_09_RFQ');
  });

  it('getEntries should return empty array when no apiEndpoint is present and not call steps', async () => {
    const mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';

    const entries = await new Promise<ProjectStep[]>((resolve) => {
      service.getEntries(sampleDefWithoutEndpoint, 7).subscribe(resolve);
    });

    expect(mockHttp.get).not.toHaveBeenCalled();
    expect(entries).toHaveLength(0);
  });

  it('getLatestEntry should call /latest endpoint directly and normalize without calling fallback', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(
        of({
          data: {
            id: 10,
            project_id: 7,
            tender_title: 'Grid Overhaul Tender',
          },
        }),
      ),
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';

    const latest = await new Promise<ProjectStep | null>((resolve) => {
      service.getLatestEntry(sampleDef, 7).subscribe(resolve);
    });

    expect(mockHttp.get).toHaveBeenCalledTimes(1);
    expect(mockHttp.get).toHaveBeenCalledWith('http://localhost:5000/api/v1/quotation-requests/latest?project_id=7');
    expect(latest).not.toBeNull();
    expect(latest?.id).toBe(10);
    expect(latest?.form_code).toBe('FORM_09_RFQ');
  });

  it('getLatestEntry should return null when /latest returns empty or zero data envelope', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(of({ data: null })),
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';

    const latest = await new Promise<ProjectStep | null>((resolve) => {
      service.getLatestEntry(sampleDef, 7).subscribe(resolve);
    });

    expect(latest).toBeNull();

    // Also test empty array envelope { data: [] }
    mockHttp.get.mockReturnValue(of({ data: [] }));
    const latestArray = await new Promise<ProjectStep | null>((resolve) => {
      service.getLatestEntry(sampleDef, 7).subscribe(resolve);
    });
    expect(latestArray).toBeNull();

    // Also test raw empty array []
    mockHttp.get.mockReturnValue(of([]));
    const latestRawEmpty = await new Promise<ProjectStep | null>((resolve) => {
      service.getLatestEntry(sampleDef, 7).subscribe(resolve);
    });
    expect(latestRawEmpty).toBeNull();
  });

  it('getLatestEntry should return null when /latest fails without calling any fallback endpoint', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(throwError(() => new Error('Not found'))),
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';

    const latest = await new Promise<ProjectStep | null>((resolve) => {
      service.getLatestEntry(sampleDef, 7).subscribe(resolve);
    });

    expect(mockHttp.get).toHaveBeenCalledTimes(1);
    expect(mockHttp.get).toHaveBeenCalledWith('http://localhost:5000/api/v1/quotation-requests/latest?project_id=7');
    expect(latest).toBeNull();
  });

  it('getLatestEntry should return null when no apiEndpoint is present', async () => {
    const mockHttp = {
      get: vi.fn(),
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';

    const latest = await new Promise<ProjectStep | null>((resolve) => {
      service.getLatestEntry(sampleDefWithoutEndpoint, 7).subscribe(resolve);
    });

    expect(mockHttp.get).not.toHaveBeenCalled();
    expect(latest).toBeNull();
  });

  it('getEntryById should fetch a single record from the dedicated individual endpoint', async () => {
    const mockHttp = {
      get: vi.fn().mockReturnValue(
        of({
          id: 42,
          project_id: 7,
          supplier_name: 'Acme Steel',
        }),
      ),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';

    const step = await new Promise<ProjectStep>((resolve) => {
      service.getEntryById(sampleDef, 42, 7).subscribe(resolve);
    });

    expect(mockHttp.get).toHaveBeenCalledWith('http://localhost:5000/api/v1/quotation-requests/42');
    expect(step.id).toBe(42);
    expect(step.data?.['supplier_name']).toBe('Acme Steel');
  });

  it('createEntry should send FormData with JSON payload to dedicated endpoint', async () => {
    const mockHttp = {
      get: vi.fn(),
      post: vi.fn().mockReturnValue(
        of({
          id: 55,
          project_id: 3,
          supplier_name: 'Tata Steel',
        }),
      ),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';

    const dummyFile = new File(['content'], 'rfq.pdf', { type: 'application/pdf' });
    const payload = {
      supplier_name: 'Tata Steel',
      request_date: '2026-10-18',
      table_items: [{ item_name: 'Pipe', qty: 10 }],
    };

    const created = await new Promise<ProjectStep>((resolve) => {
      service.createEntry(sampleDef, 3, payload, [dummyFile]).subscribe(resolve);
    });

    expect(mockHttp.post).toHaveBeenCalled();
    const [url, fd] = mockHttp.post.mock.calls[0];
    expect(url).toBe('http://localhost:5000/api/v1/quotation-requests');
    expect(fd instanceof FormData).toBe(true);
    const sentData = JSON.parse(fd.get('data') as string);
    expect(sentData.items).toEqual([
      expect.objectContaining({ item_name: 'Pipe', description: 'Pipe', material_name: 'Pipe', qty: 10, quantity: 10 }),
    ]);
    expect(sentData.table_items).toBeUndefined();
    expect(created.id).toBe(55);
    expect(created.form_code).toBe('FORM_09_RFQ');
  });

  it('deleteEntry should call DELETE directly on dedicated endpoint', async () => {
    const mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn().mockReturnValue(of(undefined)),
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';

    const result = await new Promise<boolean>((resolve) => {
      service.deleteEntry(sampleDef, 4, 99).subscribe(resolve);
    });

    expect(mockHttp.delete).toHaveBeenCalledWith('http://localhost:5000/api/v1/quotation-requests/99');
    expect(result).toBe(true);
  });

  it('normalizeBackendEntityToStep should compute total_net_amount and total_gross_amount for forms with GST', () => {
    const defWithGstTable: FormDefinition = {
      id: 26,
      formCode: 'FORM_26_TAX_INVOICE_CUSTOMER',
      name: 'Tax Invoice (Customer)',
      category: 'Customer & Supplier Settlement',
      phaseId: 'phase-3',
      icon: 'pi pi-file',
      description: 'Tax Invoice',
      fields: [{ key: 'gst_rate_pct', label: 'GST Rate %', type: 'number' }],
      tableConfig: {
        title: 'Tax Invoice Items',
        columns: [
          { key: 'quantity', label: 'Qty', type: 'number' },
          { key: 'unit_price', label: 'Price', type: 'currency' },
          { key: 'total_amount', label: 'Total', type: 'currency' },
        ],
        autoCalculateTotal: true,
        totalKey: 'total_amount',
      },
      uploads: [],
    };

    const rawEntity = {
      id: 120,
      project_id: 10,
      gst_rate_pct: 18,
      items: [
        { quantity: 2, unit_price: 1000, total_amount: 2000 },
        { quantity: 3, unit_price: 2000, total_amount: 6000 },
      ],
    };

    const step = normalizeBackendEntityToStep(rawEntity, defWithGstTable, 10);
    expect(step.data?.['total_net_amount']).toBe(8000);
    expect(step.data?.['gst_amount']).toBe(1440);
    expect(step.data?.['total_gross_amount']).toBe(9440);
  });

  it('createEntry should compute and attach total_net_amount and total_gross_amount in the payload', async () => {
    const mockHttp = {
      get: vi.fn(),
      post: vi.fn().mockReturnValue(of({ id: 105, total_net_amount: 5000, total_gross_amount: 5900 })),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    const defWithGstTable: FormDefinition = {
      id: 14,
      formCode: 'FORM_14_PURCHASE_ORDER',
      name: 'Purchase Order',
      category: 'Supplier Orders & Invoices',
      phaseId: 'phase-2',
      icon: 'pi pi-shopping-cart',
      description: 'PO',
      apiEndpoint: '/api/v1/purchase-orders',
      fields: [{ key: 'gst_rate_pct', label: 'GST %', type: 'number' }],
      tableConfig: {
        title: 'PO Line Items',
        columns: [{ key: 'total_amount', label: 'Total', type: 'currency' }],
        autoCalculateTotal: true,
        totalKey: 'total_amount',
      },
      uploads: [],
    };

    const service = Object.create(FormApiService.prototype);
    service.http = mockHttp;
    service.apiBaseUrl = 'http://localhost:5000';

    await new Promise((resolve) => {
      service
        .createEntry(
          defWithGstTable,
          4,
          {
            gst_rate_pct: 18,
            items: [{ description: 'Material A', total_amount: 5000 }],
          },
          [],
        )
        .subscribe(resolve);
    });

    const postCall = mockHttp.post.mock.calls[0];
    const fd = postCall[1] as FormData;
    const sentData = JSON.parse(fd.get('data') as string);
    expect(sentData.total_net_amount).toBe(5000);
    expect(sentData.gst_amount).toBe(900);
    expect(sentData.total_gross_amount).toBe(5900);
  });

  it('normalizeBackendEntityToStep should preserve total_net_amount and not calculate EUR table GST for FORM_10_COST_SHEET', () => {
    const costSheetDef: FormDefinition = {
      id: 10,
      formCode: 'FORM_10_COST_SHEET',
      name: 'Cost Sheet',
      category: 'Sourcing & Quotations',
      phaseId: 'phase-2',
      icon: 'pi pi-calculator',
      description: 'Cost Sheet',
      fields: [
        { key: 'project_title', label: 'Project Title', type: 'text' },
        { key: 'gst_pct', label: 'GST %', type: 'number' },
        { key: 'gst_amount', label: 'GST Amount', type: 'currency' },
      ],
      tableConfig: {
        title: 'Cost Sheet Line Items & Landed Cost Breakdown',
        autoCalculateTotal: true,
        quantityKey: 'quantity',
        unitPriceKey: 'price_per_unit_eur',
        totalKey: 'total_price_eur',
        columns: [
          { key: 'sr_no', label: 'Sr. No.', type: 'number' },
          { key: 'description', label: 'Item Description', type: 'text' },
          { key: 'item_code', label: 'Item Code', type: 'text' },
          { key: 'price_per_unit_eur', label: 'Price Per Unit [EUR]', type: 'currency' },
          { key: 'quantity', label: 'Quantity', type: 'number' },
        ],
      },
      uploads: [],
    };

    const rawEntity = {
      id: 10,
      project_id: 5,
      project_title: 'Turbine Project',
      gst_pct: 18,
      gst_amount: 45000,
      grand_total_incl_gst: 295000,
      items: [
        { sr_no: 1, description: 'Motor', item_code: 'M-1', price_per_unit_eur: 1000, quantity: 2, total_price_eur: 2000 },
        { sr_no: 2, description: 'Sensor', item_code: 'S-1', price_per_unit_eur: 500, quantity: 4, total_price_eur: 2000 },
      ],
    };

    const step = normalizeBackendEntityToStep(rawEntity, costSheetDef, 5);
    expect(step.data?.['total_net_amount']).toBe(4000);
    expect(step.data?.['total_amount_eur']).toBe(4000);
    // GST amount should remain the user/entity level GST (45000 INR), NOT overwritten with 4000 * 18%
    expect(step.data?.['gst_amount']).toBe(45000);
    // total_gross_amount should NOT be calculated as 4000 + (4000 * 18%)
    expect(step.data?.['total_gross_amount']).not.toBe(4720);
  });

  describe('getLatestTenderForCorrigendum', () => {
    it('should query /api/v1/corrigendums/latest-tender and return normalized ProjectStep', async () => {
      const mockRawTender = {
        id: 77,
        project_id: 12,
        form_code: 'FORM_31_BID_DOC_LTE',
        step_name: 'Limited Tender Enquiry (LTE)',
        tender_enquiry_no: 'LTE-2026-99',
        tender_title: 'Turbine Overhaul',
        closing_date: '2026-11-20',
        items: [
          { item_no: 1, item_description: 'Turbine Blade', quantity: 10, unit: 'Nos' },
        ],
      };

      const mockHttp = {
        get: vi.fn().mockReturnValue(of(mockRawTender)),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = Object.create(FormApiService.prototype);
      service.http = mockHttp;
      service.apiBaseUrl = 'http://localhost:5000';

      const step = await new Promise<ProjectStep | null>((resolve) => {
        service.getLatestTenderForCorrigendum(12).subscribe(resolve);
      });

      expect(mockHttp.get).toHaveBeenCalledWith('http://localhost:5000/api/v1/corrigendums/latest-tender?project_id=12');
      expect(step).not.toBeNull();
      expect(step?.id).toBe(77);
      expect(step?.project_id).toBe(12);
      expect(step?.form_code).toBe('FORM_31_BID_DOC_LTE');
      expect(step?.step_name).toBe('Limited Tender Enquiry (LTE)');
      expect(step?.data?.['tender_enquiry_no']).toBe('LTE-2026-99');
      expect(step?.data?.['items']).toHaveLength(1);
    });

    it('should catch 404 error and return null gracefully', async () => {
      const mockHttp = {
        get: vi.fn().mockReturnValue(throwError(() => ({ status: 404 }))),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      };

      const service = Object.create(FormApiService.prototype);
      service.http = mockHttp;
      service.apiBaseUrl = 'http://localhost:5000';

      const step = await new Promise<ProjectStep | null>((resolve) => {
        service.getLatestTenderForCorrigendum(99).subscribe(resolve);
      });

      expect(step).toBeNull();
    });
  });
});
