import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { Customer as CustomerModel } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer';

export type ViewModeType = 'grid' | 'table';

@Component({
  selector: 'app-customer',
  imports: [
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TooltipModule,
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
  private readonly messageService = inject(MessageService);

  protected readonly customers = signal<CustomerModel[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dialogVisible = signal<boolean>(false);
  protected readonly detailsVisible = signal<boolean>(false);
  protected readonly selectedCustomer = signal<CustomerModel | null>(null);
  protected readonly isEditMode = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);

  // Search & View controls
  protected readonly searchQuery = signal<string>('');
  protected readonly viewMode = signal<ViewModeType>('grid');

  // Form definition
  protected readonly customerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    contact_number: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]{7,20}$/)]],
    address: ['', [Validators.required, Validators.minLength(3)]],
  });

  // KPI Metrics Computed
  protected readonly totalCount = computed(() => this.customers().length);

  protected readonly verifiedContactsCount = computed(() =>
    this.customers().filter((c) => Boolean(c.email && c.contact_number)).length,
  );

  protected readonly withAddressCount = computed(() =>
    this.customers().filter((c) => Boolean(c.address && c.address.trim().length > 0)).length,
  );

  protected readonly recentCount = computed(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.customers().filter((c) => {
      const timestamp = c.created_at || c.updated_at;
      if (!timestamp) return false;
      return new Date(timestamp).getTime() >= sevenDaysAgo;
    }).length;
  });

  // Filtered Customers by Search
  protected readonly filteredCustomers = computed(() => {
    let list = [...this.customers()];
    const query = this.searchQuery().trim().toLowerCase();

    if (query) {
      list = list.filter((customer) => {
        const name = (customer.name || '').toLowerCase();
        const email = (customer.email || '').toLowerCase();
        const phone = (customer.contact_number || '').toLowerCase();
        const address = (customer.address || '').toLowerCase();
        return (
          name.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          address.includes(query)
        );
      });
    }

    return list;
  });

  ngOnInit(): void {
    this.loadCustomers();
  }

  protected loadCustomers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.customerService.getCustomers().subscribe({
      next: (data) => {
        this.customers.set(data || []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load customers', err);
        this.error.set('Failed to load customers. Please verify the network connection.');
        this.loading.set(false);
      },
    });
  }

  // Filter & Search Handlers
  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  protected setViewMode(mode: ViewModeType): void {
    this.viewMode.set(mode);
  }

  // Dialog Openers
  protected openAddDialog(): void {
    this.customerForm.reset();
    this.isEditMode.set(false);
    this.selectedCustomer.set(null);
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

  // Actions
  protected onSubmit(): void {
    if (this.submitting()) return;
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formValue = this.customerForm.value;

    const payload = {
      name: (formValue.name || '').trim(),
      email: (formValue.email || '').trim(),
      contact_number: (formValue.contact_number || '').trim(),
      address: (formValue.address || '').trim(),
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
          this.messageService.add({
            severity: 'success',
            summary: 'Customer Updated',
            detail: `${payload.name} has been successfully updated.`,
          });
          this.loadCustomers();
        },
        error: (err: unknown) => {
          console.error('Failed to update customer', err);
          this.submitting.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Update Failed',
            detail: 'Failed to update customer. Please try again.',
          });
        },
      });
    } else {
      this.customerService.createCustomer(payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogVisible.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Customer Added',
            detail: `${payload.name} has been added to your accounts.`,
          });
          this.loadCustomers();
        },
        error: (err: unknown) => {
          console.error('Failed to create customer', err);
          this.submitting.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Creation Failed',
            detail: 'Failed to create customer. Please try again.',
          });
        },
      });
    }
  }

  protected initials(name: string): string {
    if (!name) return 'CU';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
