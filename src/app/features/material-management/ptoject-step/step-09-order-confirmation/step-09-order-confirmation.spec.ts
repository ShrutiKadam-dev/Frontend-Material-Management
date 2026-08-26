import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step09OrderConfirmation } from './step-09-order-confirmation';

describe('Step09OrderConfirmation', () => {
  let component: Step09OrderConfirmation;
  let fixture: ComponentFixture<Step09OrderConfirmation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step09OrderConfirmation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step09OrderConfirmation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
