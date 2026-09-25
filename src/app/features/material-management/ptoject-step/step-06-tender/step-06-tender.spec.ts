import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { CustomerTenderService } from '../../../../core/services/customer-tender';
import { Step06Tender } from './step-06-tender';

describe('Step06Tender', () => {
  let component: Step06Tender;
  let fixture: ComponentFixture<Step06Tender>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step06Tender],
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

    fixture = TestBed.createComponent(Step06Tender);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should format tender_date as local YYYY-MM-DD without UTC timezone offset on submit', () => {
    const tenderService = TestBed.inject(CustomerTenderService);
    let capturedPayload: any = null;
    vi.spyOn(tenderService, 'create').mockImplementation((payload: any) => {
      capturedPayload = payload;
      return of({ id: 101, ...payload } as any);
    });

    component['project'].set({ id: 1, name: 'Test Proj', customer_id: 2 } as any);
    component['openCreateDialog']();

    // Set form values with a specific local date: Sept 10, 2026
    const localDate = new Date(2026, 8, 10); // month is 0-indexed: 8 = Sept
    component['headerForm'].patchValue({
      tender_title: 'Substation Tender',
      tender_number: 'TND-2026-001',
      tender_date: localDate,
    });
    component['items'].set([
      { material_name: 'Transformer 100kVA', quantity: 2 },
    ]);

    component['submit']();

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.tender_date).toBe('2026-09-10');
    expect(capturedPayload.tender_date).not.toContain('T18:30:00');
  });

  it('should parse tender_date string into local Date on openEditDialog', () => {
    const mockTender: any = {
      id: 5,
      project_id: 1,
      customer_id: 2,
      tender_title: 'Existing Tender',
      tender_number: 'TND-2026-999',
      tender_date: '2026-09-10',
      validity: '90 Days',
      items: [],
    };

    component['openEditDialog'](mockTender);

    const formDate = component['headerForm'].get('tender_date')?.value;
    expect(formDate).toBeInstanceOf(Date);
    expect(formDate?.getFullYear()).toBe(2026);
    expect(formDate?.getMonth()).toBe(8);
    expect(formDate?.getDate()).toBe(10);
  });
});

