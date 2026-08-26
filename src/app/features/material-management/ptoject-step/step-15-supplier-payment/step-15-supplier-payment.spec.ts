import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step15SupplierPayment } from './step-15-supplier-payment';

describe('Step15SupplierPayment', () => {
  let component: Step15SupplierPayment;
  let fixture: ComponentFixture<Step15SupplierPayment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step15SupplierPayment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step15SupplierPayment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
