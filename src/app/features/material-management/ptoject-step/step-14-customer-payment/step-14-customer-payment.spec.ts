import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step14CustomerPayment } from './step-14-customer-payment';

describe('Step14CustomerPayment', () => {
  let component: Step14CustomerPayment;
  let fixture: ComponentFixture<Step14CustomerPayment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step14CustomerPayment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step14CustomerPayment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
