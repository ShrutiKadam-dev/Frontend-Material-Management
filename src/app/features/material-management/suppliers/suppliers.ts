import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

import { Supplier as SupplierModel } from '../../../core/models/supplier.model';
import { SupplierService } from '../../../core/services/supplier';

@Component({
  selector: 'app-suppliers',
  imports: [
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    ReactiveFormsModule,
    DialogModule,
    DatePipe,
  ],
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Suppliers implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly fb = inject(FormBuilder);

  protected readonly suppliers = signal<SupplierModel[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dialogVisible = signal<boolean>(false);
  protected readonly detailsVisible = signal<boolean>(false);
  protected readonly selectedSupplier = signal<SupplierModel | null>(null);
  protected readonly isEditMode = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);

  protected readonly supplierForm = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    contact_number: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]{7,20}$/)]],
    address: ['', [Validators.required]],
    website_url: ['', [Validators.pattern(/^(https?:\/\/|www\.).+$/)]],
  });

  ngOnInit(): void {
    this.loadSuppliers();
  }

  protected loadSuppliers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.supplierService.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load suppliers', err);
        this.error.set('Failed to load suppliers. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected openAddDialog(): void {
    this.supplierForm.reset();
    this.isEditMode.set(false);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(supplier: SupplierModel): void {
    this.loading.set(true);
    this.supplierService.getSupplierById(supplier.id).subscribe({
      next: (freshSupplier) => {
        this.selectedSupplier.set(freshSupplier);
        this.supplierForm.patchValue({
          name: freshSupplier.name,
          email: freshSupplier.email,
          contact_number: freshSupplier.contact_number,
          address: freshSupplier.address,
          website_url: freshSupplier.website_url || '',
        });
        this.isEditMode.set(true);
        this.dialogVisible.set(true);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load supplier details for edit', err);
        this.error.set('Failed to load supplier details. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected openDetailsDialog(supplier: SupplierModel): void {
    this.loading.set(true);
    this.supplierService.getSupplierById(supplier.id).subscribe({
      next: (freshSupplier) => {
        this.selectedSupplier.set(freshSupplier);
        this.detailsVisible.set(true);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load supplier details', err);
        this.error.set('Failed to load supplier details. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected onSubmit(): void {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formValue = this.supplierForm.value;

    const payload = {
      name: formValue.name || '',
      email: formValue.email || '',
      contact_number: formValue.contact_number || '',
      address: formValue.address || '',
      website_url: formValue.website_url || '',
    };

    if (this.isEditMode()) {
      const supplierId = this.selectedSupplier()?.id;
      if (!supplierId) {
        this.submitting.set(false);
        return;
      }
      this.supplierService.updateSupplier(supplierId, payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogVisible.set(false);
          this.loadSuppliers();
        },
        error: (err: unknown) => {
          console.error('Failed to update supplier', err);
          this.submitting.set(false);
        },
      });
    } else {
      this.supplierService.createSupplier(payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogVisible.set(false);
          this.loadSuppliers();
        },
        error: (err: unknown) => {
          console.error('Failed to create supplier', err);
          this.submitting.set(false);
        },
      });
    }
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
