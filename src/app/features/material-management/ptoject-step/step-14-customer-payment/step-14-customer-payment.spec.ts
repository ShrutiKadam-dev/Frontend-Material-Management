import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Step14CustomerPayment } from './step-14-customer-payment';
import { CustomerPaymentService } from '../../../../core/services/customer-payment';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  CustomerPayment,
  CustomerTaxInvoiceLatest,
} from '../../../../core/models/customer-payment.model';

describe('Step14CustomerPayment', () => {
  let component: Step14CustomerPayment;
  let fixture: ComponentFixture<Step14CustomerPayment>;

  const mockLatestInvoice: CustomerTaxInvoiceLatest = {
    invoice_no: 'INV-2026-001',
    invoice_date: '2026-09-09',
    net_total: 50000,
  };

  const mockPayments: CustomerPayment[] = [
    {
      id: 1,
      project_id: 1,
      invoice_no: 'INV-2026-001',
      invoice_date: '2026-09-09',
      invoice_value: 50000,
      payment_amount: 45000,
      payment_date: '2026-09-10',
      ld: 1000,
      tds: 1000,
      balance_amount: 3000,
      remark: 'Part payment via RTGS',
    },
  ];

  const mockPaymentService = {
    getLatestCustomerTaxInvoice: () => of(mockLatestInvoice),
    getCustomerPayments: () => of(mockPayments),
    createCustomerPayment: () => of(mockPayments[0]),
    updateCustomerPayment: () => of(mockPayments[0]),
    deleteCustomerPayment: () => of(undefined),
  };

  const mockProjectService = {
    getProjectById: () => of({ id: 1, name: 'Test Project', customer_id: 1 }),
  };

  const mockCustomerService = {
    getCustomerById: () => of({ id: 1, name: 'Test Customer' }),
  };

  const mockAttachmentService = {
    downloadAttachment: () => of(new Blob()),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step14CustomerPayment],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => '1' } },
            paramMap: of({ get: () => '1' }),
          },
        },
        { provide: CustomerPaymentService, useValue: mockPaymentService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: CustomerService, useValue: mockCustomerService },
        { provide: AttachmentService, useValue: mockAttachmentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step14CustomerPayment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create and load data on init', () => {
    expect(component).toBeTruthy();
    expect(component['payments']().length).toBe(1);
    expect(component['latestTaxInvoice']()?.invoice_no).toBe('INV-2026-001');
    expect(component['totalInvoiced']()).toBe(50000);
    expect(component['totalPaymentReceived']()).toBe(45000);
    expect(component['totalDeductions']()).toBe(2000);
    expect(component['totalOutstandingBalance']()).toBe(3000);
  });

  it('should auto-patch latest customer tax invoice into payment form on openCreatePaymentDialog and leave payment amount and date empty for user entry', () => {
    component['openCreatePaymentDialog']();
    expect(component['paymentDialogVisible']()).toBe(true);
    expect(component['paymentForm'].get('invoice_no')?.value).toBe('INV-2026-001');
    expect(component['paymentForm'].get('invoice_date')?.value).toBe('2026-09-09');
    expect(component['paymentForm'].get('invoice_value')?.value).toBe(50000);
    expect(component['paymentForm'].get('payment_amount')?.value).toBeNull();
    expect(component['paymentForm'].get('payment_date')?.value).toBeNull();
  });
});
