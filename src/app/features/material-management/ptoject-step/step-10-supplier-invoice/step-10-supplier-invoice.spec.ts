import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step10SupplierInvoice } from './step-10-supplier-invoice';

describe('Step10SupplierInvoice', () => {
  let component: Step10SupplierInvoice;
  let fixture: ComponentFixture<Step10SupplierInvoice>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step10SupplierInvoice]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step10SupplierInvoice);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
