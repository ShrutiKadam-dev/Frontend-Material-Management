import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';

import { Step03SupplierQuotation } from './step-03-supplier-quotation';

describe('Step03SupplierQuotation', () => {
  let component: Step03SupplierQuotation;
  let fixture: ComponentFixture<Step03SupplierQuotation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step03SupplierQuotation],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step03SupplierQuotation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
