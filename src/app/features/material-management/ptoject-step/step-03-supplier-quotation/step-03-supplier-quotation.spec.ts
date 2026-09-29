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

  it('should auto-fill quotation details and material items from parsed Excel data', () => {
    const mockFile = new File(['dummy content'], 'Supplier_Quotation_RE0000977.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const parsedExcelData = {
      currency_symbol: '€',
      currency_unit: 'EUR',
      delivery_period: '15 weeks',
      incoterms: 'EXW',
      payment_terms: '30 days after delivery',
      quotation_date: '2024-08-20',
      quotation_number: 'RE0000977',
      quotation_value: '25117',
      remark: 'Standard warranty included',
      total_net_amount: 25117,
      validity: '19.10.2024',
      items: [
        {
          hsn_code: '',
          material_name: 'VASCAT MOTOR MDD SN 180 L',
          material_number: 'D02-104-2368',
          net_amount: 9740,
          quantity: 1,
          unit_price: 9470,
        },
        {
          hsn_code: '841899',
          material_name: 'CLUTCH BRAKE 502-23 WD',
          material_number: '8080700244',
          net_amount: 2609,
          quantity: 1,
          unit_price: 2609,
        },
      ],
    };

    (component as any).populateFromParsedExcel(parsedExcelData, mockFile);

    expect((component as any).dialogVisible()).toBe(true);
    expect((component as any).excelAutoFilled()).toBe(true);
    expect((component as any).excelFileName()).toBe('Supplier_Quotation_RE0000977.xlsx');

    const form = (component as any).headerForm;
    expect(form.get('quotation_number')?.value).toBe('RE0000977');
    expect(form.get('currency_unit')?.value).toBe('EUR');
    expect(form.get('quotation_value')?.value).toBe('25117');
    expect(form.get('incoterms')?.value).toBe('EXW');
    expect(form.get('payment_terms')?.value).toBe('30 days after delivery');
    expect(form.get('delivery_period')?.value).toBe('15 weeks');
    expect(form.get('validity_unit')?.value).toBe('Days');
    expect(Number(form.get('validity_value')?.value)).toBe(60);

    const items = (component as any).items();
    expect(items.length).toBe(2);
    expect(items[0].material_name).toBe('VASCAT MOTOR MDD SN 180 L');
    expect(items[0].material_number).toBe('D02-104-2368');
    expect(items[0].net_amount).toBe(9740);

    // Verify file is attached
    const attachments = (component as any).attachments();
    expect(attachments.length).toBe(1);
    expect(attachments[0].name).toBe('Supplier_Quotation_RE0000977.xlsx');
  });

  it('should format date strings properly on card display using formatDateDisplay', () => {
    // DD-MM-YYYY format from backend
    expect((component as any).formatDateDisplay('16-05-2025')).toBe('16-05-2025');
    // Slash separator
    expect((component as any).formatDateDisplay('16/05/2025')).toBe('16-05-2025');
    // Dot separator
    expect((component as any).formatDateDisplay('16.05.2025')).toBe('16-05-2025');
    // Single digit day/month
    expect((component as any).formatDateDisplay('5-5-2025')).toBe('05-05-2025');
    // YYYY-MM-DD ISO format
    expect((component as any).formatDateDisplay('2025-05-16')).toBe('16-05-2025');
    // Date object
    expect((component as any).formatDateDisplay(new Date(2025, 4, 16))).toBe('16-05-2025');
    // Null/undefined
    expect((component as any).formatDateDisplay(null)).toBe('—');
  });

  it('should properly patch 16-05-2025 format date into headerForm on openEditDialog', () => {
    const mockQuotation = {
      id: 11,
      project_id: 3,
      supplier_id: 2,
      quotation_number: 'SQ-2025-001',
      quotation_date: '16-05-2025',
      quotation_value: '18000.00',
      currency_unit: 'EUR',
      currency_symbol: '€',
      validity: '45 Days',
      incoterms: 'EXW',
      payment_terms: '30 Days Net',
      delivery_period: '6 Weeks',
      warranty_period: '12 Months',
      remarks: [],
      attachments: [],
      items: [],
    };

    (component as any).openEditDialog(mockQuotation);

    const patchedDate = (component as any).headerForm.get('quotation_date')?.value;
    expect(patchedDate).toBeInstanceOf(Date);
    expect(patchedDate.getFullYear()).toBe(2025);
    expect(patchedDate.getMonth()).toBe(4); // May (0-indexed)
    expect(patchedDate.getDate()).toBe(16);
  });
});
