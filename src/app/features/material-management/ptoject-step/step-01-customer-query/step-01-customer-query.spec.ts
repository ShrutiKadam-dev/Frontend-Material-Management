import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step01CustomerQuery } from './step-01-customer-query';

describe('Step01CustomerQuery', () => {
  let component: Step01CustomerQuery;
  let fixture: ComponentFixture<Step01CustomerQuery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step01CustomerQuery]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step01CustomerQuery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
