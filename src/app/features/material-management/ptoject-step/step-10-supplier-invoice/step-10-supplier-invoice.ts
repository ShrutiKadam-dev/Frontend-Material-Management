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
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { OrderConfirmationService } from '../../../../core/services/order-confirmation';
import { ProformaInvoiceService } from '../../../../core/services/proforma-invoice';
import { SupplierInvoiceService } from '../../../../core/services/supplier-invoice';
import { PackingListService } from '../../../../core/services/packing-list';
import { CustomerService } from '../../../../core/services/customer';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import { DropdownService } from '../../../../core/services/dropdown.service';

import { LatestOrderConfirmation } from '../../../../core/models/order-confirmation.model';
import {
  ProformaInvoice,
  ProformaInvoiceCreateInput,
  ProformaInvoiceItem,
  ProformaInvoiceUpdateInput,
} from '../../../../core/models/proforma-invoice.model';
import {
  SupplierInvoice,
  SupplierInvoiceCreateInput,
  SupplierInvoiceItem,
  SupplierInvoiceUpdateInput,
} from '../../../../core/models/supplier-invoice.model';
import {
  PackingList,
  PackingListCreateInput,
  PackingListItem,
  PackingListUpdateInput,
} from '../../../../core/models/packing-list.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';
import {
  CURRENCY_OPTIONS,
  INCOTERMS_OPTIONS,
  VALIDITY_UNIT_OPTIONS,
} from '../../../../core/constants/dropdown-options.constant';

export type SubStepType = 'proforma' | 'invoice' | 'packing-list';

