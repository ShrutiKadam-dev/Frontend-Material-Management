import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { CustomerService } from '../../../core/services/customer';
import { Customer } from './customer';

describe('Customer', () => {
  let component: Customer;
  let fixture: ComponentFixture<Customer>;

  let lastPayload: any = null;

  const mockCustomerService = {
    getCustomers: () => of([]),
    getCustomerById: (id: number) =>
      of({
        id,
        name: 'Tata Motors [TML]',
        email: 'rajesh@tatamotors.com',
        contact_number: '9876543210',
        address: 'Pimpri MIDC, Pune, Maharashtra - 411018, India',
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
    createCustomer: (customer: any) => {
      lastPayload = customer;
      return of({
        id: 1,
        ...customer,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      });
    },
    updateCustomer: (id: number, customer: any) => {
      lastPayload = customer;
      return of({
        id,
        ...customer,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      });
    },
  };

  beforeEach(async () => {
    lastPayload = null;
    await TestBed.configureTestingModule({
      imports: [Customer],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
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

  it('should initialize Add dialog with empty state and country and 1 blank POC', () => {
    (component as any).openAddDialog();

    const form = (component as any).customerForm;
    expect(form.get('state').value).toBe('');
    expect(form.get('country').value).toBe('');
    expect(form.get('name')?.value).toBe('');
    expect(form.get('nickname')?.value).toBe('');
    expect(component.pocControls.length).toBe(1);
    expect(component.pocControls[0].get('name')?.value).toBe('');
  });

  it('should allow adding and removing POC controls dynamically', () => {
    (component as any).openAddDialog();
    expect(component.pocControls.length).toBe(1);

    (component as any).addPoc({ name: 'Secondary POC', email: 'sec@test.com', contact_number: '1234567890' });
    expect(component.pocControls.length).toBe(2);
    expect(component.pocControls[1].get('name')?.value).toBe('Secondary POC');

    (component as any).removePoc(1);
    expect(component.pocControls.length).toBe(1);
  });

  it('should auto-patch state and country when city is entered', () => {
    (component as any).openAddDialog();
    const form = (component as any).customerForm;

    form.get('city').setValue('Pune');
    expect(form.get('state').value).toBe('Maharashtra');
    expect(form.get('country').value).toBe('India');
  });

  it('should send structured production payload without combined address or email outside pocs', () => {
    (component as any).openAddDialog();
    const form = (component as any).customerForm;

    form.get('name').setValue('Tata Motors');
    form.get('nickname').setValue('TML');
    form.get('street').setValue('Pimpri Plant Gate 2');
    form.get('city').setValue('Pune');
    form.get('state').setValue('Maharashtra');
    form.get('pincode').setValue('411018');
    form.get('country').setValue('India');

    component.pocControls[0].patchValue({
      name: 'Rajesh Sharma',
      email: 'rajesh@tatamotors.com',
      contact_number: '9876543210',
    });

    (component as any).onSubmit();

    expect(lastPayload).toBeTruthy();
    expect(lastPayload.name).toBe('Tata Motors');
    expect(lastPayload.nickname).toBe('TML');
    expect(lastPayload.street).toBe('Pimpri Plant Gate 2');
    expect(lastPayload.city).toBe('Pune');
    expect(lastPayload.state).toBe('Maharashtra');
    expect(lastPayload.pincode).toBe('411018');
    expect(lastPayload.country).toBe('India');
    expect(lastPayload.address).toBeUndefined();
    expect(lastPayload.email).toBeUndefined();
    expect(lastPayload.contact_number).toBeUndefined();
    expect(lastPayload.pocs.length).toBe(1);
    expect(lastPayload.pocs[0].name).toBe('Rajesh Sharma');
    expect(lastPayload.pocs[0].email).toBe('rajesh@tatamotors.com');
    expect(lastPayload.pocs[0].contact_number).toBe('9876543210');
  });
});
