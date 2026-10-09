import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { Step04CostSheet } from './step-04-cost-sheet';

describe('Step04CostSheet', () => {
  let component: Step04CostSheet;
  let fixture: ComponentFixture<Step04CostSheet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step04CostSheet],
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

    fixture = TestBed.createComponent(Step04CostSheet);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should patch duty into itemForm when editing an item with default customs duty fallback', () => {
    component['globalParamsForm'].patchValue({
      defaultCustomsDutyRate: 12,
    });

    component['items'].set([
      {
        quotationNumber: 'RE0002161',
        quotationIndex: '1',
        itemDescription: 'AB03-03-2367 UNWINDER SHAFT',
        itemCode: 'MAT-1',
        pricePerUnitEur: 2360,
        quantity: 1,
        customsDutyRate: undefined,
      },
    ]);

    component['editItem'](0);

    expect(component['itemForm'].get('customsDutyRate')?.value).toBe(12);
    expect(component['itemForm'].get('itemDescription')?.value).toBe('AB03-03-2367 UNWINDER SHAFT');
    expect(component['itemForm'].get('pricePerUnitEur')?.value).toBe(2360);
  });

  it('should preserve explicit custom duty rate when editing an item that has overridden duty', () => {
    component['globalParamsForm'].patchValue({
      defaultCustomsDutyRate: 12,
    });

    component['items'].set([
      {
        quotationNumber: 'RE0002161',
        quotationIndex: '1',
        itemDescription: 'CUSTOM ITEM',
        itemCode: 'MAT-1',
        pricePerUnitEur: 1000,
        quantity: 1,
        customsDutyRate: 7.5,
      },
    ]);

    component['editItem'](0);

    expect(component['itemForm'].get('customsDutyRate')?.value).toBe(7.5);
  });

  it('should update customsDutyRate when saveItem is called in edit mode', () => {
    component['globalParamsForm'].patchValue({
      defaultCustomsDutyRate: 12,
    });

    component['items'].set([
      {
        quotationNumber: 'RE0002161',
        quotationIndex: '1',
        itemDescription: 'AB03-03-2367 UNWINDER SHAFT',
        itemCode: 'MAT-1',
        pricePerUnitEur: 2360,
        quantity: 1,
        customsDutyRate: 12,
      },
    ]);

    component['editItem'](0);
    component['itemForm'].patchValue({
      customsDutyRate: 15,
    });
    component['saveItem']();

    expect(component['items']()[0].customsDutyRate).toBe(15);
    expect(component['editingItemIndex']()).toBeNull();
  });
});
