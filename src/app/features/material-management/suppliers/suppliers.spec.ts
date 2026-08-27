import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SupplierService } from '../../../core/services/supplier';
import { Suppliers } from './suppliers';

describe('Suppliers', () => {
  let component: Suppliers;
  let fixture: ComponentFixture<Suppliers>;

  const mockSupplierService = {
    getSuppliers: () => of([]),
    getSupplierById: (id: number) =>
      of({
        id,
        name: 'Test Supplier',
        email: 'supplier@example.com',
        contact_number: '9876543210',
        address: '456 Supplier Rd',
        website_url: 'www.supplier.com',
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
    createSupplier: (supplier: any) =>
      of({
        id: 1,
        ...supplier,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
    updateSupplier: (id: number, supplier: any) =>
      of({
        id,
        ...supplier,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Suppliers],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
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
});
