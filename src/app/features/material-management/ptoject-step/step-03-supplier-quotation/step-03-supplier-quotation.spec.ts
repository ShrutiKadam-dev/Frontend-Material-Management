import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step03SupplierQuotation } from './step-03-supplier-quotation';

describe('Step03SupplierQuotation', () => {
  let component: Step03SupplierQuotation;
  let fixture: ComponentFixture<Step03SupplierQuotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step03SupplierQuotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step03SupplierQuotation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
