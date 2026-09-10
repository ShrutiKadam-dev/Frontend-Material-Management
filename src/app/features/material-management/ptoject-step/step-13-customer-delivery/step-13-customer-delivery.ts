import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { CustomerDeliveryService } from '../../../../core/services/customer-delivery';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  CustomerTaxInvoice,
  CustomerTaxInvoiceCreateInput,
  CustomerTaxInvoiceUpdateInput,
  CustomerPackingList,
  CustomerPackingListCreateInput,
  CustomerPackingListUpdateInput,
  CustomerDeliveryChallan,
  CustomerDeliveryChallanCreateInput,
  CustomerDeliveryChallanUpdateInput,
  CustomerWarrantyCertificate,
  CustomerWarrantyCertificateCreateInput,
  CustomerWarrantyCertificateUpdateInput,
  CustomerTransportDetail,
  CustomerTransportDetailCreateInput,
  CustomerTransportDetailUpdateInput,
  DeliveryItem,
  LatestPurchaseOrderTemplate,
  LatestCustomerTaxInvoiceTemplate,
  TransportMode,
} from '../../../../core/models/customer-delivery.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';
import { WARRANTY_PERIOD_OPTIONS } from '../../../../core/constants/dropdown-options.constant';

export type Step13Tab =
  | 'tax-invoice'
  | 'packing-list'
  | 'delivery-challan'
  | 'warranty'
  | 'transport';

