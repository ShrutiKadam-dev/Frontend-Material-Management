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
      { material_name: 'MOTOR CONTROL CARD', quantity: 4 },
      { material_name: 'RACK EUROPE 14 SLOTS', quantity: 2 },
    ]);
  });
});
