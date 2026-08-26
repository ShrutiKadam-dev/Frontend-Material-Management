import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step06Tender } from './step-06-tender';

describe('Step06Tender', () => {
  let component: Step06Tender;
  let fixture: ComponentFixture<Step06Tender>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step06Tender]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step06Tender);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
