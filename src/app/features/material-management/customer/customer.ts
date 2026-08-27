import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

import { Customer as CustomerModel } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer';

@Component({
  selector: 'app-customer',
  imports: [
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    ReactiveFormsModule,
    DialogModule,
    DatePipe,
  ],
  templateUrl: './customer.html',
  styleUrl: './customer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Customer implements OnInit {
  private readonly customerService = inject(CustomerService);
  private readonly fb = inject(FormBuilder);

  protected readonly customers = signal<CustomerModel[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dialogVisible = signal<boolean>(false);
  protected readonly detailsVisible = signal<boolean>(false);
  protected readonly selectedCustomer = signal<CustomerModel | null>(null);
  protected readonly isEditMode = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);

  protected readonly customerForm = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    contact_number: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]{7,20}$/)]],
    address: ['', [Validators.required]],
    website_url: ['', [Validators.pattern(/^(https?:\/\/|www\.).+$/)]],
  });

  ngOnInit(): void {
    this.loadCustomers();
  }

  protected loadCustomers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.customerService.getCustomers().subscribe({
      next: (data) => {
        this.customers.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load customers', err);
        this.error.set('Failed to load customers. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected openAddDialog(): void {
    this.customerForm.reset();
    this.isEditMode.set(false);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(customer: CustomerModel): void {
    this.loading.set(true);
    this.customerService.getCustomerById(customer.id).subscribe({
      next: (freshCustomer) => {
        this.selectedCustomer.set(freshCustomer);
        this.customerForm.patchValue({
          name: freshCustomer.name,
          email: freshCustomer.email,
          contact_number: freshCustomer.contact_number,
          address: freshCustomer.address,
          website_url: freshCustomer.website_url || '',
        });
        this.isEditMode.set(true);
        this.dialogVisible.set(true);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load customer details for edit', err);
        this.error.set('Failed to load customer details. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected openDetailsDialog(customer: CustomerModel): void {
    this.loading.set(true);
    this.customerService.getCustomerById(customer.id).subscribe({
      next: (freshCustomer) => {
        this.selectedCustomer.set(freshCustomer);
        this.detailsVisible.set(true);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load customer details', err);
        this.error.set('Failed to load customer details. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected onSubmit(): void {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formValue = this.customerForm.value;

    const payload = {
      name: formValue.name || '',
      email: formValue.email || '',
      contact_number: formValue.contact_number || '',
      address: formValue.address || '',
      website_url: formValue.website_url || '',
    };

    if (this.isEditMode()) {
      const customerId = this.selectedCustomer()?.id;
      if (!customerId) {
        this.submitting.set(false);
        return;
      }
      this.customerService.updateCustomer(customerId, payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogVisible.set(false);
          this.loadCustomers();
        },
        error: (err: unknown) => {
          console.error('Failed to update customer', err);
          this.submitting.set(false);
        },
      });
    } else {
      this.customerService.createCustomer(payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogVisible.set(false);
          this.loadCustomers();
        },
        error: (err: unknown) => {
          console.error('Failed to create customer', err);
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
