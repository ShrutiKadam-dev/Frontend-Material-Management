import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Step13CustomerDelivery } from './step-13-customer-delivery';
import { CustomerDeliveryService } from '../../../../core/services/customer-delivery';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { AttachmentService } from '../../../../core/services/attachment';

describe('Step13CustomerDelivery', () => {
  let component: Step13CustomerDelivery;
  let fixture: ComponentFixture<Step13CustomerDelivery>;

  const mockDeliveryService = {
    getTaxInvoices: () => of([]),
    getPackingLists: () => of([]),
    getDeliveryChallans: () => of([]),
    getWarrantyCertificates: () => of([]),
    getTransportDetails: () => of([]),
    getLatestPurchaseOrder: () => of({
      po_number: 'PO-2026-999',
      po_date: '2026-09-10',
      warranty_period: '12 Months',
      items: [],
    }),
    getLatestCustomerTaxInvoice: () => of({
      invoice_no: 'INV-2026-888',
      invoice_date: '2026-09-10',
      net_total: 50000,
    }),
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
      imports: [Step13CustomerDelivery],
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
        { provide: CustomerDeliveryService, useValue: mockDeliveryService },
        { provide: ProjectService, useValue: mockProjectService },
        { provide: CustomerService, useValue: mockCustomerService },
        { provide: AttachmentService, useValue: mockAttachmentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step13CustomerDelivery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate Delivery Challan subtotal, GST amount, and net total correctly', () => {
    (component as any).openCreateChallanDialog();
    (component as any).challanItemsList.set([
      { material_name: 'Motor Card', hsn_code: '8418', quantity: 2, unit_price: 1000, net_amount: 2000 },
      { material_name: 'Rack Slots', hsn_code: '8418', quantity: 1, unit_price: 500, net_amount: 500 },
    ]);
    (component as any).challanForm.patchValue({ gst_rate: 18 });
    (component as any).recalculateChallanTotals();

    expect((component as any).challanSubtotal()).toBe(2500);
    expect((component as any).challanForm.get('gst_amount')?.value).toBe(450); // 18% of 2500
    expect((component as any).challanForm.get('round_off')?.value).toBe(0);
    expect((component as any).challanForm.get('net_total')?.value).toBe(2950);
  });

  it('should handle round off for fractional GST totals in Delivery Challan', () => {
    (component as any).openCreateChallanDialog();
    (component as any).challanItemsList.set([
      { material_name: 'Sensor', hsn_code: '9031', quantity: 1, unit_price: 100.25, net_amount: 100.25 },
    ]);
    (component as any).challanForm.patchValue({ gst_rate: 18 });
    (component as any).recalculateChallanTotals();

    const subtotal = 100.25;
    const gst = 18.045; // 18.05
    const exact = 118.295;
    const rounded = Math.round(exact); // 118
    const expectedRoundOff = parseFloat((rounded - exact).toFixed(2)); // -0.30

    expect((component as any).challanSubtotal()).toBe(100.25);
    expect((component as any).challanForm.get('gst_amount')?.value).toBe(18.05);
    expect((component as any).challanForm.get('round_off')?.value).toBe(expectedRoundOff);
    expect((component as any).challanForm.get('net_total')?.value).toBe(rounded);
  });

  it('should auto-populate PO and Tax Invoice references when opening Create Warranty Certificate dialog', () => {
    (component as any).openCreateWarrantyDialog();

    expect((component as any).warrantyForm.get('po_no')?.value).toBe('PO-2026-999');
    expect((component as any).warrantyForm.get('invoice_no')?.value).toBe('INV-2026-888');
    expect((component as any).warrantyForm.get('warranty_period')?.value).toBe('12 Months');
    expect((component as any).warrantyForm.get('po_date')?.value).toBeInstanceOf(Date);
    expect((component as any).warrantyForm.get('invoice_date')?.value).toBeInstanceOf(Date);
  });
});
