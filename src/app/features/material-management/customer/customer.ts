import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { Customer as CustomerModel, CustomerCreateInput } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer';
import {
  formatStructuredAddress,
  lookupCityLocation,
  parseAddressString,
  POPULAR_CITIES,
  StructuredAddress,
} from '../../../core/models/address.model';
import {
  extractEntityPocs,
  extractNameAndNickname,
  formatAddressWithPocs,
  formatNameWithNickname,
  getCleanAddress,
  PointOfContact,
} from '../../../core/models/contact.model';

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
  protected readonly popularCities = POPULAR_CITIES;

  // Form definition
  protected readonly customerForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    nickname: [''],
    pocs: this.fb.array<FormGroup>([]),
    street: ['', [Validators.required, Validators.minLength(3)]],
    area: [''],
    city: ['', [Validators.required, Validators.minLength(2)]],
    state: ['', [Validators.required, Validators.minLength(2)]],
    pincode: ['', [Validators.required, Validators.pattern(/^[0-9A-Za-z\s\-]{3,10}$/)]],
    country: ['', [Validators.required, Validators.minLength(2)]],
  });

  // Getter for POC controls
  get pocControls(): FormGroup[] {
    return (this.customerForm.get('pocs') as FormArray).controls as FormGroup[];
  }

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
        const parsed = extractNameAndNickname(customer.name);
        const name = (customer.name || '').toLowerCase();
        const nick = (customer.nickname || parsed.nickname).toLowerCase();
        const email = (customer.email || '').toLowerCase();
        const phone = (customer.contact_number || '').toLowerCase();
        const address = getCleanAddress(customer.address).toLowerCase();
        const pocs = this.getCustomerPocs(customer);
        const pocMatches = pocs.some(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.email.toLowerCase().includes(query) ||
            p.contact_number.toLowerCase().includes(query) ||
            (p.designation || '').toLowerCase().includes(query),
        );

        return (
          name.includes(query) ||
          nick.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          address.includes(query) ||
          pocMatches
        );
      });
    }

    return list;
  });

  ngOnInit(): void {
    this.loadCustomers();
    this.customerForm.get('city')?.valueChanges.subscribe((cityVal) => {
      this.onCityChanged(cityVal);
    });
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

  // POC FormArray Helpers
  protected createPocGroup(data?: Partial<PointOfContact>): FormGroup {
    return this.fb.group({
      name: [data?.name || '', [Validators.required, Validators.minLength(2)]],
      email: [data?.email || '', [Validators.required, Validators.email]],
      contact_number: [
        data?.contact_number || '',
        [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]{7,20}$/)],
      ],
      designation: [data?.designation || ''],
    });
  }

  protected addPoc(data?: Partial<PointOfContact>): void {
    const pocs = this.customerForm.get('pocs') as FormArray;
    pocs.push(this.createPocGroup(data));
  }

  protected removePoc(index: number): void {
    const pocs = this.customerForm.get('pocs') as FormArray;
    if (pocs.length > 1) {
      pocs.removeAt(index);
    } else {
      pocs.at(0).reset({ name: '', email: '', contact_number: '', designation: '' });
    }
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
    this.customerForm.reset({
      name: '',
      nickname: '',
      street: '',
      area: '',
      city: '',
      state: '',
      pincode: '',
      country: '',
    });

    const pocs = this.customerForm.get('pocs') as FormArray;
    pocs.clear();
    pocs.push(this.createPocGroup({ designation: 'Primary Representative' }));

    this.isEditMode.set(false);
    this.selectedCustomer.set(null);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(customer: CustomerModel): void {
    this.loading.set(true);
    this.customerService.getCustomerById(customer.id).subscribe({
      next: (freshCustomer) => {
        this.selectedCustomer.set(freshCustomer);
        const parsedName = extractNameAndNickname(freshCustomer.name);
        const displayName = freshCustomer.nickname ? freshCustomer.name : parsedName.name;
        const nickname = freshCustomer.nickname || parsedName.nickname;
        const parsedAddr = parseAddressString(freshCustomer.address);
        const pocList = freshCustomer.pocs && freshCustomer.pocs.length > 0
          ? freshCustomer.pocs
          : extractEntityPocs(
              freshCustomer.address,
              freshCustomer.email,
              freshCustomer.contact_number,
              freshCustomer.name,
            );

        const pocs = this.customerForm.get('pocs') as FormArray;
        pocs.clear();
        if (pocList.length > 0) {
          pocList.forEach((poc) => pocs.push(this.createPocGroup(poc)));
        } else {
          pocs.push(
            this.createPocGroup({
              name: displayName ? `${displayName} Contact` : '',
              email: freshCustomer.email || '',
              contact_number: freshCustomer.contact_number || '',
              designation: 'Primary Representative',
            }),
          );
        }

        this.customerForm.patchValue({
          name: displayName,
          nickname: nickname || '',
          street: freshCustomer.street || parsedAddr.street,
          area: freshCustomer.area || parsedAddr.area || '',
          city: freshCustomer.city || parsedAddr.city,
          state: freshCustomer.state || parsedAddr.state,
          pincode: freshCustomer.pincode || parsedAddr.pincode,
          country: freshCustomer.country || parsedAddr.country || '',
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
    const pocsVal: PointOfContact[] = (this.customerForm.get('pocs') as FormArray).value || [];
    const cleanName = (formValue.name || '').trim();
    const nickname = (formValue.nickname || '').trim() || undefined;

    const validPocs: PointOfContact[] = pocsVal
      .map((p) => ({
        name: (p.name || '').trim(),
        email: (p.email || '').trim(),
        contact_number: (p.contact_number || '').trim(),
        designation: (p.designation || '').trim() || undefined,
      }))
      .filter((p) => Boolean(p.name && p.email && p.contact_number));

    // Production-grade payload: structured address only, contact details in pocs only
    const payload: CustomerCreateInput = {
      name: cleanName,
      nickname,
      street: (formValue.street || '').trim(),
      area: (formValue.area || '').trim() || undefined,
      city: (formValue.city || '').trim(),
      state: (formValue.state || '').trim(),
      pincode: (formValue.pincode || '').trim(),
      country: (formValue.country || '').trim(),
      pocs: validPocs,
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
            detail: `${this.getDisplayName(payload.name)} has been successfully updated.`,
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
            detail: `${this.getDisplayName(payload.name)} has been added to your accounts.`,
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

  protected deleteCustomer(customer: CustomerModel): void {
    const name = this.getDisplayName(customer.name) || `Customer #${customer.id}`;
    if (!confirm(`Are you sure you want to remove customer "${name}"? This action cannot be undone.`)) {
      return;
    }
    this.customerService.deleteCustomer(customer.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Customer Removed',
          detail: `${name} has been successfully removed.`,
        });
        if (this.detailsVisible() && this.selectedCustomer()?.id === customer.id) {
          this.detailsVisible.set(false);
        }
        this.loadCustomers();
      },
      error: (err: unknown) => {
        console.error('Failed to delete customer', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Remove Failed',
          detail: 'Failed to remove customer. It may be linked to active projects.',
        });
      },
    });
  }

  // Display and format helpers
  protected getDisplayName(fullName: string | null | undefined): string {
    return extractNameAndNickname(fullName).name;
  }

  protected getNickname(fullName: string | null | undefined): string {
    return extractNameAndNickname(fullName).nickname;
  }

  protected getCleanAddr(rawAddr: string | null | undefined): string {
    return getCleanAddress(rawAddr);
  }

  protected getCustomerPocs(customer: CustomerModel): PointOfContact[] {
    if (customer.pocs && customer.pocs.length > 0) {
      return customer.pocs;
    }
    return extractEntityPocs(
      customer.address,
      customer.email,
      customer.contact_number,
      customer.name,
    );
  }

  protected getPrimaryPoc(customer: CustomerModel): PointOfContact | null {
    const list = this.getCustomerPocs(customer);
    return list.length > 0 ? list[0] : null;
  }

  protected initials(name: string): string {
    const clean = this.getDisplayName(name);
    if (!clean) return 'CU';
    return clean
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  protected parseAddress(addr: string | null | undefined): StructuredAddress {
    return parseAddressString(addr);
  }

  protected onCityChanged(cityInput: string | null | undefined): void {
    const match = lookupCityLocation(cityInput);
    if (match) {
      this.customerForm.patchValue(
        {
          state: match.state,
          country: match.country,
        },
        { emitEvent: false },
      );
    }
  }

  protected onCityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onCityChanged(input.value);
  }
}
