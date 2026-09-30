import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { Step10SupplierInvoice } from './step-10-supplier-invoice';
import { ProformaInvoiceService } from '../../../../core/services/proforma-invoice';
import { OrderConfirmationService } from '../../../../core/services/order-confirmation';
import { LatestProformaInvoice } from '../../../../core/models/proforma-invoice.model';
import { LatestOrderConfirmation } from '../../../../core/models/order-confirmation.model';

describe('Step10SupplierInvoice', () => {
  let component: Step10SupplierInvoice;
  let fixture: ComponentFixture<Step10SupplierInvoice>;
  let proformaService: ProformaInvoiceService;
  let orderConfirmationService: OrderConfirmationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step10SupplierInvoice],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideNoopAnimations(),
        MessageService,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => '1' } },
            paramMap: of({ get: () => '1' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step10SupplierInvoice);
    component = fixture.componentInstance;
    proformaService = TestBed.inject(ProformaInvoiceService);
    orderConfirmationService = TestBed.inject(OrderConfirmationService);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should patch commercial invoice form and items from latest proforma invoice when proforma data is available', () => {
    const mockProforma: LatestProformaInvoice = {
      delivery_period: '8-10 Weeks',
      delivery_terms: 'CIF Nhava Sheva',
      payment_terms: '100% LC at sight',
      warranty_period: '18 Months',
      total_amount: 5000,
      items: [
        {
          material_name: 'Industrial Filter Mesh',
          description: 'Industrial Filter Mesh 316L',
          hsn_code: '842199',
          quantity: 2,
          unit_price: 2500,
          net_amount: 5000,
        },
      ],
    };

    const mockOrder: LatestOrderConfirmation = {
      delivery_period: '4 Weeks',
      delivery_terms: 'EXW Works',
      payment_terms: '30% Advance',
      warranty_period: '12 Months',
      items: [
        {
          material_name: 'Fallback Mesh',
          quantity: 1,
          unit_price: 1000,
        },
      ],
    };

    vi.spyOn(proformaService, 'getLatest').mockReturnValue(of(mockProforma));
    vi.spyOn(orderConfirmationService, 'getLatestOrderConfirmation').mockReturnValue(of(mockOrder));

    (component as any).openCreateInvoiceDialog();

    expect((component as any).invoiceForm.get('delivery_period')?.value).toBe('8-10 Weeks');
    expect((component as any).invoiceForm.get('delivery_terms')?.value).toBe('CIF Nhava Sheva');
    expect((component as any).invoiceForm.get('payment_terms')?.value).toBe('100% LC at sight');
    expect((component as any).invoiceForm.get('warranty_period')?.value).toBe('18 Months');
    expect((component as any).invoiceItems().length).toBe(1);
    expect((component as any).invoiceItems()[0].material_name).toBe('Industrial Filter Mesh');
    expect((component as any).invoiceItems()[0].unit_price).toBe(2500);
    expect((component as any).invoiceItems()[0].net_amount).toBe(5000);
    expect((component as any).invoiceDataSource()).toBe('proforma');
  });

  it('should fallback to latest order confirmation when latest proforma invoice is null or has no data', () => {
    const mockOrder: LatestOrderConfirmation = {
      delivery_period: '6 Weeks',
      delivery_terms: 'DDP Site',
      payment_terms: 'Net 30 Days',
      warranty_period: '24 Months',
      items: [
        {
          material_name: 'Raw Paper Reel',
          description: 'High Tensile Paper Reel',
          hsn_code: '4802',
          quantity: 5,
          unit_price: 400,
          net_amount: 2000,
        },
      ],
    };

    vi.spyOn(proformaService, 'getLatest').mockReturnValue(of(null));
    vi.spyOn(orderConfirmationService, 'getLatestOrderConfirmation').mockReturnValue(of(mockOrder));

    (component as any).openCreateInvoiceDialog();

    expect((component as any).invoiceForm.get('delivery_period')?.value).toBe('6 Weeks');
    expect((component as any).invoiceForm.get('delivery_terms')?.value).toBe('DDP Site');
    expect((component as any).invoiceForm.get('payment_terms')?.value).toBe('Net 30 Days');
    expect((component as any).invoiceForm.get('warranty_period')?.value).toBe('24 Months');
    expect((component as any).invoiceItems().length).toBe(1);
    expect((component as any).invoiceItems()[0].material_name).toBe('Raw Paper Reel');
    expect((component as any).invoiceItems()[0].quantity).toBe(5);
    expect((component as any).invoiceItems()[0].unit_price).toBe(400);
    expect((component as any).invoiceDataSource()).toBe('order');
  });

  it('should call both proformaService.getLatest and orderConfirmationService.getLatestOrderConfirmation on openCreateInvoiceDialog', () => {
    const proformaSpy = vi.spyOn(proformaService, 'getLatest').mockReturnValue(of(null));
    const orderSpy = vi.spyOn(orderConfirmationService, 'getLatestOrderConfirmation').mockReturnValue(of(null));

    (component as any).openCreateInvoiceDialog();

    expect(proformaSpy).toHaveBeenCalledWith(1);
    expect(orderSpy).toHaveBeenCalledWith(1);
  });

  it('should store proforma error message and fallback to order confirmation when proforma is not found', () => {
    const mockProformaNotFound: LatestProformaInvoice = {
      is_not_found: true,
      error_message: 'No proforma invoice found for project ID 10.',
      error_code: 'PROFORMA_INVOICE_NOT_FOUND',
      items: [],
    };

    const mockOrder: LatestOrderConfirmation = {
      delivery_period: '2 Weeks',
      delivery_terms: 'FOB Port',
      payment_terms: 'Advance',
      warranty_period: '12 Months',
      items: [
        {
          material_name: 'Steel Sheet',
          quantity: 10,
          unit_price: 150,
          net_amount: 1500,
        },
      ],
    };

    vi.spyOn(proformaService, 'getLatest').mockReturnValue(of(mockProformaNotFound));
    vi.spyOn(orderConfirmationService, 'getLatestOrderConfirmation').mockReturnValue(of(mockOrder));

    (component as any).openCreateInvoiceDialog();

    expect((component as any).proformaNotFoundMessage()).toBe('No proforma invoice found for project ID 10.');
    expect((component as any).invoiceDataSource()).toBe('order');
    expect((component as any).invoiceForm.get('delivery_terms')?.value).toBe('FOB Port');
    expect((component as any).invoiceItems().length).toBe(1);
    expect((component as any).invoiceItems()[0].material_name).toBe('Steel Sheet');
  });
});

