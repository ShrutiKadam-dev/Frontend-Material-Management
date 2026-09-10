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

import { Supplier as SupplierModel } from '../../../core/models/supplier.model';
import { SupplierService } from '../../../core/services/supplier';

export type ViewModeType = 'grid' | 'table';

@Component({
  selector: 'app-suppliers',
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
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Suppliers implements OnInit {
  private readonly supplierService = inject(SupplierService);
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);

  protected readonly suppliers = signal<SupplierModel[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dialogVisible = signal<boolean>(false);
  protected readonly detailsVisible = signal<boolean>(false);
  protected readonly selectedSupplier = signal<SupplierModel | null>(null);
  protected readonly isEditMode = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);

  // Search & View controls
  protected readonly searchQuery = signal<string>('');
  protected readonly viewMode = signal<ViewModeType>('grid');

  // Form definition
  protected readonly supplierForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    contact_number: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]{7,20}$/)]],
    address: ['', [Validators.required, Validators.minLength(3)]],
  });

  // KPI Metrics Computed
  protected readonly totalCount = computed(() => this.suppliers().length);

  protected readonly verifiedContactsCount = computed(() =>
    this.suppliers().filter((s) => Boolean(s.email && s.contact_number)).length,
  );

  protected readonly withAddressCount = computed(() =>
    this.suppliers().filter((s) => Boolean(s.address && s.address.trim().length > 0)).length,
  );

  protected readonly recentCount = computed(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.suppliers().filter((s) => {
      const timestamp = s.created_at || s.updated_at;
      if (!timestamp) return false;
      return new Date(timestamp).getTime() >= sevenDaysAgo;
    }).length;
  });

  // Filtered Suppliers by Search
  protected readonly filteredSuppliers = computed(() => {
    let list = [...this.suppliers()];
    const query = this.searchQuery().trim().toLowerCase();

    if (query) {
      list = list.filter((supplier) => {
        const name = (supplier.name || '').toLowerCase();
        const email = (supplier.email || '').toLowerCase();
        const phone = (supplier.contact_number || '').toLowerCase();
        const address = (supplier.address || '').toLowerCase();
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
    this.loadSuppliers();
  }

  protected loadSuppliers(): void {
    this.loading.set(true);
    this.error.set(null);
    this.supplierService.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers.set(data || []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load suppliers', err);
        this.error.set('Failed to load suppliers. Please verify the network connection.');
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
    this.supplierForm.reset();
    this.isEditMode.set(false);
    this.selectedSupplier.set(null);
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

  // Actions
  protected onSubmit(): void {
    if (this.submitting()) return;
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formValue = this.supplierForm.value;

    const payload = {
      name: (formValue.name || '').trim(),
      email: (formValue.email || '').trim(),
      contact_number: (formValue.contact_number || '').trim(),
      address: (formValue.address || '').trim(),
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
          this.messageService.add({
            severity: 'success',
            summary: 'Supplier Updated',
            detail: `${payload.name} has been successfully updated.`,
          });
          this.loadSuppliers();
        },
        error: (err: unknown) => {
          console.error('Failed to update supplier', err);
          this.submitting.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Update Failed',
            detail: 'Failed to update supplier. Please try again.',
          });
        },
      });
    } else {
      this.supplierService.createSupplier(payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogVisible.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Supplier Added',
            detail: `${payload.name} has been added to your suppliers.`,
          });
          this.loadSuppliers();
        },
        error: (err: unknown) => {
          console.error('Failed to create supplier', err);
          this.submitting.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Creation Failed',
            detail: 'Failed to create supplier. Please try again.',
          });
        },
      });
    }
  }

  protected initials(name: string): string {
    if (!name) return 'SP';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }
}
