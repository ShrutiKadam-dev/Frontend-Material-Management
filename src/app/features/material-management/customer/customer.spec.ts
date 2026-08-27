import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CustomerService } from '../../../core/services/customer';
import { Customer } from './customer';

describe('Customer', () => {
  let component: Customer;
  let fixture: ComponentFixture<Customer>;

  const mockCustomerService = {
    getCustomers: () => of([]),
    getCustomerById: (id: number) =>
      of({
        id,
        name: 'Test Customer',
        email: 'test@example.com',
        contact_number: '1234567890',
        address: '123 Test St',
        website_url: 'https://test.com',
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
    createCustomer: (customer: any) =>
      of({
        id: 1,
        ...customer,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
    updateCustomer: (id: number, customer: any) =>
      of({
        id,
        ...customer,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Customer],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: CustomerService, useValue: mockCustomerService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Customer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
