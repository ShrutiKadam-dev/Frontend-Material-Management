import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { Step15SupplierPayment } from './step-15-supplier-payment';
import { SupplierPaymentService } from '../../../../core/services/supplier-payment';
import { ProjectService } from '../../../../core/services/project';
import { SupplierService } from '../../../../core/services/supplier';
import { API_BASE_URL } from '../../../../core/tokens/api-base-url.token';
import { SupplierPayment } from '../../../../core/models/supplier-payment.model';
import { MessageService } from 'primeng/api';

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

    await TestBed.configureTestingModule({
      imports: [Step15SupplierPayment],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: SupplierPaymentService, useValue: supplierPaymentServiceMock },
        { provide: ProjectService, useValue: projectServiceMock },
        { provide: SupplierService, useValue: supplierServiceMock },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        MessageService,
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

  it('should calculate total_with_exchange and total_with_bank_charges dynamically', () => {
    component['openCreatePaymentDialog']();
    component['paymentForm'].patchValue({
      amount_paid: 10000,
      exchange_rate: 86.5,
      bank_charges_currency: 'INR',
      bank_charges: 1250,
    });
    component['recalculateForexAndBankCharges']();
    expect(component['paymentForm'].get('total_with_exchange')?.value).toBe(865000);
    expect(component['paymentForm'].get('total_with_bank_charges')?.value).toBe(866250);
  });

  it('should extract clean transaction details and metadata from payment record', () => {
    const paymentWithMeta: SupplierPayment = {
      id: 2,
      project_id: 101,
      currency: 'USD',
      amount_paid: 5000,
      payment_date: '2026-09-10',
      transaction_details: 'UTR #AXIS98765432 <!--fx-meta:{"exchange_rate":85,"bank_charges":500,"bank_charges_currency":"INR","total_with_exchange":425000,"total_with_bank_charges":425500}-->',
    };
    expect(component['getCleanTransactionDetails'](paymentWithMeta)).toBe('UTR #AXIS98765432');
    expect(component['getPaymentExchangeRate'](paymentWithMeta)).toBe(85);
    expect(component['getPaymentBankCharges'](paymentWithMeta)).toEqual({ currency: 'INR', amount: 500 });
    expect(component['getPaymentTotalWithExchange'](paymentWithMeta)).toBe(425000);
    expect(component['getPaymentTotalWithBankCharges'](paymentWithMeta)).toBe(425500);
  });
});
