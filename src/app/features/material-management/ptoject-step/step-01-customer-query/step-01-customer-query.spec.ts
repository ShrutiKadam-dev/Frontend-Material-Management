import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';

import { Step01CustomerQuery } from './step-01-customer-query';

describe('Step01CustomerQuery', () => {
  let component: Step01CustomerQuery;
  let fixture: ComponentFixture<Step01CustomerQuery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step01CustomerQuery],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Step01CustomerQuery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
