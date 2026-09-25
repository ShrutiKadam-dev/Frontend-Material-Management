import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { Step09OrderConfirmation } from './step-09-order-confirmation';
import { OrderConfirmationService } from '../../../../core/services/order-confirmation';

describe('Step09OrderConfirmation', () => {
  let component: Step09OrderConfirmation;
  let fixture: ComponentFixture<Step09OrderConfirmation>;
  let orderConfirmationService: OrderConfirmationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step09OrderConfirmation],
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

    fixture = TestBed.createComponent(Step09OrderConfirmation);
    component = fixture.componentInstance;
    orderConfirmationService = TestBed.inject(OrderConfirmationService);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should auto-fetch and patch Warranty Period and Delivery Period on openCreateDialog from latest supplier quotation', () => {
    const mockLatest = {
      warranty_period: '12 Months',
      delivery_period: '5 Weeks',
      shipping_terms: 'FOB',
      incoterms: 'FOB',
      payment_terms: '50% Advance',
      items: [
        {
          material_name: 'Test Valve',
          quantity: 10,
          unit_price: 250,
          hsn_code: '848180',
        },
      ],
    };

    vi.spyOn(orderConfirmationService, 'getLatestSupplierQuotation').mockReturnValue(of(mockLatest));

    (component as any).openCreateDialog();

    expect(orderConfirmationService.getLatestSupplierQuotation).toHaveBeenCalledWith(1);
    expect((component as any).headerForm.get('warranty_period')?.value).toBe('12 Months');
    expect((component as any).headerForm.get('delivery_period')?.value).toBe('5 Weeks');
    expect((component as any).headerForm.get('shipping_terms')?.value).toBe('FOB');
    expect((component as any).headerForm.get('payment_terms')?.value).toBe('50% Advance');
    expect((component as any).items().length).toBe(1);
    expect((component as any).items()[0].material_name).toBe('Test Valve');
  });

  it('should normalize lowercase warranty period to match standard options', () => {
    const mockLatest = {
      warranty_period: '6 months',
      delivery_period: '3 Weeks',
      items: [],
    };

    vi.spyOn(orderConfirmationService, 'getLatestSupplierQuotation').mockReturnValue(of(mockLatest));

    (component as any).openCreateDialog();

    expect((component as any).headerForm.get('warranty_period')?.value).toBe('6 Months');
    expect((component as any).headerForm.get('delivery_period')?.value).toBe('3 Weeks');
  });

  it('should dynamically register custom warranty period in options if not standard', () => {
    const mockLatest = {
      warranty_period: '24 Months',
      delivery_period: '8 Weeks',
      items: [],
    };

    vi.spyOn(orderConfirmationService, 'getLatestSupplierQuotation').mockReturnValue(of(mockLatest));

    (component as any).openCreateDialog();

    expect((component as any).headerForm.get('warranty_period')?.value).toBe('24 Months');
    expect((component as any).warrantyPeriodOptions.some((o: any) => o.value === '24 Months')).toBe(true);
  });

  it('should auto-patch currency EUR, incoterms EXW, payment terms, and items with net_amount from latest quotation', () => {
    const mockQuotation = {
      currency_unit: 'EUR',
      incoterms: 'EXW',
      payment_terms: '30 DAYS AFTER DELIVERY',
      items: [
        {
          hsn_code: '84419010',
          material_name: 'BP06-06-2367',
          net_amount: '11228.00',
          quantity: '1.000',
          unit_price: '11228.00',
        },
        {
          hsn_code: '84419010',
          material_name: 'BP08-07-2367 COUPLING ROTEX 42CF',
          net_amount: '264.00',
          quantity: '1.000',
          unit_price: '264.00',
        },
        {
          hsn_code: '84419010',
          material_name: 'BP11-02_1-2367 CARRIER ROLL 2',
          net_amount: '26518.00',
          quantity: '1.000',
          unit_price: '26518.00',
        },
      ],
    };

    vi.spyOn(orderConfirmationService, 'getLatestSupplierQuotation').mockReturnValue(of(mockQuotation));

    (component as any).openCreateDialog();

    expect((component as any).headerForm.get('currency_unit')?.value).toBe('EUR');
    expect((component as any).headerForm.get('shipping_terms')?.value).toBe('EXW');
    expect((component as any).headerForm.get('payment_terms')?.value).toBe('30 DAYS AFTER DELIVERY');
    expect((component as any).activeCurrencySymbol()).toBe('€');

    const items = (component as any).items();
    expect(items.length).toBe(3);
    expect(items[0].material_name).toBe('BP06-06-2367');
    expect(items[0].net_amount).toBe(11228);
    expect(items[1].material_name).toBe('BP08-07-2367 COUPLING ROTEX 42CF');
    expect(items[1].net_amount).toBe(264);
    expect(items[2].material_name).toBe('BP11-02_1-2367 CARRIER ROLL 2');
    expect(items[2].net_amount).toBe(26518);

    expect((component as any).dialogTotalNetValue()).toBe(38010);
  });

  it('should reactively update activeCurrencySymbol when currency_unit control value changes', () => {
    (component as any).openCreateDialog();

    (component as any).headerForm.get('currency_unit')?.setValue('USD');
    expect((component as any).activeCurrencySymbol()).toBe('$');

    (component as any).headerForm.get('currency_unit')?.setValue('GBP');
    expect((component as any).activeCurrencySymbol()).toBe('£');

    (component as any).headerForm.get('currency_unit')?.setValue('INR');
    expect((component as any).activeCurrencySymbol()).toBe('₹');

    (component as any).headerForm.get('currency_unit')?.setValue('EUR');
    expect((component as any).activeCurrencySymbol()).toBe('€');
  });

  it('should resolve currency symbol for saved orders using getOrderCurrencySymbol', () => {
    const eurOrder: any = {
      id: 10,
      currency_unit: 'EUR',
      items: [{ quantity: 1, unit_price: 100, net_amount: 100 }],
    };
    expect((component as any).getOrderCurrencySymbol(eurOrder)).toBe('€');

    const usdOrder: any = {
      id: 11,
      currency: 'USD',
      items: [{ quantity: 2, unit_price: 50, net_amount: 100 }],
    };
    expect((component as any).getOrderCurrencySymbol(usdOrder)).toBe('$');

    const explicitSymbolOrder: any = {
      id: 12,
      currency_symbol: '¥',
      items: [],
    };
    expect((component as any).getOrderCurrencySymbol(explicitSymbolOrder)).toBe('¥');

    const fallbackOrder: any = {
      id: 13,
      items: [],
    };
    expect((component as any).getOrderCurrencySymbol(fallbackOrder)).toBe('₹');
  });
});

