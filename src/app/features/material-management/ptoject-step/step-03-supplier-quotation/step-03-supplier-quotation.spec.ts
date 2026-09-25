import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { Step03SupplierQuotation } from './step-03-supplier-quotation';
import { CustomerQueryService } from '../../../../core/services/customer-query';

describe('Step03SupplierQuotation', () => {
  let component: Step03SupplierQuotation;
  let fixture: ComponentFixture<Step03SupplierQuotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step03SupplierQuotation],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step03SupplierQuotation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should auto-fetch material items from latest customer query on openDialog', () => {
    const customerQueryService = TestBed.inject(CustomerQueryService);
    vi.spyOn(customerQueryService, 'getLatest').mockReturnValue(
      of({
        id: 1,
        project_id: 3,
        customer_id: 1,
        qo_date: '2026-09-09',
        remark: '',
        attachments: [],
        items: [
          { material_name: 'MOTOR CONTROL CARD', quantity: 4 },
          { material_name: 'RACK EUROPE 14 SLOTS', quantity: 2 },
        ],
      } as any)
    );

    (component as any).openDialog();

    expect(customerQueryService.getLatest).toHaveBeenCalled();
    expect((component as any).items()).toEqual([
      { material_name: 'MOTOR CONTROL CARD', quantity: 4, hsn_code: '' },
      { material_name: 'RACK EUROPE 14 SLOTS', quantity: 2, hsn_code: '' },
    ]);
  });

  it('should default validity_unit to Days in headerForm and on openDialog', () => {
    expect((component as any).headerForm.get('validity_unit')?.value).toBe('Days');

    (component as any).headerForm.patchValue({ validity_unit: 'Weeks' });
    expect((component as any).headerForm.get('validity_unit')?.value).toBe('Weeks');

    (component as any).openDialog();
    expect((component as any).headerForm.get('validity_unit')?.value).toBe('Days');
  });

  it('should include warranty_period in formConfig and require it in headerForm', () => {
    const warrantyField = (component as any).formConfig.find((f: any) => f.key === 'warranty_period');
    expect(warrantyField).toBeTruthy();
    expect(warrantyField.type).toBe('select');
    expect(warrantyField.required).toBe(true);
    expect(warrantyField.options.length).toBeGreaterThan(0);

    const control = (component as any).headerForm.get('warranty_period');
    expect(control).toBeTruthy();
    expect(control?.valid).toBe(false);

    control?.setValue('12 Months');
    expect(control?.valid).toBe(true);
  });

  it('should populate warranty_period on openEditDialog', () => {
    const mockQuotation = {
      id: 10,
      project_id: 3,
      supplier_id: 2,
      quotation_number: 'SQ-2026-999',
      quotation_date: '2026-09-25',
      quotation_value: '25000.00',
      currency_unit: 'USD',
      currency_symbol: '$',
      validity: '30 Days',
      incoterms: 'FOB',
      payment_terms: '100% against delivery',
      delivery_period: '4 Weeks',
      warranty_period: '12 Months',
      remarks: [],
      attachments: [],
      items: [],
    };

    (component as any).openEditDialog(mockQuotation);
    expect((component as any).headerForm.get('warranty_period')?.value).toBe('12 Months');
  });
});
