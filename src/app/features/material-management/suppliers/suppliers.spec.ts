import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { SupplierService } from '../../../core/services/supplier';
import { LocationService } from '../../../core/services/location';
import { Supplier as SupplierModel, SupplierCreateInput } from '../../../core/models/supplier.model';
import { Suppliers } from './suppliers';

describe('Suppliers', () => {
  let component: Suppliers;
  let fixture: ComponentFixture<Suppliers>;

  let lastPayload: (SupplierCreateInput & Record<string, unknown>) | null = null;

  const mockLocationService = {
    getCountries: () => of(['India', 'United States', 'United Arab Emirates']),
    getStates: (country?: string | null) => {
      if (country === 'United Arab Emirates') {
        return of(['Dubai', 'Abu Dhabi']);
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
      return of(['Pune', 'Mumbai']);
    },
    lookupCity: (city?: string | null) => {
      if (city === 'Ahmedabad') {
        return of({ city: 'Ahmedabad', state: 'Gujarat', country: 'India' });
      }
      return of({ city: 'Pune', state: 'Maharashtra', country: 'India' });
    },
  };

  const mockSupplierService = {
    getSuppliers: () => of([]),
    getSupplierById: (id: number) =>
      of({
        id,
        name: 'Pasaban S.A. [PAS]',
        email: 'spareparts@pasaban.com',
        contact_number: '+34 943651632',
        address: '20400 TOLOSA (GUIPUZCOA)',
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
    createSupplier: (supplier: SupplierCreateInput) => {
      lastPayload = supplier as SupplierCreateInput & Record<string, unknown>;
      return of({
        id: 1,
        ...supplier,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      });
    },
    updateSupplier: (id: number, supplier: SupplierCreateInput) => {
      lastPayload = supplier as SupplierCreateInput & Record<string, unknown>;
      return of({
        id,
        ...supplier,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      });
    },
  };

  beforeEach(async () => {
    lastPayload = null;
    await TestBed.configureTestingModule({
      imports: [Suppliers],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        MessageService,
        { provide: SupplierService, useValue: mockSupplierService },
        { provide: LocationService, useValue: mockLocationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Suppliers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize Add dialog with empty state and country and 1 blank POC', () => {
    (component as any).openAddDialog();

    const form = (component as any).supplierForm;
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

    (component as any).addPoc({ name: 'Vendor Rep 2', email: 'rep2@pasaban.com', contact_number: '1234567890' });
    expect(component.pocControls.length).toBe(2);
    expect(component.pocControls[1].get('name')?.value).toBe('Vendor Rep 2');

    (component as any).removePoc(1);
    expect(component.pocControls.length).toBe(1);
  });

  it('should auto-patch state and country when city is entered', () => {
    (component as any).openAddDialog();
    const form = (component as any).supplierForm;

    form.get('city').setValue('Mumbai');
    expect(form.get('state').value).toBe('Maharashtra');
    expect(form.get('country').value).toBe('India');
  });

  it('should send structured production payload without combined address or email outside pocs', () => {
    (component as any).openAddDialog();
    const form = (component as any).supplierForm;

    form.get('name').setValue('Pasaban S.A.');
    form.get('nickname').setValue('PAS');
    form.get('street').setValue('Tolosa Factory Road');
    form.get('city').setValue('Mumbai');
    form.get('state').setValue('Maharashtra');
    form.get('pincode').setValue('400001');
    form.get('country').setValue('India');

    component.pocControls[0].patchValue({
      name: 'Carlos Ruiz',
      email: 'carlos@pasaban.com',
      contact_number: '9876543210',
    });

    (component as any).onSubmit();

    expect(lastPayload).toBeTruthy();
    expect(lastPayload!.name).toBe('Pasaban S.A.');
    expect(lastPayload!.nickname).toBe('PAS');
    expect(lastPayload!.street).toBe('Tolosa Factory Road');
    expect(lastPayload!.city).toBe('Mumbai');
    expect(lastPayload!.state).toBe('Maharashtra');
    expect(lastPayload!.pincode).toBe('400001');
    expect(lastPayload!.country).toBe('India');
    expect(lastPayload!.address).toBeUndefined();
    expect(lastPayload!.email).toBeUndefined();
    expect(lastPayload!.contact_number).toBeUndefined();
    expect(lastPayload!.pocs!.length).toBe(1);
    expect(lastPayload!.pocs![0].name).toBe('Carlos Ruiz');
    expect(lastPayload!.pocs![0].email).toBe('carlos@pasaban.com');
    expect(lastPayload!.pocs![0].contact_number).toBe('9876543210');
  });

  it('should return formatted address for supplier with structured address fields', () => {
    const supplier = {
      id: 5,
      name: 'Test Supplier',
      street: 'Tolosa Factory Road',
      city: 'Tolosa',
      state: 'Guipuzcoa',
      pincode: '20400',
      country: 'Spain',
    } as unknown as SupplierModel;
    expect((component as unknown as { getCleanAddr: (s: SupplierModel) => string }).getCleanAddr(supplier)).toBe(
      'Tolosa Factory Road, Tolosa, Guipuzcoa - 20400, Spain',
    );
  });

  it('should fallback to legacy address property when structured fields are not present', () => {
    const supplier = {
      id: 6,
      name: 'Legacy Supplier',
      address: 'Simple Road, City',
    } as unknown as SupplierModel;
    expect((component as unknown as { getCleanAddr: (s: SupplierModel) => string }).getCleanAddr(supplier)).toBe('Simple Road, City');
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

