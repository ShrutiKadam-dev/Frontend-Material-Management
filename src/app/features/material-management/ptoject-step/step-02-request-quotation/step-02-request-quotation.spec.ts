import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { Step02RequestQuotation } from './step-02-request-quotation';
import { CustomerQueryService } from '../../../../core/services/customer-query';

describe('Step02RequestQuotation', () => {
  let component: Step02RequestQuotation;
  let fixture: ComponentFixture<Step02RequestQuotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step02RequestQuotation],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step02RequestQuotation);
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
      { material_name: 'MOTOR CONTROL CARD', quantity: '4' },
      { material_name: 'RACK EUROPE 14 SLOTS', quantity: '2' },
    ]);
  });

  it('should parse request remarks correctly', () => {
    const sampleRequest = {
      id: 1,
      project_id: 1,
      supplier_id: 2,
      quotation_requested_date: '2026-09-24',
      supplier_contacted: true,
      remarks: [{ remark: 'Need urgent quotation' }],
      attachments: [],
      items: [],
    } as any;

    const remarks = (component as any).getRequestRemarks(sampleRequest);
    expect(remarks.length).toBe(1);
    expect(remarks[0].text).toBe('Need urgent quotation');
  });

  it('should add and remove remarks in dialog', () => {
    (component as any).newRemarkInput.set('Technical requirement note');
    (component as any).addDialogRemark();

    expect((component as any).dialogRemarks().length).toBe(1);
    expect((component as any).dialogRemarks()[0].text).toBe('Technical requirement note');
    expect((component as any).newRemarkInput()).toBe('');

    (component as any).removeDialogRemark(0);
    expect((component as any).dialogRemarks().length).toBe(0);
  });
});

