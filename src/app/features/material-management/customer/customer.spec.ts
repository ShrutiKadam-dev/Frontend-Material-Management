import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { CustomerService } from '../../../core/services/customer';
import { LocationService } from '../../../core/services/location';
import { Customer as CustomerModel, CustomerCreateInput } from '../../../core/models/customer.model';
import { Customer } from './customer';

describe('Customer', () => {
  let component: Customer;
  let fixture: ComponentFixture<Customer>;

  let lastPayload: (CustomerCreateInput & Record<string, unknown>) | null = null;

  const mockLocationService = {
    getCountries: () => of(['India', 'United States', 'United Arab Emirates']),
    getStates: (country?: string | null) => {
      if (country === 'United Arab Emirates') {
        return of(['Dubai', 'Abu Dhabi']);
      }
      if (country === 'Spain') {
        return of(['Guipuzcoa', 'Basque Country']);
      }
      return of(['Maharashtra', 'Gujarat']);
    },
    getCities: (country?: string | null, state?: string | null) => {
      if (state === 'Gujarat') {
        return of(['Ahmedabad', 'Surat', 'Vadodara', 'Vapi']);
      }
      if (country === 'United Arab Emirates' || state === 'Dubai') {
        return of(['Dubai', 'Jebel Ali']);
      }
      if (country === 'Spain' || state === 'Guipuzcoa') {
        return of(['Tolosa', 'San Sebastian']);
      }
      return of(['Pune', 'Mumbai']);
    },
    lookupCity: (city?: string | null) => {
      if (city === 'Ahmedabad') {
        return of({ city: 'Ahmedabad', state: 'Gujarat', country: 'India' });
      }
      if (city === 'Tolosa') {
        return of({ city: 'Tolosa', state: 'Guipuzcoa', country: 'Spain' });
      }
      return of({ city: 'Pune', state: 'Maharashtra', country: 'India' });
    },
  };

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
    createCustomer: (customer: CustomerCreateInput) => {
      lastPayload = customer as CustomerCreateInput & Record<string, unknown>;
      return of({
        id: 1,
        ...customer,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      });
    },
    updateCustomer: (id: number, customer: CustomerCreateInput) => {
      lastPayload = customer as CustomerCreateInput & Record<string, unknown>;
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
        { provide: LocationService, useValue: mockLocationService },
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

  it('should auto-patch state and country when Tolosa is entered', () => {
    (component as any).openAddDialog();
    const form = (component as any).customerForm;

    form.get('city').setValue('Tolosa');
    expect(form.get('state').value).toBe('Guipuzcoa');
    expect(form.get('country').value).toBe('Spain');
  });

  it('should not overwrite selected country Spain when Tolosa is entered', () => {
    (component as any).openAddDialog();
    const form = (component as any).customerForm;

    form.get('country').setValue('Spain');
    form.get('city').setValue('Tolosa');
    expect(form.get('country').value).toBe('Spain');
    expect(form.get('state').value).toBe('Guipuzcoa');
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
    expect(lastPayload!.name).toBe('Tata Motors');
    expect(lastPayload!.nickname).toBe('TML');
    expect(lastPayload!.street).toBe('Pimpri Plant Gate 2');
    expect(lastPayload!.city).toBe('Pune');
    expect(lastPayload!.state).toBe('Maharashtra');
    expect(lastPayload!.pincode).toBe('411018');
    expect(lastPayload!.country).toBe('India');
    expect(lastPayload!.address).toBeUndefined();
    expect(lastPayload!.email).toBeUndefined();
    expect(lastPayload!.contact_number).toBeUndefined();
    expect(lastPayload!.pocs!.length).toBe(1);
    expect(lastPayload!.pocs![0].name).toBe('Rajesh Sharma');
    expect(lastPayload!.pocs![0].email).toBe('rajesh@tatamotors.com');
    expect(lastPayload!.pocs![0].contact_number).toBe('9876543210');
  });

  it('should return formatted address for customer with structured address fields', () => {
    const customer = {
      id: 5,
      name: 'Test Customer',
      street: 'Pimpri Plant Gate 2',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411018',
      country: 'India',
    } as unknown as CustomerModel;
    expect((component as unknown as { getCleanAddr: (c: CustomerModel) => string }).getCleanAddr(customer)).toBe(
      'Pimpri Plant Gate 2, Pune, Maharashtra - 411018, India',
    );
  });

  it('should fallback to legacy address property when structured fields are not present', () => {
    const customer = {
      id: 6,
      name: 'Legacy Customer',
      address: 'Simple Road, City',
    } as unknown as CustomerModel;
    expect((component as unknown as { getCleanAddr: (c: CustomerModel) => string }).getCleanAddr(customer)).toBe('Simple Road, City');
  });

  it('should update state and city options when country and state change', () => {
    (component as any).openAddDialog();
    (component as any).onCountryChange('United Arab Emirates');
    expect((component as any).stateOptions()).toContain('Dubai');
    expect((component as any).stateOptions()).toContain('Abu Dhabi');

    (component as any).onStateChange('Dubai');
    expect((component as any).cityOptions()).toContain('Dubai');
    expect((component as any).cityOptions()).toContain('Jebel Ali');
  });

  it('should filter city options when state is selected for India', () => {
    (component as any).openAddDialog();
    (component as any).onCountryChange('India');
    (component as any).onStateChange('Gujarat');
    expect((component as any).cityOptions()).toContain('Ahmedabad');
    expect((component as any).cityOptions()).toContain('Surat');
    expect((component as any).cityOptions()).toContain('Vadodara');
    expect((component as any).cityOptions()).toContain('Vapi');
    expect((component as any).cityOptions()).not.toContain('Mumbai');
  });
});