@Component({
  selector: 'app-step-13-customer-delivery',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    SelectModule,
    TooltipModule,
    TableModule,
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
  ],
  templateUrl: './step-13-customer-delivery.html',
  styleUrl: './step-13-customer-delivery.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step13CustomerDelivery implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly deliveryService = inject(CustomerDeliveryService);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly attachmentService = inject(AttachmentService);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly activeTab = signal<Step13Tab>('tax-invoice');
  protected readonly projectId = signal<number | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);

  protected readonly taxInvoices = signal<CustomerTaxInvoice[]>([]);
  protected readonly packingLists = signal<CustomerPackingList[]>([]);
  protected readonly deliveryChallans = signal<CustomerDeliveryChallan[]>([]);
  protected readonly warrantyCertificates = signal<CustomerWarrantyCertificate[]>([]);
  protected readonly transportDetails = signal<CustomerTransportDetail[]>([]);

  protected readonly latestPoTemplate = signal<LatestPurchaseOrderTemplate | null>(null);
  protected readonly latestTaxInvoiceTemplate = signal<LatestCustomerTaxInvoiceTemplate | null>(null);
  protected readonly loadingWarrantyReferences = signal(false);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly downloadingAttachmentId = signal<number | null>(null);

  // ── Dialog Visibility States ───────────────────────────────────
  protected readonly invoiceDialogVisible = signal(false);
  protected readonly editingInvoice = signal<CustomerTaxInvoice | null>(null);

  protected readonly packingListDialogVisible = signal(false);
  protected readonly editingPackingList = signal<CustomerPackingList | null>(null);

  protected readonly challanDialogVisible = signal(false);
  protected readonly editingChallan = signal<CustomerDeliveryChallan | null>(null);

  protected readonly warrantyDialogVisible = signal(false);
  protected readonly editingWarranty = signal<CustomerWarrantyCertificate | null>(null);

  protected readonly transportDialogVisible = signal(false);
  protected readonly editingTransport = signal<CustomerTransportDetail | null>(null);

  // ── File Upload Signals for Active Dialog ───────────────────────
  protected readonly selectedFiles = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);

  // ── Options ────────────────────────────────────────────────────
  protected readonly transportModeOptions = [
    { label: 'By Road (Lorry Receipt / L.R.)', value: 'road' },
    { label: 'By Train (Railway Receipt / R.R.)', value: 'train' },
    { label: 'By Air (Airway Bill / AWB)', value: 'air' },
  ];
  protected readonly warrantyPeriodOptions = WARRANTY_PERIOD_OPTIONS;

  // ── 1. Tax Invoice Reactive Form & Items ───────────────────────
  protected readonly invoiceForm = this.fb.group({
    invoice_no: ['', [Validators.required]],
    invoice_date: [null as Date | string | null, [Validators.required]],
    gst_rate: [18, [Validators.required, Validators.min(0)]],
    gst_amount: [0, [Validators.min(0)]],
    round_off: [0],
    net_total: [0, [Validators.required, Validators.min(0)]],
    remark: [''],
  });

  protected readonly invoiceItemsList = signal<DeliveryItem[]>([]);
  protected readonly editingInvoiceItemIdx = signal<number | null>(null);
  protected readonly invoiceRowForm = this.fb.group({
    material_name: ['', [Validators.required]],
    hsn_code: [''],
    quantity: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
    unit_price: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
  });

  protected readonly invoiceSubtotal = computed(() => {
    return this.invoiceItemsList().reduce(
      (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0
    );
  });

  // ── 2. Packing List Reactive Form & Items ──────────────────────
  protected readonly packingListForm = this.fb.group({
    packing_list_no: ['', [Validators.required]],
    packing_list_date: [null as Date | string | null, [Validators.required]],
    total_no_of_packs: [1, [Validators.required, Validators.min(1)]],
    packing_condition: ['', [Validators.required]],
    net_weight: [''],
    gross_weight: [''],
    remark: [''],
  });

  protected readonly packingItemsList = signal<DeliveryItem[]>([]);
  protected readonly editingPackingItemIdx = signal<number | null>(null);
  protected readonly packingRowForm = this.fb.group({
    package_no: [''],
    material_name: ['', [Validators.required]],
    hsn_code: [''],
    quantity: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
    weight: [''],
  });

  protected readonly packingTotalQty = computed(() => {
    return this.packingItemsList().reduce(
      (sum, it) => sum + (Number(it.quantity) || 0),
      0
    );
  });

  protected readonly packingTotalWeight = computed(() => {
    return this.packingItemsList().reduce(
      (sum, it) => sum + (Number(it.weight) || 0),
      0
    );
  });

  // ── 3. Delivery Challan Reactive Form & Items ──────────────────
  protected readonly challanForm = this.fb.group({
    delivery_challan_no: ['', [Validators.required]],
    delivery_challan_date: [null as Date | string | null, [Validators.required]],
    gst_rate: [18, [Validators.required, Validators.min(0)]],
    gst_amount: [0, [Validators.min(0)]],
    round_off: [0],
    net_total: [0, [Validators.required, Validators.min(0)]],
    remark: [''],
  });

  protected readonly challanItemsList = signal<DeliveryItem[]>([]);
  protected readonly editingChallanItemIdx = signal<number | null>(null);
  protected readonly challanRowForm = this.fb.group({
    material_name: ['', [Validators.required]],
    hsn_code: [''],
    quantity: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
    unit_price: ['', [Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
  });

  protected readonly challanSubtotal = computed(() => {
    return this.challanItemsList().reduce(
      (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      0
    );
  });

  protected readonly challanTotalNetValue = this.challanSubtotal;

  // ── 4. Warranty Certificate Reactive Form ──────────────────────
  protected readonly warrantyForm = this.fb.group({
    certificate_date: [null as Date | string | null, [Validators.required]],
    warranty_period: ['', [Validators.required]],
    po_no: ['', [Validators.required]],
    po_date: [null as Date | string | null, [Validators.required]],
    invoice_no: ['', [Validators.required]],
    invoice_date: [null as Date | string | null, [Validators.required]],
    remark: [''],
  });

  // ── 5. Transport Details Reactive Form ─────────────────────────
  protected readonly transportForm = this.fb.group({
    transport_mode: ['road' as TransportMode, [Validators.required]],
    lr_no: [''],
    rr_no: [''],
    awb_no: [''],
    date: [null as Date | string | null, [Validators.required]],
    from_location: ['', [Validators.required]],
    to_location: ['', [Validators.required]],
    transport_charges: [0, [Validators.min(0)]],
    remark: [''],
  });

  // ── Computed Top Metrics ───────────────────────────────────────
  protected readonly totalInvoicedAmount = computed(() => {
    return this.taxInvoices().reduce((sum, inv) => sum + (Number(inv.net_total) || 0), 0);
  });

  protected readonly totalPacksDispatched = computed(() => {
    return this.packingLists().reduce((sum, p) => sum + (Number(p.total_no_of_packs) || 0), 0);
  });

  protected readonly totalTransportCharges = computed(() => {
    return this.transportDetails().reduce((sum, t) => sum + (Number(t.transport_charges) || 0), 0);
  });

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('projectId');
    const id = rawId ? Number(rawId) : null;
    if (!id || isNaN(id)) {
      this.errorMessage.set('Invalid Project ID.');
      this.loading.set(false);
      return;
    }

    this.projectId.set(id);

    // Watch dynamic transport mode changes
    this.transportForm.get('transport_mode')?.valueChanges.subscribe((mode) => {
      if (mode === 'road') {
        this.transportForm.get('lr_no')?.setValidators([Validators.required]);
        this.transportForm.get('rr_no')?.clearValidators();
        this.transportForm.get('awb_no')?.clearValidators();
      } else if (mode === 'train') {
        this.transportForm.get('rr_no')?.setValidators([Validators.required]);
        this.transportForm.get('lr_no')?.clearValidators();
        this.transportForm.get('awb_no')?.clearValidators();
      } else if (mode === 'air') {
        this.transportForm.get('awb_no')?.setValidators([Validators.required]);
        this.transportForm.get('lr_no')?.clearValidators();
        this.transportForm.get('rr_no')?.clearValidators();
      }
      this.transportForm.get('lr_no')?.updateValueAndValidity();
      this.transportForm.get('rr_no')?.updateValueAndValidity();
      this.transportForm.get('awb_no')?.updateValueAndValidity();
    });

    // Auto-calculate Tax Invoice and Delivery Challan totals when items or GST rate changes
    this.invoiceForm.get('gst_rate')?.valueChanges.subscribe(() => this.recalculateInvoiceTotals());
    this.challanForm.get('gst_rate')?.valueChanges.subscribe(() => this.recalculateChallanTotals());

    this.loadProject(id);
    this.loadAllStep13Data(id);
    this.loadLatestPurchaseOrderTemplate(id);
    this.loadLatestCustomerTaxInvoiceTemplate(id);
  }

  protected goBack(): void {
    const pId = this.projectId();
    if (pId) {
      this.router.navigate(['/projects', pId, 'steps']);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  protected selectTab(tab: Step13Tab): void {
    this.activeTab.set(tab);
  }

  private loadProject(projectId: number): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (p) => {
        this.project.set(p);
        if (p.customer_id) {
          this.customerService.getCustomerById(p.customer_id).subscribe({
            next: (c) => this.customer.set(c),
            error: () => { },
          });
        }
      },
      error: () => { },
    });
  }

  private loadLatestPurchaseOrderTemplate(projectId: number): void {
    this.deliveryService.getLatestPurchaseOrder(projectId).subscribe({
      next: (po) => {
        if (po) {
          this.latestPoTemplate.set(po);
        }
      },
      error: () => { },
    });
  }

  private loadLatestCustomerTaxInvoiceTemplate(projectId: number): void {
    this.deliveryService.getLatestCustomerTaxInvoice(projectId).subscribe({
      next: (inv) => {
        if (inv) {
          this.latestTaxInvoiceTemplate.set(inv);
        }
      },
      error: () => { },
    });
  }

  protected loadAllStep13Data(projectId?: number): void {
    const pId = projectId ?? this.projectId();
    if (!pId) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.deliveryService.getTaxInvoices(pId).subscribe({
      next: (data) => this.taxInvoices.set(data),
      error: () => { },
    });

    this.deliveryService.getPackingLists(pId).subscribe({
      next: (data) => this.packingLists.set(data),
      error: () => { },
    });

    this.deliveryService.getDeliveryChallans(pId).subscribe({
      next: (data) => this.deliveryChallans.set(data),
      error: () => { },
    });

    this.deliveryService.getWarrantyCertificates(pId).subscribe({
      next: (data) => this.warrantyCertificates.set(data),
      error: () => { },
    });

    this.deliveryService
      .getTransportDetails(pId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.transportDetails.set(data),
        error: () => { },
      });
  }

  // ════════════════════════════════════════════════════════════════
  // 1. TAX INVOICE ACTIONS & FORM MANAGEMENT
  // ════════════════════════════════════════════════════════════════
  protected openCreateInvoiceDialog(): void {
    this.editingInvoice.set(null);
    this.selectedFiles.set([]);
    this.existingAttachments.set([]);
    this.editingInvoiceItemIdx.set(null);
    this.invoiceRowForm.reset();

    const po = this.latestPoTemplate();
    const gstRate = po?.gst_rate ?? 18;

    this.invoiceForm.reset({
      invoice_no: '',
      invoice_date: '',
      gst_rate: gstRate,
      gst_amount: 0,
      round_off: 0,
      net_total: 0,
      remark: '',
    });

    // Auto-patch items from PO or start empty
    if (po && po.items && po.items.length > 0) {
      const mapped: DeliveryItem[] = po.items.map((item) => ({
        material_name: item.material_name,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit_price: item.unit_price,
        net_amount: item.net_amount || item.quantity * item.unit_price,
      }));
      this.invoiceItemsList.set(mapped);
    } else {
      this.invoiceItemsList.set([]);
    }

    this.recalculateInvoiceTotals();
    this.invoiceDialogVisible.set(true);
  }

  protected openEditInvoiceDialog(inv: CustomerTaxInvoice): void {
    this.editingInvoice.set(inv);
    this.selectedFiles.set([]);
    this.existingAttachments.set(inv.attachments || []);
    this.editingInvoiceItemIdx.set(null);
    this.invoiceRowForm.reset();

    this.invoiceForm.patchValue({
      invoice_no: inv.invoice_no,
      invoice_date: inv.invoice_date ? new Date(inv.invoice_date) : null,
      gst_rate: inv.gst_rate ?? 18,
      gst_amount: inv.gst_amount ?? 0,
      round_off: inv.round_off ?? 0,
      net_total: inv.net_total ?? 0,
      remark: inv.remark || '',
    });

    this.invoiceItemsList.set(inv.items || []);
    this.recalculateInvoiceTotals();
    this.invoiceDialogVisible.set(true);
  }

  protected openEditInvoiceRow(index: number, focusTarget?: HTMLInputElement): void {
    const item = this.invoiceItemsList()[index];
    this.invoiceRowForm.setValue({
      material_name: item.material_name || '',
      hsn_code: item.hsn_code || '',
      quantity: String(item.quantity || ''),
      unit_price: String(item.unit_price || ''),
    });
    this.editingInvoiceItemIdx.set(index);
    if (focusTarget) {
      focusTarget.focus();
    }
  }

  protected saveInvoiceRow(focusTarget?: HTMLInputElement): void {
    if (this.invoiceRowForm.invalid) {
      Object.values(this.invoiceRowForm.controls).forEach((ctrl) => {
        ctrl.markAsDirty();
        ctrl.markAsTouched();
      });
      return;
    }

    const val = this.invoiceRowForm.getRawValue();
    const name = (val.material_name || '').trim();
    const hsn = (val.hsn_code || '').trim();
    const qty = parseFloat(val.quantity || '0');
    const unitPrice = parseFloat(val.unit_price || '0');
    const net = qty * unitPrice;

    const newItem: DeliveryItem = {
      material_name: name,
      hsn_code: hsn,
      quantity: qty,
      unit_price: unitPrice,
      net_amount: net,
    };

    const idx = this.editingInvoiceItemIdx();
    if (idx !== null) {
      const updated = [...this.invoiceItemsList()];
      const existing = updated[idx];
      updated[idx] = {
        ...existing,
        ...newItem,
      };
      this.invoiceItemsList.set(updated);
      this.editingInvoiceItemIdx.set(null);
    } else {
      this.invoiceItemsList.update((list) => [...list, newItem]);
    }

    this.invoiceRowForm.reset();
    this.recalculateInvoiceTotals();
    if (focusTarget) {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  protected cancelInvoiceRow(): void {
    this.editingInvoiceItemIdx.set(null);
    this.invoiceRowForm.reset();
  }

  protected deleteInvoiceRow(index: number): void {
    this.invoiceItemsList.update((list) => list.filter((_, i) => i !== index));
    if (this.editingInvoiceItemIdx() === index) {
      this.cancelInvoiceRow();
    }
    this.recalculateInvoiceTotals();
  }

  protected calculateInvoiceItemNet(item: DeliveryItem): number {
    return (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }

  protected recalculateInvoiceTotals(): void {
    const subtotal = this.invoiceSubtotal();
    const gstRate = Number(this.invoiceForm.get('gst_rate')?.value) || 0;
    const gstAmount = (subtotal * gstRate) / 100;
    const exactTotal = subtotal + gstAmount;
    const roundedTotal = Math.round(exactTotal);
    const roundOff = parseFloat((roundedTotal - exactTotal).toFixed(2));

    this.invoiceForm.patchValue(
      {
        gst_amount: parseFloat(gstAmount.toFixed(2)),
        round_off: roundOff,
        net_total: roundedTotal,
      },
      { emitEvent: false },
    );
  }

  protected onSubmitInvoice(): void {
    if (this.saving()) return;
    if (this.invoiceForm.invalid || this.invoiceItemsList().length === 0) {
      this.invoiceForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const formVal = this.invoiceForm.getRawValue();
    const dateStr = formVal.invoice_date instanceof Date
      ? this.formatDate(formVal.invoice_date)
      : String(formVal.invoice_date);

    const payload: CustomerTaxInvoiceCreateInput = {
      project_id: pId,
      invoice_no: formVal.invoice_no || '',
      invoice_date: dateStr,
      gst_rate: Number(formVal.gst_rate) || 0,
      gst_amount: Number(formVal.gst_amount) || 0,
      round_off: Number(formVal.round_off) || 0,
      net_total: Number(formVal.net_total) || 0,
      remark: formVal.remark || undefined,
      items: this.invoiceItemsList(),
    };

    const files = this.selectedFiles();
    const existing = this.editingInvoice();

    if (existing) {
      this.deliveryService
        .updateTaxInvoice(existing.id, payload as CustomerTaxInvoiceUpdateInput, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.invoiceDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to update tax invoice', err),
        });
    } else {
      this.deliveryService
        .createTaxInvoice(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.invoiceDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to create tax invoice', err),
        });
    }
  }

  protected calculateInvoiceSubtotal(inv: CustomerTaxInvoice): number {
    if (!inv.items || !inv.items.length) return 0;
    return inv.items.reduce(
      (sum, it) =>
        sum +
        (Number(it.net_amount) ||
          (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)),
      0,
    );
  }

  protected calculateChallanSubtotal(dc: CustomerDeliveryChallan): number {
    if (!dc.items || !dc.items.length) return 0;
    return dc.items.reduce(
      (sum, it) =>
        sum +
        (Number(it.net_amount) ||
          (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)),
      0,
    );
  }

  protected calculateChallanGstAmount(dc: CustomerDeliveryChallan): number {
    if (dc.gst_amount !== undefined && dc.gst_amount !== null && !isNaN(Number(dc.gst_amount))) {
      return Number(dc.gst_amount);
    }
    const sub = this.calculateChallanSubtotal(dc);
    const rate = Number(dc.gst_rate ?? 18);
    return Number(((sub * rate) / 100).toFixed(2));
  }

  protected calculateChallanNetTotal(dc: CustomerDeliveryChallan): number {
    if (dc.net_total !== undefined && dc.net_total !== null && !isNaN(Number(dc.net_total)) && dc.net_total > 0) {
      return Number(dc.net_total);
    }
    const sub = this.calculateChallanSubtotal(dc);
    const gst = this.calculateChallanGstAmount(dc);
    const round = Number(dc.round_off || 0);
    return Number((sub + gst + round).toFixed(2));
  }

  protected calculateChallanTotal(dc: CustomerDeliveryChallan): number {
    return this.calculateChallanNetTotal(dc);
  }

  protected calculatePackingTotalQty(pl: CustomerPackingList): number {
    if (!pl.items || !pl.items.length) return 0;
    return pl.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }

  protected deleteInvoice(item: CustomerTaxInvoice): void {
    if (!confirm(`Are you sure you want to delete Tax Invoice #${item.invoice_no}?`)) return;
    this.deliveryService.deleteTaxInvoice(item.id).subscribe({
      next: () => this.loadAllStep13Data(),
      error: (err) => console.error('Failed to delete tax invoice', err),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 2. PACKING LIST ACTIONS & FORM MANAGEMENT
  // ════════════════════════════════════════════════════════════════
  protected openCreatePackingListDialog(): void {
    this.editingPackingList.set(null);
    this.selectedFiles.set([]);
    this.existingAttachments.set([]);
    this.editingPackingItemIdx.set(null);
    this.packingRowForm.reset({ package_no: 'Box #1' });

    const po = this.latestPoTemplate();

    this.packingListForm.reset({
      packing_list_no: '',
      packing_list_date: '',
      total_no_of_packs: 0,
      packing_condition: '',
      net_weight: '',
      gross_weight: '',
      remark: '',
    });

    if (po && po.items && po.items.length > 0) {
      const mapped: DeliveryItem[] = po.items.map((item, idx) => ({
        package_no: `Box #${idx + 1}`,
        material_name: item.material_name,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        weight: 0,
      }));
      this.packingItemsList.set(mapped);
    } else {
      this.packingItemsList.set([]);
    }

    this.packingListDialogVisible.set(true);
  }

  protected openEditPackingListDialog(pl: CustomerPackingList): void {
    this.editingPackingList.set(pl);
    this.selectedFiles.set([]);
    this.existingAttachments.set(pl.attachments || []);
    this.editingPackingItemIdx.set(null);
    this.packingRowForm.reset({ package_no: 'Box #1' });

    this.packingListForm.patchValue({
      packing_list_no: pl.packing_list_no,
      packing_list_date: pl.packing_list_date ? new Date(pl.packing_list_date) : null,
      total_no_of_packs: pl.total_no_of_packs || 1,
      packing_condition: pl.packing_condition,
      net_weight: pl.net_weight !== undefined ? String(pl.net_weight) : '',
      gross_weight: pl.gross_weight !== undefined ? String(pl.gross_weight) : '',
      remark: pl.remark || '',
    });

    this.packingItemsList.set(pl.items || []);
    this.packingListDialogVisible.set(true);
  }

  protected openEditPackingRow(index: number, focusTarget?: HTMLInputElement): void {
    const item = this.packingItemsList()[index];
    this.packingRowForm.setValue({
      package_no: item.package_no || `Box #${index + 1}`,
      material_name: item.material_name || '',
      hsn_code: item.hsn_code || '',
      quantity: String(item.quantity || ''),
      weight: item.weight !== undefined && item.weight !== null ? String(item.weight) : '',
    });
    this.editingPackingItemIdx.set(index);
    if (focusTarget) {
      focusTarget.focus();
    }
  }

  protected savePackingRow(focusTarget?: HTMLInputElement): void {
    if (this.packingRowForm.invalid) {
      Object.values(this.packingRowForm.controls).forEach((ctrl) => {
        ctrl.markAsDirty();
        ctrl.markAsTouched();
      });
      return;
    }

    const val = this.packingRowForm.getRawValue();
    const pkgNo = (val.package_no || '').trim() || `Box #${this.packingItemsList().length + 1}`;
    const name = (val.material_name || '').trim();
    const hsn = (val.hsn_code || '').trim();
    const qty = parseFloat(val.quantity || '0');
    const wt = val.weight ? parseFloat(val.weight) : 0;

    const newItem: DeliveryItem = {
      package_no: pkgNo,
      material_name: name,
      hsn_code: hsn,
      quantity: qty,
      weight: wt,
    };

    const idx = this.editingPackingItemIdx();
    if (idx !== null) {
      const updated = [...this.packingItemsList()];
      const existing = updated[idx];
      updated[idx] = {
        ...existing,
        ...newItem,
      };
      this.packingItemsList.set(updated);
      this.editingPackingItemIdx.set(null);
    } else {
      this.packingItemsList.update((list) => [...list, newItem]);
    }

    this.packingRowForm.reset({ package_no: `Box #${this.packingItemsList().length + 1}` });
    if (focusTarget) {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  protected cancelPackingRow(): void {
    this.editingPackingItemIdx.set(null);
    this.packingRowForm.reset({ package_no: `Box #${this.packingItemsList().length + 1}` });
  }

  protected deletePackingRow(index: number): void {
    this.packingItemsList.update((list) => list.filter((_, i) => i !== index));
    if (this.editingPackingItemIdx() === index) {
      this.cancelPackingRow();
    }
  }

  protected onSubmitPackingList(): void {
    if (this.saving()) return;
    if (this.packingListForm.invalid || this.packingItemsList().length === 0) {
      this.packingListForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const formVal = this.packingListForm.getRawValue();
    const dateStr = formVal.packing_list_date instanceof Date
      ? this.formatDate(formVal.packing_list_date)
      : String(formVal.packing_list_date);

    const payload: CustomerPackingListCreateInput = {
      project_id: pId,
      packing_list_no: formVal.packing_list_no || '',
      packing_list_date: dateStr,
      total_no_of_packs: Number(formVal.total_no_of_packs) || 1,
      packing_condition: formVal.packing_condition || '',
      net_weight: formVal.net_weight || '',
      gross_weight: formVal.gross_weight || '',
      remark: formVal.remark || undefined,
      items: this.packingItemsList(),
    };

    const files = this.selectedFiles();
    const existing = this.editingPackingList();

    if (existing) {
      this.deliveryService
        .updatePackingList(existing.id, payload as CustomerPackingListUpdateInput, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.packingListDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to update packing list', err),
        });
    } else {
      this.deliveryService
        .createPackingList(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.packingListDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to create packing list', err),
        });
    }
  }

  protected deletePackingList(item: CustomerPackingList): void {
    if (!confirm(`Are you sure you want to delete Packing List #${item.packing_list_no}?`)) return;
    this.deliveryService.deletePackingList(item.id).subscribe({
      next: () => this.loadAllStep13Data(),
      error: (err) => console.error('Failed to delete packing list', err),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 3. DELIVERY CHALLAN ACTIONS & FORM MANAGEMENT
  // ════════════════════════════════════════════════════════════════
  protected openCreateChallanDialog(): void {
    this.editingChallan.set(null);
    this.selectedFiles.set([]);
    this.existingAttachments.set([]);
    this.editingChallanItemIdx.set(null);
    this.challanRowForm.reset();

    const po = this.latestPoTemplate();
    const defaultGstRate = po?.gst_rate !== undefined && po?.gst_rate !== null ? po.gst_rate : 18;

    this.challanForm.reset({
      delivery_challan_no: '',
      delivery_challan_date: '',
      gst_rate: defaultGstRate,
      gst_amount: 0,
      round_off: 0,
      net_total: 0,
      remark: '',
    });

    if (po && po.items && po.items.length > 0) {
      const mapped: DeliveryItem[] = po.items.map((item) => ({
        material_name: item.material_name,
        hsn_code: item.hsn_code,
        quantity: item.quantity,
        unit_price: item.unit_price,
        net_amount: item.net_amount || item.quantity * item.unit_price,
      }));
      this.challanItemsList.set(mapped);
    } else {
      this.challanItemsList.set([]);
    }

    this.recalculateChallanTotals();
    this.challanDialogVisible.set(true);
  }

  protected openEditChallanDialog(dc: CustomerDeliveryChallan): void {
    this.editingChallan.set(dc);
    this.selectedFiles.set([]);
    this.existingAttachments.set(dc.attachments || []);
    this.editingChallanItemIdx.set(null);
    this.challanRowForm.reset();

    this.challanForm.patchValue({
      delivery_challan_no: dc.delivery_challan_no,
      delivery_challan_date: dc.delivery_challan_date ? new Date(dc.delivery_challan_date) : null,
      gst_rate: dc.gst_rate ?? 18,
      gst_amount: dc.gst_amount ?? 0,
      round_off: dc.round_off ?? 0,
      net_total: dc.net_total ?? 0,
      remark: dc.remark || '',
    });

    this.challanItemsList.set(dc.items || []);
    this.recalculateChallanTotals();
    this.challanDialogVisible.set(true);
  }

  protected openEditChallanRow(index: number, focusTarget?: HTMLInputElement): void {
    const item = this.challanItemsList()[index];
    this.challanRowForm.setValue({
      material_name: item.material_name || '',
      hsn_code: item.hsn_code || '',
      quantity: String(item.quantity || ''),
      unit_price: item.unit_price !== undefined && item.unit_price !== null ? String(item.unit_price) : '0',
    });
    this.editingChallanItemIdx.set(index);
    if (focusTarget) {
      focusTarget.focus();
    }
  }

  protected saveChallanRow(focusTarget?: HTMLInputElement): void {
    if (this.challanRowForm.invalid) {
      Object.values(this.challanRowForm.controls).forEach((ctrl) => {
        ctrl.markAsDirty();
        ctrl.markAsTouched();
      });
      return;
    }

    const val = this.challanRowForm.getRawValue();
    const name = (val.material_name || '').trim();
    const hsn = (val.hsn_code || '').trim();
    const qty = parseFloat(val.quantity || '0');
    const unitPrice = val.unit_price ? parseFloat(val.unit_price) : 0;
    const net = qty * unitPrice;

    const newItem: DeliveryItem = {
      material_name: name,
      hsn_code: hsn,
      quantity: qty,
      unit_price: unitPrice,
      net_amount: net,
    };

    const idx = this.editingChallanItemIdx();
    if (idx !== null) {
      const updated = [...this.challanItemsList()];
      const existing = updated[idx];
      updated[idx] = {
        ...existing,
        ...newItem,
      };
      this.challanItemsList.set(updated);
      this.editingChallanItemIdx.set(null);
    } else {
      this.challanItemsList.update((list) => [...list, newItem]);
    }

    this.challanRowForm.reset();
    this.recalculateChallanTotals();
    if (focusTarget) {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  protected cancelChallanRow(): void {
    this.editingChallanItemIdx.set(null);
    this.challanRowForm.reset();
  }

  protected deleteChallanRow(index: number): void {
    this.challanItemsList.update((list) => list.filter((_, i) => i !== index));
    if (this.editingChallanItemIdx() === index) {
      this.cancelChallanRow();
    }
    this.recalculateChallanTotals();
  }

  protected calculateChallanItemNet(item: DeliveryItem): number {
    return (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }

  protected recalculateChallanTotals(): void {
    const subtotal = this.challanSubtotal();
    const gstRate = Number(this.challanForm.get('gst_rate')?.value) || 0;
    const gstAmount = (subtotal * gstRate) / 100;
    const exactTotal = subtotal + gstAmount;
    const roundedTotal = Math.round(exactTotal);
    const roundOff = parseFloat((roundedTotal - exactTotal).toFixed(2));

    this.challanForm.patchValue(
      {
        gst_amount: parseFloat(gstAmount.toFixed(2)),
        round_off: roundOff,
        net_total: roundedTotal,
      },
      { emitEvent: false },
    );
  }

  protected onSubmitChallan(): void {
    if (this.saving()) return;
    if (this.challanForm.invalid || this.challanItemsList().length === 0) {
      this.challanForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const formVal = this.challanForm.getRawValue();
    const dateStr = formVal.delivery_challan_date instanceof Date
      ? this.formatDate(formVal.delivery_challan_date)
      : String(formVal.delivery_challan_date);

    const payload: CustomerDeliveryChallanCreateInput = {
      project_id: pId,
      delivery_challan_no: formVal.delivery_challan_no || '',
      delivery_challan_date: dateStr,
      gst_rate: Number(formVal.gst_rate) || 0,
      gst_amount: Number(formVal.gst_amount) || 0,
      round_off: Number(formVal.round_off) || 0,
      net_total: Number(formVal.net_total) || 0,
      remark: formVal.remark || undefined,
      items: this.challanItemsList(),
    };

    const files = this.selectedFiles();
    const existing = this.editingChallan();

    if (existing) {
      this.deliveryService
        .updateDeliveryChallan(existing.id, payload as CustomerDeliveryChallanUpdateInput, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.challanDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to update delivery challan', err),
        });
    } else {
      this.deliveryService
        .createDeliveryChallan(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.challanDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to create delivery challan', err),
        });
    }
  }

  protected deleteChallan(item: CustomerDeliveryChallan): void {
    if (!confirm(`Are you sure you want to delete Delivery Challan #${item.delivery_challan_no}?`)) return;
    this.deliveryService.deleteDeliveryChallan(item.id).subscribe({
      next: () => this.loadAllStep13Data(),
      error: (err) => console.error('Failed to delete delivery challan', err),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 4. WARRANTY CERTIFICATE ACTIONS & FORM MANAGEMENT
  // ════════════════════════════════════════════════════════════════
  protected openCreateWarrantyDialog(): void {
    this.editingWarranty.set(null);
    this.selectedFiles.set([]);
    this.existingAttachments.set([]);

    const po = this.latestPoTemplate();
    const latestInv = this.latestTaxInvoiceTemplate() || (this.taxInvoices().length ? this.taxInvoices()[0] : null);

    const poNo = po?.po_number || po?.po_no || '';
    const poDateVal = this.parseDateSafe(po?.po_date);
    const invNo = latestInv?.invoice_no || '';
    const invDateVal = this.parseDateSafe(latestInv?.invoice_date);

    this.warrantyForm.reset({
      certificate_date: new Date(),
      warranty_period: po?.warranty_period || '',
      po_no: poNo,
      po_date: poDateVal,
      invoice_no: invNo,
      invoice_date: invDateVal,
      remark: '',
    });

    const pId = this.projectId();
    if (pId) {
      this.fetchAndPatchLatestWarrantyReferences(pId);
    }

    this.warrantyDialogVisible.set(true);
  }

  protected fetchAndPatchLatestWarrantyReferences(projectId: number): void {
    this.loadingWarrantyReferences.set(true);

    // 1. Fetch Latest Purchase Order (po_number, po_date, warranty_period)
    this.deliveryService.getLatestPurchaseOrder(projectId).subscribe({
      next: (po) => {
        if (po) {
          this.latestPoTemplate.set(po);
          if (!this.editingWarranty()) {
            const poNo = po.po_number || po.po_no || '';
            const poDate = this.parseDateSafe(po.po_date);
            const currentVal = this.warrantyForm.getRawValue();

            this.warrantyForm.patchValue({
              ...(poNo && !currentVal.po_no ? { po_no: poNo } : {}),
              ...(poDate && !currentVal.po_date ? { po_date: poDate } : {}),
              ...(po.warranty_period && !currentVal.warranty_period ? { warranty_period: po.warranty_period } : {}),
            });
          }
        }
      },
      error: () => { },
    });

    // 2. Fetch Latest Customer Tax Invoice (invoice_no, invoice_date, net_total)
    this.deliveryService
      .getLatestCustomerTaxInvoice(projectId)
      .pipe(finalize(() => this.loadingWarrantyReferences.set(false)))
      .subscribe({
        next: (inv) => {
          if (inv) {
            this.latestTaxInvoiceTemplate.set(inv);
            if (!this.editingWarranty()) {
              const invNo = inv.invoice_no || '';
              const invDate = this.parseDateSafe(inv.invoice_date);
              const currentVal = this.warrantyForm.getRawValue();

              this.warrantyForm.patchValue({
                ...(invNo && !currentVal.invoice_no ? { invoice_no: invNo } : {}),
                ...(invDate && !currentVal.invoice_date ? { invoice_date: invDate } : {}),
              });
            }
          }
        },
        error: () => { },
      });
  }

  protected openEditWarrantyDialog(wc: CustomerWarrantyCertificate): void {
    this.editingWarranty.set(wc);
    this.selectedFiles.set([]);
    this.existingAttachments.set(wc.attachments || []);

    this.warrantyForm.patchValue({
      certificate_date: this.parseDateSafe(wc.certificate_date),
      warranty_period: wc.warranty_period,
      po_no: wc.po_no,
      po_date: this.parseDateSafe(wc.po_date),
      invoice_no: wc.invoice_no,
      invoice_date: this.parseDateSafe(wc.invoice_date),
      remark: wc.remark || '',
    });

    this.warrantyDialogVisible.set(true);
  }

  protected onSubmitWarranty(): void {
    if (this.saving()) return;
    if (this.warrantyForm.invalid) {
      this.warrantyForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const formVal = this.warrantyForm.getRawValue();

    const certDateStr = formVal.certificate_date instanceof Date
      ? this.formatDate(formVal.certificate_date)
      : String(formVal.certificate_date);
    const poDateStr = formVal.po_date instanceof Date
      ? this.formatDate(formVal.po_date)
      : String(formVal.po_date);
    const invDateStr = formVal.invoice_date instanceof Date
      ? this.formatDate(formVal.invoice_date)
      : String(formVal.invoice_date);

    const payload: CustomerWarrantyCertificateCreateInput = {
      project_id: pId,
      certificate_date: certDateStr,
      warranty_period: formVal.warranty_period || '',
      po_no: formVal.po_no || '',
      po_date: poDateStr,
      invoice_no: formVal.invoice_no || '',
      invoice_date: invDateStr,
      remark: formVal.remark || undefined,
    };

    const files = this.selectedFiles();
    const existing = this.editingWarranty();

    if (existing) {
      this.deliveryService
        .updateWarrantyCertificate(existing.id, payload as CustomerWarrantyCertificateUpdateInput, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.warrantyDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to update warranty certificate', err),
        });
    } else {
      this.deliveryService
        .createWarrantyCertificate(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.warrantyDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to create warranty certificate', err),
        });
    }
  }

  protected deleteWarranty(item: CustomerWarrantyCertificate): void {
    if (!confirm(`Are you sure you want to delete Warranty Certificate for Invoice #${item.invoice_no}?`)) return;
    this.deliveryService.deleteWarrantyCertificate(item.id).subscribe({
      next: () => this.loadAllStep13Data(),
      error: (err) => console.error('Failed to delete warranty certificate', err),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // 5. TRANSPORT DETAILS ACTIONS & FORM MANAGEMENT
  // ════════════════════════════════════════════════════════════════
  protected openCreateTransportDialog(): void {
    this.editingTransport.set(null);
    this.selectedFiles.set([]);
    this.existingAttachments.set([]);

    this.transportForm.reset({
      transport_mode: 'road',
      lr_no: '',
      rr_no: '',
      awb_no: '',
      date: '',
      from_location: '',
      to_location: '',
      transport_charges: 0,
      remark: '',
    });

    this.transportDialogVisible.set(true);
  }

  protected openEditTransportDialog(td: CustomerTransportDetail): void {
    this.editingTransport.set(td);
    this.selectedFiles.set([]);
    this.existingAttachments.set(td.attachments || []);

    this.transportForm.patchValue({
      transport_mode: td.transport_mode,
      lr_no: td.lr_no || '',
      rr_no: td.rr_no || '',
      awb_no: td.awb_no || '',
      date: td.date ? new Date(td.date) : null,
      from_location: td.from_location,
      to_location: td.to_location,
      transport_charges: td.transport_charges ?? 0,
      remark: td.remark || '',
    });

    this.transportDialogVisible.set(true);
  }

  protected onSubmitTransport(): void {
    if (this.saving()) return;
    if (this.transportForm.invalid) {
      this.transportForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const formVal = this.transportForm.getRawValue();
    const dateStr = formVal.date instanceof Date
      ? this.formatDate(formVal.date)
      : String(formVal.date);

    const payload: CustomerTransportDetailCreateInput = {
      project_id: pId,
      transport_mode: formVal.transport_mode as TransportMode,
      lr_no: formVal.lr_no || undefined,
      rr_no: formVal.rr_no || undefined,
      awb_no: formVal.awb_no || undefined,
      date: dateStr,
      from_location: formVal.from_location || '',
      to_location: formVal.to_location || '',
      transport_charges: Number(formVal.transport_charges) || 0,
      remark: formVal.remark || undefined,
    };

    const files = this.selectedFiles();
    const existing = this.editingTransport();

    if (existing) {
      this.deliveryService
        .updateTransportDetail(existing.id, payload as CustomerTransportDetailUpdateInput, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.transportDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to update transport details', err),
        });
    } else {
      this.deliveryService
        .createTransportDetail(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.transportDialogVisible.set(false);
            this.loadAllStep13Data();
          },
          error: (err) => console.error('Failed to create transport details', err),
        });
    }
  }

  protected deleteTransport(item: CustomerTransportDetail): void {
    if (!confirm(`Are you sure you want to delete Transport record #${item.id}?`)) return;
    this.deliveryService.deleteTransportDetail(item.id).subscribe({
      next: () => this.loadAllStep13Data(),
      error: (err) => console.error('Failed to delete transport details', err),
    });
  }

  // ════════════════════════════════════════════════════════════════
  // FILE UPLOADS & ATTACHMENT DOWNLOADS
  // ════════════════════════════════════════════════════════════════
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      this.selectedFiles.update((curr) => [...curr, ...newFiles]);
      input.value = '';
    }
  }

  protected removeFile(index: number): void {
    this.selectedFiles.update((list) => list.filter((_, i) => i !== index));
  }

  protected downloadAttachment(att: Attachment): void {
    if (!att || !att.id) return;
    this.downloadingAttachmentId.set(att.id);
    this.attachmentService
      .downloadAttachment(att.id)
      .pipe(finalize(() => this.downloadingAttachmentId.set(null)))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.file_name || 'delivery-document';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err) => console.error('Failed to download attachment', err),
      });
  }

  // ── Helper Resolvers ───────────────────────────────────────────
  protected formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  protected getFileIcon(contentType?: string): string {
    if (!contentType) return 'pi pi-file';
    if (contentType.includes('pdf')) return 'pi pi-file-pdf';
    if (contentType.includes('image')) return 'pi pi-image';
    if (
      contentType.includes('sheet') ||
      contentType.includes('excel') ||
      contentType.includes('csv')
    ) {
      return 'pi pi-file-excel';
    }
    if (contentType.includes('word') || contentType.includes('document')) {
      return 'pi pi-file-word';
    }
    return 'pi pi-file';
  }

  protected isFieldInvalid(form: FormGroup, controlName: string): boolean {
    const c = form.get(controlName);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  protected getFieldError(form: FormGroup, controlName: string): string | null {
    const c = form.get(controlName);
    if (!c || !c.errors || !(c.dirty || c.touched)) return null;
    if (c.hasError('required')) return 'This field is required.';
    if (c.hasError('min')) return 'Value must be greater than 0.';
    return 'Invalid field value.';
  }

  protected isRowFieldInvalid(form: FormGroup, controlName: string): boolean {
    const c = form.get(controlName);
    return !!(c && c.invalid && c.dirty);
  }

  protected getRowFieldError(form: FormGroup, controlName: string): string | null {
    const c = form.get(controlName);
    if (!c || !c.errors || !(c.dirty || c.touched)) return null;
    if (c.hasError('required')) return 'Required';
    if (c.hasError('pattern')) return 'Enter a valid number';
    return 'Invalid';
  }

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  protected parseDateSafe(val: string | Date | null | undefined): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return null;
      const parts = trimmed.split(/[-T/ ]/);
      if (parts.length >= 3) {
        if (parts[0].length === 4) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          return new Date(year, month, day);
        }
        if (parts[2].length === 4) {
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day);
        }
      }
      const parsed = new Date(trimmed);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }
}
