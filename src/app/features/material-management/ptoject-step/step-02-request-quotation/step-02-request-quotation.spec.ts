import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';

import { Step02RequestQuotation } from './step-02-request-quotation';

describe('Step02RequestQuotation', () => {
  let component: Step02RequestQuotation;
  let fixture: ComponentFixture<Step02RequestQuotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step02RequestQuotation],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step02RequestQuotation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