@Component({
  selector: 'app-step-10-supplier-invoice',
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
  ],
  templateUrl: './step-10-supplier-invoice.html',
  styleUrl: './step-10-supplier-invoice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step10SupplierInvoice implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly orderConfirmationService = inject(OrderConfirmationService);
  private readonly proformaService = inject(ProformaInvoiceService);
  private readonly supplierInvoiceService = inject(SupplierInvoiceService);
  private readonly packingListService = inject(PackingListService);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly dropdownService = inject(DropdownService);
  private readonly messageService = inject(MessageService);

  /* ── Core State Signals ─────────────────────────────────── */
  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly activeTab = signal<SubStepType>('proforma');

  protected readonly proformaInvoices = signal<ProformaInvoice[]>([]);
  protected readonly supplierInvoices = signal<SupplierInvoice[]>([]);
  protected readonly packingLists = signal<PackingList[]>([]);
  protected readonly latestOrderConfirmation = signal<LatestOrderConfirmation | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  /* ── Dropdown Constants ─────────────────────────────────── */
  protected readonly incotermsOptions = INCOTERMS_OPTIONS;
  protected readonly currencyOptions = CURRENCY_OPTIONS;
  protected readonly validityUnitOptions = VALIDITY_UNIT_OPTIONS;

  /* ── Dialog States ──────────────────────────────────────── */
  protected readonly proformaDialogVisible = signal(false);
  protected readonly editingProforma = signal<ProformaInvoice | null>(null);
  protected readonly proformaItems = signal<ProformaInvoiceItem[]>([]);

  protected readonly invoiceDialogVisible = signal(false);
  protected readonly editingInvoice = signal<SupplierInvoice | null>(null);
  protected readonly invoiceItems = signal<SupplierInvoiceItem[]>([]);

  protected readonly packingListDialogVisible = signal(false);
  protected readonly editingPackingList = signal<PackingList | null>(null);
  protected readonly packingListItems = signal<PackingListItem[]>([]);

  protected readonly attachments = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);
  protected readonly editingItemIndex = signal<number | null>(null);

  /* ── Reactive Forms ────────────────────────────────────── */
  // 1] Proforma Invoice Form
  protected readonly proformaForm = this.fb.group({
    proforma_invoice_no: ['', [Validators.required, Validators.minLength(2)]],
    proforma_invoice_date: [null as Date | null, [Validators.required]],
    delivery_terms: ['', [Validators.required]],
    payment_terms: ['', [Validators.required]],
    warranty_period: ['', [Validators.required]],
    delivery_period: ['', [Validators.required]],
    remark: [''],
  });

  // 2] Invoice Form
  protected readonly invoiceForm = this.fb.group({
    invoice_no: ['', [Validators.required, Validators.minLength(2)]],
    invoice_date: [null as Date | null, [Validators.required]],
    delivery_terms: ['', [Validators.required]],
    payment_terms: ['', [Validators.required]],
    warranty_period: ['', [Validators.required]],
    delivery_period: ['', [Validators.required]],
    remark: [''],
  });

  // 3] Packing List Form
  protected readonly packingListForm = this.fb.group({
    packing_list_no: ['', [Validators.required, Validators.minLength(2)]],
    packing_list_date: [null as Date | null, [Validators.required]],
    packing_condition: ['', [Validators.required, Validators.minLength(2)]],
    remark: [''],
  });

  // Material Line Item Sub-Form
  protected readonly rowForm = this.fb.group({
    material_name: ['', [Validators.required]],
    hsn_code: [''],
    quantity: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
    unit_price: ['', [Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
    weight: ['', [Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
  });

  /* ── Computed Derived Signals ───────────────────────────── */
  protected readonly proformaTotalNet = computed(() => {
    return this.proformaItems().reduce((sum, it) => {
      const q = Number(it.quantity) || 0;
      const p = Number(it.unit_price) || 0;
      return sum + q * p;
    }, 0);
  });

  protected readonly invoiceTotalNet = computed(() => {
    return this.invoiceItems().reduce((sum, it) => {
      const q = Number(it.quantity) || 0;
      const p = Number(it.unit_price) || 0;
      return sum + q * p;
    }, 0);
  });

  protected readonly packingListTotalItems = computed(() => {
    return this.packingListItems().reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  });

  protected readonly packingListTotalWeight = computed(() => {
    return this.packingListItems().reduce((sum, it) => sum + this.calculateRowWeight(it), 0);
  });

  /* ── Lifecycle ─────────────────────────────────────────── */
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!id) {
      this.errorMessage.set('Invalid project ID.');
      this.loading.set(false);
      return;
    }
    this.projectId.set(id);
    this.loadProjectDetails(id);
    this.loadAllData(id);
  }

  /* ── Data Loaders ──────────────────────────────────────── */
  private loadProjectDetails(projectId: number): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj?.customer_id) {
          this.customerService.getCustomerById(proj.customer_id).subscribe({
            next: (cust) => this.customer.set(cust),
            error: () => {/* non-fatal */ },
          });
        }
      },
      error: () => {/* non-fatal */ },
    });
  }

  protected loadAllData(projectId: number): void {
    this.loading.set(true);

    // 1. Load latest order confirmation
    this.orderConfirmationService.getLatestOrderConfirmation(projectId).subscribe({
      next: (latest) => this.latestOrderConfirmation.set(latest),
      error: () => {/* non-fatal */ },
    });

    // 2. Load Proforma Invoices
    this.proformaService.getByProject(projectId).subscribe({
      next: (list) => this.proformaInvoices.set(list || []),
      error: () => {/* non-fatal */ },
    });

    // 3. Load Supplier Invoices
    this.supplierInvoiceService.getByProject(projectId).subscribe({
      next: (list) => this.supplierInvoices.set(list || []),
      error: () => {/* non-fatal */ },
    });

    // 4. Load Packing Lists
    this.packingListService.getByProject(projectId).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (list) => this.packingLists.set(list || []),
      error: () => {/* non-fatal */ },
    });
  }

  /* ── Tab Switcher ──────────────────────────────────────── */
  protected selectTab(tab: SubStepType): void {
    this.activeTab.set(tab);
  }

  /* ════════════════════════════════════════════════════════════
     1] PROFORMA INVOICE DIALOG & SUBMIT
  ════════════════════════════════════════════════════════════ */
  protected openCreateProformaDialog(): void {
    const latest = this.latestOrderConfirmation();
    this.editingProforma.set(null);
    this.errorMessage.set(null);

    const defaultItems: ProformaInvoiceItem[] = (latest?.items || []).map((it) => ({
      material_name: it.material_name || it.description || 'Material Item',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || it.hsn_sac || '',
      quantity: it.quantity || 1,
      unit_price: it.unit_price || 0,
      net_amount: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
    }));

    this.proformaForm.reset({
      proforma_invoice_no: '',
      proforma_invoice_date: null,
      delivery_terms: latest?.delivery_terms || latest?.shipping_terms || latest?.incoterms || '',
      payment_terms: latest?.payment_terms || '',
      warranty_period: latest?.warranty_period || '',
      delivery_period: latest?.delivery_period || '',
      remark: '',
    });

    this.proformaItems.set(defaultItems);
    this.attachments.set([]);
    this.existingAttachments.set([]);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.proformaDialogVisible.set(true);
  }

  protected openEditProformaDialog(item: ProformaInvoice): void {
    this.editingProforma.set(item);
    this.errorMessage.set(null);

    this.proformaForm.setValue({
      proforma_invoice_no: item.proforma_invoice_no || item.invoice_no || '',
      proforma_invoice_date: this.parseDate(item.proforma_invoice_date || item.date),
      delivery_terms: item.delivery_terms || item.shipping_terms || item.incoterms || '',
      payment_terms: item.payment_terms || '',
      warranty_period: item.warranty_period || '',
      delivery_period: item.delivery_period || '',
      remark: item.remark || '',
    });

    const mappedItems: ProformaInvoiceItem[] = (item.items || []).map((it) => ({
      id: it.id,
      proforma_invoice_id: it.proforma_invoice_id,
      material_name: it.material_name || it.description || '',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || '',
      quantity: it.quantity,
      unit_price: it.unit_price || 0,
      net_amount: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    }));

    this.proformaItems.set(mappedItems);
    this.attachments.set([]);
    this.existingAttachments.set(item.attachments || []);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.proformaDialogVisible.set(true);
  }

  protected closeProformaDialog(): void {
    this.proformaDialogVisible.set(false);
    this.editingProforma.set(null);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.attachments.set([]);
  }

  protected submitProforma(): void {
    if (this.proformaForm.invalid) {
      this.proformaForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Required',
        detail: 'Please fill in all required Proforma Invoice fields.',
      });
      return;
    }

    if (this.proformaItems().length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Materials Required',
        detail: 'Please add at least one line item.',
      });
      return;
    }

    const val = this.proformaForm.getRawValue();
    const dateStr = val.proforma_invoice_date ? this.formatDate(val.proforma_invoice_date) : '';
    const totalNet = this.proformaTotalNet();

    const itemsPayload: ProformaInvoiceItem[] = this.proformaItems().map((it) => ({
      material_name: it.material_name || it.description || '',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || '',
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price || 0),
      net_amount: Number(it.quantity) * Number(it.unit_price || 0),
    }));

    this.submitting.set(true);
    this.errorMessage.set(null);

    const existing = this.editingProforma();

    if (existing) {
      const updatePayload: ProformaInvoiceUpdateInput = {
        project_id: this.projectId(),
        proforma_invoice_no: val.proforma_invoice_no,
        proforma_invoice_date: dateStr,
        delivery_terms: val.delivery_terms,
        payment_terms: val.payment_terms,
        warranty_period: val.warranty_period,
        delivery_period: val.delivery_period,
        total_amount: totalNet,
        total_net_amount: totalNet,
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.proformaService
        .update(existing.id, updatePayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Proforma Invoice Updated',
              detail: 'Proforma Invoice updated successfully.',
            });
            this.closeProformaDialog();
            this.loadAllData(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to update Proforma Invoice.');
          },
        });
    } else {
      const createPayload: ProformaInvoiceCreateInput = {
        project_id: this.projectId(),
        proforma_invoice_no: val.proforma_invoice_no,
        proforma_invoice_date: dateStr,
        delivery_terms: val.delivery_terms,
        payment_terms: val.payment_terms,
        warranty_period: val.warranty_period,
        delivery_period: val.delivery_period,
        total_amount: totalNet,
        total_net_amount: totalNet,
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.proformaService
        .create(createPayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Proforma Invoice Created',
              detail: 'Proforma Invoice created successfully.',
            });
            this.closeProformaDialog();
            this.loadAllData(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to create Proforma Invoice.');
          },
        });
    }
  }

  protected deleteProforma(item: ProformaInvoice): void {
    const ref = item.proforma_invoice_no || item.invoice_no || ('#' + item.id);
    if (!confirm(`Are you sure you want to delete Proforma Invoice "${ref}"?`)) return;

    this.proformaService.delete(item.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Proforma Invoice deleted successfully.',
        });
        this.loadAllData(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete Proforma Invoice.',
        });
      },
    });
  }

  /* ════════════════════════════════════════════════════════════
     2] INVOICE (SUPPLIER INVOICE) DIALOG & SUBMIT
  ════════════════════════════════════════════════════════════ */
  protected openCreateInvoiceDialog(): void {
    const latest = this.latestOrderConfirmation();
    this.editingInvoice.set(null);
    this.errorMessage.set(null);

    const defaultItems: SupplierInvoiceItem[] = (latest?.items || []).map((it) => ({
      material_name: it.material_name || it.description || 'Material Item',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || it.hsn_sac || '',
      quantity: it.quantity || 1,
      unit_price: it.unit_price || 0,
      net_amount: (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
    }));

    this.invoiceForm.reset({
      invoice_no: '',
      invoice_date: null,
      delivery_terms: latest?.delivery_terms || latest?.shipping_terms || latest?.incoterms || '',
      payment_terms: latest?.payment_terms || '',
      warranty_period: latest?.warranty_period || '',
      delivery_period: latest?.delivery_period || '',
      remark: '',
    });

    this.invoiceItems.set(defaultItems);
    this.attachments.set([]);
    this.existingAttachments.set([]);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.invoiceDialogVisible.set(true);
  }

  protected openEditInvoiceDialog(item: SupplierInvoice): void {
    this.editingInvoice.set(item);
    this.errorMessage.set(null);

    this.invoiceForm.setValue({
      invoice_no: item.invoice_no || '',
      invoice_date: this.parseDate(item.invoice_date || item.date),
      delivery_terms: item.delivery_terms || item.shipping_terms || item.incoterms || '',
      payment_terms: item.payment_terms || '',
      warranty_period: item.warranty_period || '',
      delivery_period: item.delivery_period || '',
      remark: item.remark || '',
    });

    const mappedItems: SupplierInvoiceItem[] = (item.items || []).map((it) => ({
      id: it.id,
      supplier_invoice_id: it.supplier_invoice_id,
      material_name: it.material_name || it.description || '',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || '',
      quantity: it.quantity,
      unit_price: it.unit_price || 0,
      net_amount: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    }));

    this.invoiceItems.set(mappedItems);
    this.attachments.set([]);
    this.existingAttachments.set(item.attachments || []);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.invoiceDialogVisible.set(true);
  }

  protected closeInvoiceDialog(): void {
    this.invoiceDialogVisible.set(false);
    this.editingInvoice.set(null);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.attachments.set([]);
  }

  protected submitInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Required',
        detail: 'Please fill in all required Invoice fields.',
      });
      return;
    }

    if (this.invoiceItems().length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Materials Required',
        detail: 'Please add at least one line item.',
      });
      return;
    }

    const val = this.invoiceForm.getRawValue();
    const dateStr = val.invoice_date ? this.formatDate(val.invoice_date) : '';
    const totalNet = this.invoiceTotalNet();

    const itemsPayload: SupplierInvoiceItem[] = this.invoiceItems().map((it) => ({
      material_name: it.material_name || it.description || '',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || '',
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price || 0),
      net_amount: Number(it.quantity) * Number(it.unit_price || 0),
    }));

    this.submitting.set(true);
    this.errorMessage.set(null);

    const existing = this.editingInvoice();

    if (existing) {
      const updatePayload: SupplierInvoiceUpdateInput = {
        project_id: this.projectId(),
        invoice_no: val.invoice_no,
        invoice_date: dateStr,
        delivery_terms: val.delivery_terms,
        payment_terms: val.payment_terms,
        warranty_period: val.warranty_period,
        delivery_period: val.delivery_period,
        total_amount: totalNet,
        total_net_amount: totalNet,
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.supplierInvoiceService
        .update(existing.id, updatePayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Invoice Updated',
              detail: 'Invoice updated successfully.',
            });
            this.closeInvoiceDialog();
            this.loadAllData(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to update Invoice.');
          },
        });
    } else {
      const createPayload: SupplierInvoiceCreateInput = {
        project_id: this.projectId(),
        invoice_no: val.invoice_no,
        invoice_date: dateStr,
        delivery_terms: val.delivery_terms,
        payment_terms: val.payment_terms,
        warranty_period: val.warranty_period,
        delivery_period: val.delivery_period,
        total_amount: totalNet,
        total_net_amount: totalNet,
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.supplierInvoiceService
        .create(createPayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Invoice Created',
              detail: 'Invoice created successfully.',
            });
            this.closeInvoiceDialog();
            this.loadAllData(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to create Invoice.');
          },
        });
    }
  }

  protected deleteInvoice(item: SupplierInvoice): void {
    const ref = item.invoice_no || ('#' + item.id);
    if (!confirm(`Are you sure you want to delete Invoice "${ref}"?`)) return;

    this.supplierInvoiceService.delete(item.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Invoice deleted successfully.',
        });
        this.loadAllData(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete Invoice.',
        });
      },
    });
  }

  /* ════════════════════════════════════════════════════════════
     3] PACKING LIST DIALOG & SUBMIT
  ════════════════════════════════════════════════════════════ */
  protected openCreatePackingListDialog(): void {
    const latest = this.latestOrderConfirmation();
    this.editingPackingList.set(null);
    this.errorMessage.set(null);

    const defaultItems: PackingListItem[] = (latest?.items || []).map((it) => {
      const q = Number(it.quantity) || 1;
      const w = Number((it as any).weight || (it as any).unit_weight) || 0;
      return {
        material_name: it.material_name || it.description || 'Material Item',
        description: it.description || it.material_name || '',
        hsn_code: it.hsn_code || (it as any).hsn_sac || '',
        quantity: q,
        unit_price: it.unit_price || 0,
        net_amount: q * (Number(it.unit_price) || 0),
        weight: w,
        unit_weight: w,
        total_weight: q * w,
      };
    });

    this.packingListForm.reset({
      packing_list_no: '',
      packing_list_date: null,
      packing_condition: '',
      remark: '',
    });

    this.packingListItems.set(defaultItems);
    this.attachments.set([]);
    this.existingAttachments.set([]);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.packingListDialogVisible.set(true);
  }

  protected openEditPackingListDialog(item: PackingList): void {
    this.editingPackingList.set(item);
    this.errorMessage.set(null);

    this.packingListForm.setValue({
      packing_list_no: item.packing_list_no || '',
      packing_list_date: this.parseDate(item.packing_list_date || item.date),
      packing_condition: item.packing_condition || '',
      remark: item.remark || '',
    });

    const mappedItems: PackingListItem[] = (item.items || []).map((it) => {
      const q = Number(it.quantity) || 1;
      const w = Number(it.weight || it.unit_weight) || 0;
      const totW = it.total_weight !== undefined && it.total_weight !== null && Number(it.total_weight) > 0
        ? Number(it.total_weight)
        : q * w;
      return {
        id: it.id,
        packing_list_id: it.packing_list_id,
        material_name: it.material_name || it.description || '',
        description: it.description || it.material_name || '',
        hsn_code: it.hsn_code || '',
        quantity: it.quantity,
        unit_price: it.unit_price || 0,
        net_amount: q * (Number(it.unit_price) || 0),
        package_type: it.package_type || '',
        weight: w,
        unit_weight: w,
        total_weight: totW,
      };
    });

    this.packingListItems.set(mappedItems);
    this.attachments.set([]);
    this.existingAttachments.set(item.attachments || []);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.packingListDialogVisible.set(true);
  }

  protected closePackingListDialog(): void {
    this.packingListDialogVisible.set(false);
    this.editingPackingList.set(null);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.attachments.set([]);
  }

  protected submitPackingList(): void {
    if (this.packingListForm.invalid) {
      this.packingListForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Required',
        detail: 'Please fill in all required Packing List fields.',
      });
      return;
    }

    const val = this.packingListForm.getRawValue();
    const dateStr = val.packing_list_date ? this.formatDate(val.packing_list_date) : '';

    const itemsPayload: PackingListItem[] = this.packingListItems().map((it) => {
      const q = Number(it.quantity) || 0;
      const w = Number(it.weight || it.unit_weight) || 0;
      const totW = this.calculateRowWeight(it);
      return {
        material_name: it.material_name || it.description || '',
        description: it.description || it.material_name || '',
        hsn_code: it.hsn_code || '',
        quantity: q,
        unit_price: Number(it.unit_price || 0),
        net_amount: q * Number(it.unit_price || 0),
        weight: w,
        unit_weight: w,
        total_weight: totW,
      };
    });

    this.submitting.set(true);
    this.errorMessage.set(null);

    const existing = this.editingPackingList();

    if (existing) {
      const updatePayload: PackingListUpdateInput = {
        project_id: this.projectId(),
        packing_list_no: val.packing_list_no,
        packing_list_date: dateStr,
        packing_condition: val.packing_condition,
        weight: this.packingListTotalWeight(),
        total_weight: this.packingListTotalWeight(),
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.packingListService
        .update(existing.id, updatePayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Packing List Updated',
              detail: 'Packing List updated successfully.',
            });
            this.closePackingListDialog();
            this.loadAllData(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to update Packing List.');
          },
        });
    } else {
      const createPayload: PackingListCreateInput = {
        project_id: this.projectId(),
        packing_list_no: val.packing_list_no,
        packing_list_date: dateStr,
        packing_condition: val.packing_condition,
        weight: this.packingListTotalWeight(),
        total_weight: this.packingListTotalWeight(),
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.packingListService
        .create(createPayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Packing List Created',
              detail: 'Packing List created successfully.',
            });
            this.closePackingListDialog();
            this.loadAllData(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to create Packing List.');
          },
        });
    }
  }

  protected deletePackingList(item: PackingList): void {
    const ref = item.packing_list_no || ('#' + item.id);
    if (!confirm(`Are you sure you want to delete Packing List "${ref}"?`)) return;

    this.packingListService.delete(item.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Packing List deleted successfully.',
        });
        this.loadAllData(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete Packing List.',
        });
      },
    });
  }

  /* ── Weight Calculations ─────────────────────────────────── */
  protected calculateRowWeight(item: PackingListItem | null | undefined): number {
    if (!item) return 0;
    if (item.total_weight !== undefined && item.total_weight !== null && Number(item.total_weight) > 0) {
      return Number(item.total_weight);
    }
    const q = Number(item.quantity) || 0;
    const w = Number(item.weight || item.unit_weight) || 0;
    return q * w;
  }

  protected calculatePackingListTotalWeight(pl: PackingList | null | undefined): number {
    if (!pl) return 0;
    if (pl.total_weight !== undefined && pl.total_weight !== null && Number(pl.total_weight) > 0) {
      return Number(pl.total_weight);
    }
    return (pl.items || []).reduce((sum, it) => sum + this.calculateRowWeight(it), 0);
  }

  protected isPackingListRowInvalid(): boolean {
    const val = this.rowForm.getRawValue();
    const name = val.material_name?.trim();
    const qty = parseFloat(val.quantity);
    return !name || isNaN(qty) || qty <= 0;
  }

  /* ── Line Item Actions (Multi-Tab Generic) ───────────────── */
  protected openEditRow(index: number, tab: SubStepType, focusTarget?: HTMLInputElement): void {
    let item: any;
    if (tab === 'proforma') item = this.proformaItems()[index];
    else if (tab === 'invoice') item = this.invoiceItems()[index];
    else item = this.packingListItems()[index];

    if (!item) return;

    this.rowForm.setValue({
      material_name: item.material_name || item.description || '',
      hsn_code: item.hsn_code || '',
      quantity: String(item.quantity ?? ''),
      unit_price: String(item.unit_price ?? ''),
      weight: String(item.weight ?? item.unit_weight ?? ''),
    });
    this.editingItemIndex.set(index);
    if (focusTarget) focusTarget.focus();
  }

  protected saveRow(tab: SubStepType, focusTarget?: HTMLInputElement): void {
    const val = this.rowForm.getRawValue();
    const name = val.material_name?.trim() || '';
    const hsn = val.hsn_code?.trim() || '';
    const qty = parseFloat(val.quantity);

    if (!name || isNaN(qty) || qty <= 0) {
      this.rowForm.markAllAsTouched();
      return;
    }

    if (tab === 'proforma' || tab === 'invoice') {
      const unitPrice = parseFloat(val.unit_price);
      if (isNaN(unitPrice) || unitPrice < 0) {
        this.rowForm.get('unit_price')?.markAsTouched();
        return;
      }
      const net = qty * unitPrice;
      const newItem = {
        material_name: name,
        description: name,
        hsn_code: hsn,
        quantity: qty,
        unit_price: unitPrice,
        net_amount: net,
      };

      const idx = this.editingItemIndex();
      if (tab === 'proforma') {
        if (idx !== null) {
          const list = [...this.proformaItems()];
          list[idx] = { ...list[idx], ...newItem };
          this.proformaItems.set(list);
        } else {
          this.proformaItems.update((list) => [...list, newItem]);
        }
      } else {
        if (idx !== null) {
          const list = [...this.invoiceItems()];
          list[idx] = { ...list[idx], ...newItem };
          this.invoiceItems.set(list);
        } else {
          this.invoiceItems.update((list) => [...list, newItem]);
        }
      }
    } else {
      // Packing List Tab
      const wt = parseFloat(val.weight) || 0;
      const totalWt = qty * wt;
      const newPklItem: PackingListItem = {
        material_name: name,
        description: name,
        hsn_code: hsn,
        quantity: qty,
        unit_price: parseFloat(val.unit_price) || 0,
        net_amount: qty * (parseFloat(val.unit_price) || 0),
        weight: wt,
        unit_weight: wt,
        total_weight: totalWt,
      };

      const idx = this.editingItemIndex();
      if (idx !== null) {
        const list = [...this.packingListItems()];
        list[idx] = { ...list[idx], ...newPklItem };
        this.packingListItems.set(list);
      } else {
        this.packingListItems.update((list) => [...list, newPklItem]);
      }
    }

    this.editingItemIndex.set(null);
    this.rowForm.reset();
    if (focusTarget) {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  protected cancelRow(): void {
    this.editingItemIndex.set(null);
    this.rowForm.reset();
  }

  protected deleteRow(index: number, tab: SubStepType): void {
    if (tab === 'proforma') {
      this.proformaItems.update((list) => list.filter((_, i) => i !== index));
    } else if (tab === 'invoice') {
      this.invoiceItems.update((list) => list.filter((_, i) => i !== index));
    } else {
      this.packingListItems.update((list) => list.filter((_, i) => i !== index));
    }
    if (this.editingItemIndex() === index) {
      this.cancelRow();
    }
  }

  /* ── File Attachments ──────────────────────────────────── */
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const newFiles = Array.from(input.files);
      this.attachments.update((current) => [...current, ...newFiles]);
      input.value = '';
    }
  }

  protected removeAttachment(index: number): void {
    this.attachments.update((list) => list.filter((_, i) => i !== index));
  }

  protected downloadAttachment(att: Attachment): void {
    this.downloadingAttachmentId.set(att.id);
    this.attachmentService
      .downloadAttachment(att.id)
      .pipe(finalize(() => this.downloadingAttachmentId.set(null)))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.file_name;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Download Failed',
            detail: `Could not download file ${att.file_name}.`,
          });
        },
      });
  }

  /* ── Calculation & Format Helpers ───────────────────────── */
  protected calculateOrderNet(item: ProformaInvoice | SupplierInvoice): number {
    if (item.total_net_amount !== undefined && item.total_net_amount !== null && !isNaN(Number(item.total_net_amount))) {
      return Number(item.total_net_amount);
    }
    if (item.total_amount !== undefined && item.total_amount !== null && !isNaN(Number(item.total_amount))) {
      return Number(item.total_amount);
    }
    if (!item.items || item.items.length === 0) return 0;
    return item.items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  }

  protected calculateRowNet(item: { quantity?: number | string; unit_price?: number | string }): number {
    return (Number(item?.quantity) || 0) * (Number(item?.unit_price) || 0);
  }

  protected isFieldInvalid(form: 'proforma' | 'invoice' | 'packing', key: string): boolean {
    const targetForm = form === 'proforma' ? this.proformaForm : form === 'invoice' ? this.invoiceForm : this.packingListForm;
    const c = (targetForm as any).get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected getFieldError(form: 'proforma' | 'invoice' | 'packing', key: string): string | null {
    const targetForm = form === 'proforma' ? this.proformaForm : form === 'invoice' ? this.invoiceForm : this.packingListForm;
    const c = (targetForm as any).get(key);
    if (!c || !c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) return 'This field is required.';
    if (c.hasError('minlength')) return 'Value is too short.';
    return 'Invalid field value.';
  }

  protected isRowFieldInvalid(key: string): boolean {
    const c = this.rowForm.get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected getRowFieldError(key: string): string | null {
    const c = this.rowForm.get(key);
    if (!c || !c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) return 'Required.';
    if (c.hasError('pattern')) return 'Must be a valid positive number.';
    return 'Invalid value.';
  }

  protected goBack(): void {
    this.router.navigate(['/projects', this.projectId(), 'steps']);
  }

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
    if (contentType.includes('sheet') || contentType.includes('excel') || contentType.includes('csv')) {
      return 'pi pi-file-excel';
    }
    if (contentType.includes('word') || contentType.includes('document')) {
      return 'pi pi-file-word';
    }
    return 'pi pi-file';
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parseDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
}
