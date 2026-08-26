import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step08PurchaseOrder } from './step-08-purchase-order';

describe('Step08PurchaseOrder', () => {
  let component: Step08PurchaseOrder;
  let fixture: ComponentFixture<Step08PurchaseOrder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step08PurchaseOrder]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step08PurchaseOrder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
