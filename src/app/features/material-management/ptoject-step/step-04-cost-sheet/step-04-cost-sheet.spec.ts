import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step04CostSheet } from './step-04-cost-sheet';

describe('Step04CostSheet', () => {
  let component: Step04CostSheet;
  let fixture: ComponentFixture<Step04CostSheet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step04CostSheet]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step04CostSheet);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
