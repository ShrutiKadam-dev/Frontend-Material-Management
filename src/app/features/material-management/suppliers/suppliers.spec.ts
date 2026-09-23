import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { SupplierService } from '../../../core/services/supplier';
import { Suppliers } from './suppliers';

describe('Suppliers', () => {
  let component: Suppliers;
  let fixture: ComponentFixture<Suppliers>;

  let lastPayload: any = null;

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
    createSupplier: (supplier: any) => {
      lastPayload = supplier;
      return of({
        id: 1,
        ...supplier,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      });
    },
    updateSupplier: (id: number, supplier: any) => {
      lastPayload = supplier;
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
    expect(lastPayload.name).toBe('Pasaban S.A.');
    expect(lastPayload.nickname).toBe('PAS');
    expect(lastPayload.street).toBe('Tolosa Factory Road');
    expect(lastPayload.city).toBe('Mumbai');
    expect(lastPayload.state).toBe('Maharashtra');
    expect(lastPayload.pincode).toBe('400001');
    expect(lastPayload.country).toBe('India');
    expect(lastPayload.address).toBeUndefined();
    expect(lastPayload.email).toBeUndefined();
    expect(lastPayload.contact_number).toBeUndefined();
    expect(lastPayload.pocs.length).toBe(1);
    expect(lastPayload.pocs[0].name).toBe('Carlos Ruiz');
    expect(lastPayload.pocs[0].email).toBe('carlos@pasaban.com');
    expect(lastPayload.pocs[0].contact_number).toBe('9876543210');
  });
});
