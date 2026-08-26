import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step11ImportLogistics } from './step-11-import-logistics';

describe('Step11ImportLogistics', () => {
  let component: Step11ImportLogistics;
  let fixture: ComponentFixture<Step11ImportLogistics>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step11ImportLogistics]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step11ImportLogistics);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
