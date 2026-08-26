import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step05CustomerQuotation } from './step-05-customer-quotation';

describe('Step05CustomerQuotation', () => {
  let component: Step05CustomerQuotation;
  let fixture: ComponentFixture<Step05CustomerQuotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step05CustomerQuotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step05CustomerQuotation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
