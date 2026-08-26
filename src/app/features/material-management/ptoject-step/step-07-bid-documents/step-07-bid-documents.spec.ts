import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Step07BidDocuments } from './step-07-bid-documents';

describe('Step07BidDocuments', () => {
  let component: Step07BidDocuments;
  let fixture: ComponentFixture<Step07BidDocuments>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step07BidDocuments]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Step07BidDocuments);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
