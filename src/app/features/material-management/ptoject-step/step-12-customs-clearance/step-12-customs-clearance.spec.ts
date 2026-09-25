import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Step12CustomsClearance } from './step-12-customs-clearance';
import { BillOfEntryService } from '../../../../core/services/bill-of-entry';

describe('Step12CustomsClearance', () => {
  let component: Step12CustomsClearance;
  let fixture: ComponentFixture<Step12CustomsClearance>;
  let billOfEntryService: BillOfEntryService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step12CustomsClearance],
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

    fixture = TestBed.createComponent(Step12CustomsClearance);
    component = fixture.componentInstance;
    billOfEntryService = TestBed.inject(BillOfEntryService);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should auto-fill duty and igst when opening create dialog', () => {
    vi.spyOn(billOfEntryService, 'getLatest').mockReturnValue(
      of({
        duty: 15400.5,
        igst: 28000.75,
        bill_of_entry_no: 'BOE-998811',
      })
    );

    component['openCreateDialog']();

    expect(component['clearanceForm'].value.duty_amount).toBe(15400.5);
    expect(component['clearanceForm'].value.igst_amount).toBe(28000.75);
    expect(component['clearanceForm'].value.bill_of_entry_no).toBe('BOE-998811');
    expect(component['liveTotalCustomsAmount']()).toBe(15400.5 + 28000.75);
  });

  it('should auto-patch bill_of_entry_no and date from latest bill of entry', () => {
    vi.spyOn(billOfEntryService, 'getLatest').mockReturnValue(
      of({
        bill_of_entry_no: 'BOE-2026-445566',
        date: '2026-09-25',
        total_duty: 12500,
        igst: 18000,
      })
    );

    component['openCreateDialog']();

    expect(component['clearanceForm'].value.bill_of_entry_no).toBe('BOE-2026-445566');
    const boeDateVal = component['clearanceForm'].value.boe_date;
    expect(boeDateVal).toBeInstanceOf(Date);
    expect((boeDateVal as Date).getFullYear()).toBe(2026);
    expect((boeDateVal as Date).getMonth()).toBe(8); // September is 8 (0-indexed)
    expect((boeDateVal as Date).getDate()).toBe(25);
    expect(component['clearanceForm'].value.duty_amount).toBe(12500);
    expect(component['clearanceForm'].value.igst_amount).toBe(18000);
  });

  it('should support alternate property names boe_date and bill_of_entry_number', () => {
    vi.spyOn(billOfEntryService, 'getLatest').mockReturnValue(
      of({
        bill_of_entry_number: 'BOE-ALT-778899',
        boe_date: '2026-10-15',
        bcd: 5000,
        igst_amount: 9000,
      })
    );

    component['openCreateDialog']();

    expect(component['clearanceForm'].value.bill_of_entry_no).toBe('BOE-ALT-778899');
    const boeDateVal = component['clearanceForm'].value.boe_date;
    expect(boeDateVal).toBeInstanceOf(Date);
    expect((boeDateVal as Date).getFullYear()).toBe(2026);
    expect((boeDateVal as Date).getMonth()).toBe(9); // October
    expect((boeDateVal as Date).getDate()).toBe(15);
    expect(component['clearanceForm'].value.duty_amount).toBe(5000);
    expect(component['clearanceForm'].value.igst_amount).toBe(9000);
  });
});
