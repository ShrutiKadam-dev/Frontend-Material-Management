import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { Supplier as SupplierModel, SupplierCreateInput } from '../../../core/models/supplier.model';
import { SupplierService } from '../../../core/services/supplier';
import { LocationService } from '../../../core/services/location';
import {
  getEntityFullAddress,
  parseAddressString,
  StructuredAddress,
} from '../../../core/models/address.model';
import {
  extractEntityPocs,
  extractNameAndNickname,
  formatAddressWithPocs,
  formatNameWithNickname,
  PointOfContact,
} from '../../../core/models/contact.model';

export type ViewModeType = 'grid' | 'table';

@Component({
  selector: 'app-suppliers',
  imports: [
    ButtonModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SelectModule,
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
  private readonly locationService = inject(LocationService);
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

  // Location Selector Signals
  protected readonly countryOptions = signal<string[]>([]);
  protected readonly stateOptions = signal<string[]>([]);
  protected readonly cityOptions = signal<string[]>([]);

  // Form definition
  protected readonly supplierForm = this.fb.group({
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
    return (this.supplierForm.get('pocs') as FormArray).controls as FormGroup[];
  }

  // KPI Metrics Computed
  protected readonly totalCount = computed(() => this.suppliers().length);

  protected readonly verifiedContactsCount = computed(() =>
    this.suppliers().filter((s) => Boolean(s.email && s.contact_number)).length,
  );

  protected readonly withAddressCount = computed(() =>
    this.suppliers().filter((s) => Boolean(this.getCleanAddr(s))).length,
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
        const parsed = extractNameAndNickname(supplier.name);
        const name = (supplier.name || '').toLowerCase();
        const nick = (supplier.nickname || parsed.nickname).toLowerCase();
        const email = (supplier.email || '').toLowerCase();
        const phone = (supplier.contact_number || '').toLowerCase();
        const address = this.getCleanAddr(supplier).toLowerCase();
        const pocs = this.getSupplierPocs(supplier);
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
    this.loadSuppliers();
    this.locationService.getCountries().subscribe((c) => this.countryOptions.set(c));
    this.locationService.getStates('India').subscribe((s) => this.stateOptions.set(s));
    this.locationService.getCities('India').subscribe((c) => this.cityOptions.set(c));
    this.supplierForm.get('city')?.valueChanges.subscribe((cityVal) => {
      this.onCityChanged(cityVal);
    });
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
    const pocs = this.supplierForm.get('pocs') as FormArray;
    pocs.push(this.createPocGroup(data));
  }

  protected removePoc(index: number): void {
    const pocs = this.supplierForm.get('pocs') as FormArray;
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
    this.supplierForm.reset({
      name: '',
      nickname: '',
      street: '',
      area: '',
      city: '',
      state: '',
      pincode: '',
      country: '',
    });

    this.locationService.getCountries().subscribe((c) => this.countryOptions.set(c));
    this.stateOptions.set([]);
    this.cityOptions.set([]);

    const pocs = this.supplierForm.get('pocs') as FormArray;
    pocs.clear();
    pocs.push(this.createPocGroup({ designation: 'Primary Representative' }));

    this.isEditMode.set(false);
    this.selectedSupplier.set(null);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(supplier: SupplierModel): void {
    this.loading.set(true);
    this.supplierService.getSupplierById(supplier.id).subscribe({
      next: (freshSupplier) => {
        this.selectedSupplier.set(freshSupplier);
        const parsedName = extractNameAndNickname(freshSupplier.name);
        const displayName = freshSupplier.nickname ? freshSupplier.name : parsedName.name;
        const nickname = freshSupplier.nickname || parsedName.nickname;
        const parsedAddr = parseAddressString(freshSupplier.address);
        const pocList = freshSupplier.pocs && freshSupplier.pocs.length > 0
          ? freshSupplier.pocs
          : extractEntityPocs(
              freshSupplier.address,
              freshSupplier.email,
              freshSupplier.contact_number,
              freshSupplier.name,
            );

        const pocs = this.supplierForm.get('pocs') as FormArray;
        pocs.clear();
        if (pocList.length > 0) {
          pocList.forEach((poc) => {
            const rawName = (poc.name || '').trim();
            const cleanEntity = displayName.trim();
            const isSynthetic =
              rawName.toLowerCase() === `${cleanEntity.toLowerCase()} contact` ||
              rawName.toLowerCase() === cleanEntity.toLowerCase();
            pocs.push(
              this.createPocGroup({
                ...poc,
                name: isSynthetic ? '' : poc.name,
              }),
            );
          });
        } else {
          pocs.push(
            this.createPocGroup({
              name: '',
              email: freshSupplier.email || '',
              contact_number: freshSupplier.contact_number || '',
              designation: 'Primary Representative',
            }),
          );
        }

        const countryVal = freshSupplier.country || parsedAddr.country || '';
        const stateVal = freshSupplier.state || parsedAddr.state || '';
        const cityVal = freshSupplier.city || parsedAddr.city || '';

        this.locationService.getCountries().subscribe((c) => {
          let countries = [...c];
          if (countryVal && !countries.some((x) => x.toLowerCase() === countryVal.toLowerCase())) {
            countries.push(countryVal);
          }
          this.countryOptions.set(countries);
        });

        if (countryVal) {
          this.locationService.getStates(countryVal).subscribe((s) => {
            let states = [...s];
            if (stateVal && !states.some((x) => x.toLowerCase() === stateVal.toLowerCase())) {
              states.unshift(stateVal);
            }
            this.stateOptions.set(states);
          });
          this.locationService.getCities(countryVal, stateVal).subscribe((c) => {
            let cities = [...c];
            const cleanCityVal = cityVal?.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
            if (cleanCityVal && !cities.some((x) => x.toLowerCase() === cleanCityVal.toLowerCase())) {
              cities.unshift(cleanCityVal);
            }
            this.cityOptions.set(cities);
          });
        }

        this.supplierForm.patchValue(
          {
            name: displayName,
            nickname: nickname || '',
            street: freshSupplier.street || parsedAddr.street,
            area: freshSupplier.area || parsedAddr.area || '',
            city: cityVal,
            state: stateVal,
            pincode: freshSupplier.pincode || parsedAddr.pincode,
            country: countryVal,
          },
          { emitEvent: false },
        );
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
    const pocsVal: PointOfContact[] = (this.supplierForm.get('pocs') as FormArray).value || [];
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
    const payload: SupplierCreateInput = {
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
            detail: `${this.getDisplayName(payload.name)} has been successfully updated.`,
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
            detail: `${this.getDisplayName(payload.name)} has been added to your suppliers.`,
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

  protected deleteSupplier(supplier: SupplierModel): void {
    const name = this.getDisplayName(supplier.name) || `Supplier #${supplier.id}`;
    if (!confirm(`Are you sure you want to remove supplier "${name}"? This action cannot be undone.`)) {
      return;
    }
    this.supplierService.deleteSupplier(supplier.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Supplier Removed',
          detail: `${name} has been successfully removed.`,
        });
        if (this.detailsVisible() && this.selectedSupplier()?.id === supplier.id) {
          this.detailsVisible.set(false);
        }
        this.loadSuppliers();
      },
      error: (err: unknown) => {
        console.error('Failed to delete supplier', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Remove Failed',
          detail: 'Failed to remove supplier. It may be linked to active projects.',
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

  protected getCleanAddr(rawAddrOrSupplier: SupplierModel | string | null | undefined): string {
    return getEntityFullAddress(rawAddrOrSupplier);
  }

  protected getSupplierPocs(supplier: SupplierModel): PointOfContact[] {
    if (supplier.pocs && supplier.pocs.length > 0) {
      return supplier.pocs;
    }
    return extractEntityPocs(
      supplier.address,
      supplier.email,
      supplier.contact_number,
      supplier.name,
    );
  }

  protected getPrimaryPoc(supplier: SupplierModel): PointOfContact | null {
    const list = this.getSupplierPocs(supplier);
    return list.length > 0 ? list[0] : null;
  }

  protected initials(name: string): string {
    const clean = this.getDisplayName(name);
    if (!clean) return 'SU';
    return clean
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  protected getPocPersonName(poc: PointOfContact, entityName?: string | null): string {
    const rawName = (poc.name || '').trim();
    const cleanEntity = this.getDisplayName(entityName).trim();
    const isSynthetic =
      !rawName ||
      rawName.toLowerCase() === 'primary contact' ||
      rawName.toLowerCase() === 'company contact' ||
      (cleanEntity && rawName.toLowerCase() === cleanEntity.toLowerCase()) ||
      (cleanEntity && rawName.toLowerCase() === `${cleanEntity.toLowerCase()} contact`);

    if (isSynthetic) {
      return poc.designation || 'Primary Representative';
    }
    return rawName;
  }

  protected getPocRole(poc: PointOfContact, index: number, entityName?: string | null): string {
    const rawName = (poc.name || '').trim();
    const cleanEntity = this.getDisplayName(entityName).trim();
    const isSynthetic =
      !rawName ||
      rawName.toLowerCase() === 'primary contact' ||
      rawName.toLowerCase() === 'company contact' ||
      (cleanEntity && rawName.toLowerCase() === cleanEntity.toLowerCase()) ||
      (cleanEntity && rawName.toLowerCase() === `${cleanEntity.toLowerCase()} contact`);

    if (isSynthetic) {
      return index === 0 ? 'Primary Contact' : 'Alternate Contact';
    }
    return poc.designation || (index === 0 ? 'Primary POC' : 'Alternate POC');
  }

  protected pocInitials(poc: PointOfContact, entityName?: string | null): string {
    const displayName = this.getPocPersonName(poc, entityName);
    if (!displayName) return 'P';
    const parts = displayName.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }

  protected parseAddress(addr: string | null | undefined): StructuredAddress {
    return parseAddressString(addr);
  }

  protected onCountryChange(countryVal: string | null | undefined): void {
    const cleanCountry = (countryVal || '').trim();
    if (!cleanCountry) return;

    this.locationService.getStates(cleanCountry).subscribe((states) => {
      this.stateOptions.set(states);

      const currentState = (this.supplierForm.get('state')?.value || '').trim();
      if (currentState) {
        const matched = states.find(
          (s) =>
            s.toLowerCase() === currentState.toLowerCase() ||
            s.toLowerCase().includes(currentState.toLowerCase()) ||
            currentState.toLowerCase().includes(s.toLowerCase()),
        );

        if (matched && matched !== currentState) {
          this.supplierForm.patchValue({ state: matched }, { emitEvent: false });
        } else if (!matched) {
          this.supplierForm.patchValue({ state: '', city: '' }, { emitEvent: false });
        }
      }

      const activeState = this.supplierForm.get('state')?.value || '';
      this.locationService.getCities(cleanCountry, activeState).subscribe((cities) => {
        this.cityOptions.set(cities);
      });
    });
  }

  protected onStateChange(stateVal: string | null | undefined): void {
    const cleanState = (stateVal || '').trim();
    if (!cleanState) return;

    const currentCountry = (this.supplierForm.get('country')?.value || '').trim() || 'India';

    this.locationService.getCities(currentCountry, cleanState).subscribe((cities) => {
      this.cityOptions.set(cities);
    });
  }

  protected onCitySelect(cityVal: string | null | undefined): void {
    this.onCityChanged(cityVal);
  }

  protected onCityChanged(cityInput: string | null | undefined): void {
    if (!cityInput || typeof cityInput !== 'string') return;
    const cleanCity = cityInput.trim();
    if (cleanCity.length < 2) return;

    const currentCountry = (this.supplierForm.get('country')?.value || '').trim();
    const currentState = (this.supplierForm.get('state')?.value || '').trim();

    this.locationService.lookupCity(cleanCity, currentCountry, currentState).subscribe((match) => {
      if (match) {
        const patchObj: Record<string, string> = {};

        // Only auto-fill country if user hasn't selected a country yet
        if (!currentCountry && match.country) {
          patchObj['country'] = match.country;
        }

        // Only auto-fill state if state is currently empty
        if (!currentState && match.state) {
          patchObj['state'] = match.state;
        }

        if (Object.keys(patchObj).length > 0) {
          this.supplierForm.patchValue(patchObj, { emitEvent: false });
        }

        const effectiveCountry = this.supplierForm.get('country')?.value || match.country || 'India';
        const effectiveState = this.supplierForm.get('state')?.value || match.state || '';

        if (effectiveCountry) {
          this.locationService.getStates(effectiveCountry).subscribe((states) => {
            let stateList = [...states];
            if (effectiveState && !stateList.includes(effectiveState)) {
              const matched = stateList.find(
                (s) =>
                  s.toLowerCase() === effectiveState.toLowerCase() ||
                  effectiveState.toLowerCase().includes(s.toLowerCase()) ||
                  s.toLowerCase().includes(effectiveState.toLowerCase()),
              );
              if (matched) {
                this.supplierForm.patchValue({ state: matched }, { emitEvent: false });
              } else {
                stateList.unshift(effectiveState);
              }
            }
            this.stateOptions.set(stateList);
          });

          this.locationService.getCities(effectiveCountry, effectiveState).subscribe((cities) => {
            this.cityOptions.set(cities);
          });
        }
      }
    });
  }

  protected onCityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onCityChanged(input?.value);
  }
}
