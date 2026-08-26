import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step13CustomerDelivery } from './step-13-customer-delivery';

describe('Step13CustomerDelivery', () => {
  let component: Step13CustomerDelivery;
  let fixture: ComponentFixture<Step13CustomerDelivery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step13CustomerDelivery]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step13CustomerDelivery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
