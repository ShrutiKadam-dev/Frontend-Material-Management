import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { Step15SupplierPayment } from './step-15-supplier-payment';
import { SupplierPaymentService } from '../../../../core/services/supplier-payment';
import { ProjectService } from '../../../../core/services/project';
import { SupplierService } from '../../../../core/services/supplier';
import { PurchaseOrderService } from '../../../../core/services/purchase-order';
import { SupplierInvoiceService } from '../../../../core/services/supplier-invoice';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';
import { SupplierPayment } from '../../../../core/models/supplier-payment.model';

describe('Step15SupplierPayment', () => {
  let component: Step15SupplierPayment;
  let fixture: ComponentFixture<Step15SupplierPayment>;

  const mockPayments: SupplierPayment[] = [
    {
      id: 1,
      project_id: 101,
      currency: 'USD',
      payment_percentage: 40,
      total_supplier_value: 50000,
      amount_paid: 20000,
      payment_date: '2026-09-09',
      transaction_details: 'SWIFT MT103 Ref #TXN998877',
      pending_amount: 30000,
      remark: 'Advance 40% remittance paid',
      attachments: [],
    },
  ];

  const mockProject = {
    id: 101,
    project_title: 'Cold Storage Expansion',
    customer_id: 1,
    supplier_id: 2,
    supplier_name: 'Alpha HVAC Systems',
    currency: 'USD',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };

  const mockSupplier = {
    id: 2,
    name: 'Alpha HVAC Systems',
    email: 'contact@alphahvac.com',
    phone: '+1 555-0199',
    address: 'Houston, TX',
  };

  const mockPos = [
    {
      id: 1,
      project_id: 101,
      po_no: 'PO-2026-001',
      po_number: 'PO-2026-001',
      po_title: 'PO for HVAC Unit',
      poc_name: 'John Doe',
      email: 'john@alphahvac.com',
      delivery_term: 'FOB',
      payment_terms: 'Net 30',
      warranty_period: '12 Months',
      delivery_date: '2026-09-30',
      gst_rate: 18,
      total_net_amount: 50000,
      total_amount: 50000,
      po_date: '2026-09-05',
      items: [],
      created_at: '2026-09-05T00:00:00Z',
      updated_at: '2026-09-05T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    const activatedRouteMock = {
      snapshot: {
        paramMap: {
          get: (key: string) => (key === 'projectId' ? '101' : null),
        },
      },
    };

    const supplierPaymentServiceMock = {
      getSupplierPayments: vi.fn().mockReturnValue(of(mockPayments)),
      createSupplierPayment: vi.fn().mockReturnValue(of(mockPayments[0])),
      updateSupplierPayment: vi.fn().mockReturnValue(of(mockPayments[0])),
      deleteSupplierPayment: vi.fn().mockReturnValue(of(undefined)),
    };

    const projectServiceMock = {
      getProjectById: vi.fn().mockReturnValue(of(mockProject)),
    };

    const supplierServiceMock = {
      getSupplierById: vi.fn().mockReturnValue(of(mockSupplier)),
    };

    const poServiceMock = {
      getByProject: vi.fn().mockReturnValue(of(mockPos)),
    };

    const supplierInvoiceServiceMock = {
      getByProject: vi.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [Step15SupplierPayment],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: SupplierPaymentService, useValue: supplierPaymentServiceMock },
        { provide: ProjectService, useValue: projectServiceMock },
        { provide: SupplierService, useValue: supplierServiceMock },
        { provide: PurchaseOrderService, useValue: poServiceMock },
        { provide: SupplierInvoiceService, useValue: supplierInvoiceServiceMock },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step15SupplierPayment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create and load data on init', () => {
    expect(component).toBeTruthy();
    expect(component['payments']().length).toBe(1);
    expect(component['totalCommitmentValue']()).toBe(50000);
    expect(component['totalDisbursed']()).toBe(20000);
    expect(component['totalPending']()).toBe(30000);
    expect(component['disbursementRate']()).toBe(40);
  });

  it('should open create dialog with all fields empty for user entry', () => {
    component['openCreatePaymentDialog']();
    expect(component['paymentDialogVisible']()).toBe(true);
    expect(component['paymentForm'].get('currency')?.value).toBe('USD');
    expect(component['paymentForm'].get('total_supplier_value')?.value).toBeNull();
    expect(component['paymentForm'].get('payment_percentage')?.value).toBeNull();
    expect(component['paymentForm'].get('amount_paid')?.value).toBeNull();
    expect(component['paymentForm'].get('payment_date')?.value).toBeNull();
    expect(component['paymentForm'].get('transaction_details')?.value).toBe('');
    expect(component['paymentForm'].get('pending_amount')?.value).toBeNull();
    expect(component['paymentForm'].get('remark')?.value).toBe('');
  });

  it('should dynamically calculate amount_paid and pending_amount when percentage is changed on entered total value', () => {
    component['openCreatePaymentDialog']();
    component['paymentForm'].patchValue({ total_supplier_value: 50000 });
    component['onPercentageChange'](50);
    expect(component['paymentForm'].get('amount_paid')?.value).toBe(25000);
    expect(component['paymentForm'].get('pending_amount')?.value).toBe(25000);
  });
});
