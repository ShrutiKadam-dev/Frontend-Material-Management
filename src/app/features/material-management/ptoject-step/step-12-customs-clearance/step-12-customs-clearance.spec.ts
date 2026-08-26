import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step12CustomsClearance } from './step-12-customs-clearance';

describe('Step12CustomsClearance', () => {
  let component: Step12CustomsClearance;
  let fixture: ComponentFixture<Step12CustomsClearance>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step12CustomsClearance]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step12CustomsClearance);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
