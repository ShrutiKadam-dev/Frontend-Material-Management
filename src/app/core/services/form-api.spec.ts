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
    expect(step.progress_percentage).toBe(50);
    expect(step.data).toBeDefined();
    expect(step.data?.['table_items']).toEqual([{ description: 'High-tensile Bolt', quantity: 100 }]);
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
    expect(step.data['supplier_name']).toBe('Acme Steel');
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
    const payload = { supplier_name: 'Tata Steel', request_date: '2026-10-18' };

    const created = await new Promise<ProjectStep>((resolve) => {
      service.createEntry(sampleDef, 3, payload, [dummyFile]).subscribe(resolve);
    });

    expect(mockHttp.post).toHaveBeenCalled();
    const [url, fd] = mockHttp.post.mock.calls[0];
    expect(url).toBe('http://localhost:5000/api/v1/quotation-requests');
    expect(fd instanceof FormData).toBe(true);
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
});
