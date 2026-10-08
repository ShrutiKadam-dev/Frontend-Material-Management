import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';

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
        MessageService,
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

  it('should detect when entered payment amount exceeds remaining balance and block submission', () => {
    component['openCreatePaymentDialog']();
    // Available remaining balance is 3000 (from mockPayments: 50000 - 45000 paid - 2000 deductions = 3000)
    expect(component['dialogAvailableBalance']()).toBe(3000);

    // Enter valid amount within balance
    component['paymentForm'].patchValue({ payment_amount: 2500 });
    component['onPaymentAmountInput']('2500');
    expect(component['isAmountExceeding']()).toBe(false);

    // Enter amount exceeding remaining balance
    component['paymentForm'].patchValue({ payment_amount: 5000 });
    component['onPaymentAmountInput']('5000');
    expect(component['isAmountExceeding']()).toBe(true);

    // Attempting submit should block
    const createSpy = vi.spyOn(mockPaymentService, 'createCustomerPayment');
    component['onSubmitPayment']();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should calculate live Remaining Balance following Invoice Value - Paid - TDS - LD logic', () => {
    component['openCreatePaymentDialog']();
    // Available remaining balance before this payment is 3000
    expect(component['dialogAvailableBalance']()).toBe(3000);

    // Enter Paid: 2000, TDS: 500, LD: 300 -> Remaining Balance should be 3000 - 2000 - 500 - 300 = 200
    component['paymentForm'].patchValue({
      payment_amount: 2000,
      tds: 500,
      ld: 300,
    });
    component['onPaymentAmountInput']('2000');
    component['onTdsInput']('500');
    component['onLdInput']('300');

    expect(component['getDialogLiveBalance']()).toBe(200);
    expect(component['isAmountExceeding']()).toBe(false);

    // If total payment + deductions exceed remaining balance (e.g. Paid: 2500 + TDS: 400 + LD: 300 = 3200 > 3000)
    component['paymentForm'].patchValue({
      payment_amount: 2500,
      tds: 400,
      ld: 300,
    });
    component['onPaymentAmountInput']('2500');
    component['onTdsInput']('400');
    component['onLdInput']('300');

    expect(component['getDialogLiveBalance']()).toBe(-200);
    expect(component['isAmountExceeding']()).toBe(true);
  });

  it('should compute settlement card balance as Invoice Value - Paid - TDS - LD', () => {
    const payment = {
      id: 2,
      project_id: 1,
      invoice_no: 'INV-2026-002',
      invoice_date: '2026-09-10',
      invoice_value: 10000,
      payment_amount: 7000,
      payment_date: '2026-09-11',
      tds: 1000,
      ld: 500,
    } as CustomerPayment;

    // 10000 - 7000 - 1000 - 500 = 1500
    expect(component['calculateSettlementBalance'](payment)).toBe(1500);

    // Completed payment should return 0
    const completedPayment = {
      ...payment,
      is_payment_completed: true,
    } as CustomerPayment;
    expect(component['calculateSettlementBalance'](completedPayment)).toBe(0);
  });

  it('should accurately process milestone payment with remaining_amount_before_transaction', () => {
    const payment = {
      id: 6,
      project_id: 10,
      customer_id: 2,
      invoice_no: '5654656',
      invoice_date: '10-09-2026',
      invoice_value: '100.00',
      payment_amount: '10.00',
      amount_paid: '10.00',
      payment_date: '30-09-2026',
      tds: '0.00',
      ld: '0.00',
      liquidated_damages: '0.00',
      payment_percentage: '10.00',
      cumulative_payment_percentage: '70.00',
      pending_amount: '30.00',
      pending_percentage: '30.00',
      remaining_amount_before_transaction: '40.00',
      total_paid_amount: '70.00',
      payment_status: 'partial',
      payment_status_message: '70.00% paid, 30.00% pending',
      is_payment_completed: false,
    } as unknown as CustomerPayment;

    // Remaining before transaction: 40.00
    expect(component['getRemainingBeforeTransaction'](payment)).toBe(40);

    // Prior settled before this transaction: 100 - 40 = 60.00
    expect(component['getPreviouslySettledBeforeTransaction'](payment)).toBe(60);

    // Settlement balance left after this transaction: 30.00
    expect(component['calculateSettlementBalance'](payment)).toBe(30);

    // Cumulative paid so far: 70.00
    expect(component['getCumulativePaidAmount'](payment)).toBe(70);

    // Cumulative percentage: 70%
    expect(component['getCumulativePercentage'](payment)).toBe(70);

    // Current receipt payment percentage: 10%
    expect(component['getPaymentPercentage'](payment)).toBe(10);

    // Remaining percentage: 30%
    expect(component['getRemainingPercentage'](payment)).toBe(30);
  });

  it('should autofill full remaining balance with fillRemainingPayment', () => {
    component['openCreatePaymentDialog']();
    // dialogMaxPayable is 3000
    expect(component['dialogMaxPayable']()).toBe(3000);

    component['fillRemainingPayment']();
    expect(component['paymentForm'].get('payment_amount')?.value).toBe(3000);
    expect(component['currentPaymentAmount']()).toBe(3000);
    expect(component['isAmountExceeding']()).toBe(false);
  });
});
