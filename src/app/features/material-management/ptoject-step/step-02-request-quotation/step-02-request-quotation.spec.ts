import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step02RequestQuotation } from './step-02-request-quotation';

describe('Step02RequestQuotation', () => {
  let component: Step02RequestQuotation;
  let fixture: ComponentFixture<Step02RequestQuotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step02RequestQuotation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step02RequestQuotation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
