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
import { toSignal } from '@angular/core/rxjs-interop';
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

import { PurchaseOrderService } from '../../../../core/services/purchase-order';
import { CustomerService } from '../../../../core/services/customer';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  LatestBidSubmission,
  PurchaseOrder,
  PurchaseOrderCreateInput,
  PurchaseOrderItem,
  PurchaseOrderUpdateInput,
} from '../../../../core/models/purchase-order.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';
import {
  INCOTERMS_OPTIONS,
  VALIDITY_UNIT_OPTIONS,
} from '../../../../core/constants/dropdown-options.constant';

@Component({
  selector: 'app-step-08-purchase-order',
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
  templateUrl: './step-08-purchase-order.html',
  styleUrl: './step-08-purchase-order.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step08PurchaseOrder implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly purchaseOrderService = inject(PurchaseOrderService);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly messageService = inject(MessageService);

  /* ── Core State Signals ─────────────────────────────────── */
  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly purchaseOrders = signal<PurchaseOrder[]>([]);
  protected readonly latestBid = signal<LatestBidSubmission | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searchQuery = signal('');

  /* ── Dialog & Edit Mode State ───────────────────────────── */
  protected readonly dialogVisible = signal(false);
  protected readonly editingPO = signal<PurchaseOrder | null>(null);
  protected readonly items = signal<PurchaseOrderItem[]>([]);
  protected readonly editingItemIndex = signal<number | null>(null);
  protected readonly attachments = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);

  /* ── Dropdown Constants ─────────────────────────────────── */
  protected readonly incotermsOptions = INCOTERMS_OPTIONS;
  protected readonly validityUnitOptions = VALIDITY_UNIT_OPTIONS;

  /* ── Reactive Forms ────────────────────────────────────── */
  protected readonly headerForm = this.fb.group({
    customer_id: [0],
    poc_name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    po_no: ['', [Validators.required]],
    po_title: ['', [Validators.required, Validators.minLength(2)]],
    po_date: [null as Date | null, [Validators.required]],
    delivery_date: [null as Date | null, [Validators.required]],
    delivery_term: ['', [Validators.required]],
    payment_terms: ['', [Validators.required]],
    warranty_period: ['', [Validators.required]],
    gst_rate: [18 as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
    remark: [''],
  });

  protected readonly rowForm = this.fb.group({
    material_name: ['', [Validators.required]],
    hsn_code: [''],
    quantity: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
    unit_price: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
  });

  /* ── Form Value Signal ─────────────────────────────────── */
  private readonly headerFormSignal = toSignal(
    this.headerForm.valueChanges,
    { initialValue: this.headerForm.getRawValue() }
  );

  /* ── Derived Summaries ─────────────────────────────────── */
  protected readonly filteredOrders = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.purchaseOrders();
    if (!q) return list;
    return list.filter(
      (po) =>
        po.po_no?.toLowerCase().includes(q) ||
        po.po_number?.toLowerCase().includes(q) ||
        po.po_title?.toLowerCase().includes(q) ||
        po.poc_name?.toLowerCase().includes(q) ||
        po.email?.toLowerCase().includes(q) ||
        po.delivery_term?.toLowerCase().includes(q) ||
        po.payment_terms?.toLowerCase().includes(q)
    );
  });

  protected readonly totalItemCount = computed(() => {
    return this.purchaseOrders().reduce((acc, po) => acc + (po.items?.length || 0), 0);
  });

  protected readonly totalPOValue = computed(() => {
    return this.purchaseOrders().reduce((total, po) => total + this.calculatePOGross(po), 0);
  });

  /** Total Net Amount of items in Dialog (Excluding GST) */
  protected readonly dialogTotalNetValue = computed(() => {
    return this.items().reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  });

  /** GST Rate (%) currently set in dialog form */
  protected readonly dialogGstRate = computed(() => {
    const formVal = this.headerFormSignal();
    const val = formVal ? formVal.gst_rate : this.headerForm.get('gst_rate')?.value;
    return val !== null && val !== undefined && !isNaN(Number(val)) ? Number(val) : 0;
  });

  /** GST Amount (₹) in Dialog */
  protected readonly dialogGstAmount = computed(() => {
    return (this.dialogTotalNetValue() * this.dialogGstRate()) / 100;
  });

  /** Total Gross Amount (₹) in Dialog (Including GST) */
  protected readonly dialogTotalGrossValue = computed(() => {
    return this.dialogTotalNetValue() + this.dialogGstAmount();
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
    this.loadPurchaseOrders(id);
    this.loadLatestBid(id);
  }

  /* ── Data Loaders ──────────────────────────────────────── */
  private loadProjectDetails(projectId: number): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj?.customer_id) {
          this.customerService.getCustomerById(proj.customer_id).subscribe({
            next: (cust) => this.customer.set(cust),
            error: () => {/* non-fatal */},
          });
        }
      },
      error: () => {/* non-fatal */},
    });
  }

  protected loadPurchaseOrders(projectId: number): void {
    this.loading.set(true);
    this.purchaseOrderService
      .getByProject(projectId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.purchaseOrders.set(data || []);
        },
        error: () => {
          this.errorMessage.set('Failed to load purchase orders.');
        },
      });
  }

  protected loadLatestBid(projectId: number): void {
    this.purchaseOrderService
      .getLatestBidSubmission(projectId)
      .subscribe({
        next: (data) => {
          this.latestBid.set(data);
        },
        error: () => {/* non-fatal */},
      });
  }

  /* ── Dialog Management ─────────────────────────────────── */
  protected openCreateDialog(): void {
    const proj = this.project();
    const latest = this.latestBid();
    this.editingPO.set(null);
    this.errorMessage.set(null);

    // Map items from latest bid submission if available
    const mappedItems: PurchaseOrderItem[] = (latest?.items || []).map((it) => {
      const name = it.material_name || it.description || 'Material Item';
      const qty = it.quantity || 1;
      const price = it.unit_price || 0;
      const hsn = it.hsn_code || it.hsn_sac || '';
      return {
        material_name: name,
        description: name,
        hsn_code: hsn,
        hsn_sac: hsn,
        quantity: qty,
        unit_price: price,
        net_amount: Number(qty) * Number(price),
      };
    });

    this.headerForm.reset({
      customer_id: proj?.customer_id || 0,
      poc_name: '',
      email: '',
      po_no: '',
      po_title: proj?.project_title ? `PO for ${proj.project_title}` : '',
      po_date: new Date(),
      delivery_date: null,
      delivery_term: latest?.delivery_term || latest?.delivery_terms || '',
      payment_terms: latest?.payment_terms || '',
      warranty_period: latest?.warranty_period || '',
      gst_rate: latest?.gst_rate !== undefined && latest?.gst_rate !== null ? latest.gst_rate : 18,
      remark: '',
    });

    this.items.set(mappedItems);
    this.attachments.set([]);
    this.existingAttachments.set([]);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.dialogVisible.set(true);

    // Refresh latest bid submission data in background if needed
    this.fetchAndPatchLatestBidSubmission(this.projectId());
  }

  protected fetchAndPatchLatestBidSubmission(projectId: number): void {
    this.purchaseOrderService
      .getLatestBidSubmission(projectId)
      .subscribe({
        next: (latest) => {
          if (!latest) return;

          // Patch header form commercial terms
          this.headerForm.patchValue({
            delivery_term: latest.delivery_term || latest.delivery_terms || this.headerForm.value.delivery_term || '',
            payment_terms: latest.payment_terms || this.headerForm.value.payment_terms || '',
            warranty_period: latest.warranty_period || this.headerForm.value.warranty_period || '',
            gst_rate: latest.gst_rate !== undefined && latest.gst_rate !== null ? latest.gst_rate : 18,
          });

          // Pre-populate items with HSN code support
          if (latest.items && latest.items.length > 0) {
            const mappedItems: PurchaseOrderItem[] = latest.items.map((it) => {
              const name = it.material_name || it.description || 'Material Item';
              const qty = it.quantity || 1;
              const price = it.unit_price || 0;
              const hsn = it.hsn_code || it.hsn_sac || '';
              return {
                material_name: name,
                description: name,
                hsn_code: hsn,
                hsn_sac: hsn,
                quantity: qty,
                unit_price: price,
                net_amount: Number(qty) * Number(price),
              };
            });
            this.items.set(mappedItems);
          }
        },
        error: () => {/* non-fatal, user enters manually */},
      });
  }

  protected openEditDialog(po: PurchaseOrder): void {
    this.editingPO.set(po);
    this.errorMessage.set(null);

    this.headerForm.setValue({
      customer_id: po.customer_id || this.project()?.customer_id || 0,
      poc_name: po.poc_name || '',
      email: po.email || '',
      po_no: po.po_no || po.po_number || '',
      po_title: po.po_title || '',
      po_date: this.parseDate(po.po_date),
      delivery_date: this.parseDate(po.delivery_date),
      delivery_term: po.delivery_term || po.delivery_terms || '',
      payment_terms: po.payment_terms || '',
      warranty_period: po.warranty_period || '',
      gst_rate: po.gst_rate !== undefined && po.gst_rate !== null ? po.gst_rate : 18,
      remark: po.remark || '',
    });

    const mappedItems: PurchaseOrderItem[] = (po.items || []).map((it) => ({
      id: it.id,
      purchase_order_id: it.purchase_order_id,
      material_name: it.material_name || it.description || '',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || it.hsn_sac || '',
      hsn_sac: it.hsn_sac || it.hsn_code || '',
      quantity: it.quantity,
      unit_price: it.unit_price || 0,
      net_amount: Number(it.quantity) * Number(it.unit_price || 0),
    }));

    this.items.set(mappedItems);
    this.attachments.set([]);
    this.existingAttachments.set(po.attachments || []);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingPO.set(null);
    this.rowForm.reset();
    this.editingItemIndex.set(null);
    this.attachments.set([]);
  }

  /* ── Inline Material Item Actions ───────────────────────── */
  protected openEditRow(index: number, focusTarget?: HTMLInputElement): void {
    const item = this.items()[index];
    this.rowForm.setValue({
      material_name: item.material_name || item.description || '',
      hsn_code: item.hsn_code || item.hsn_sac || '',
      quantity: String(item.quantity || ''),
      unit_price: String(item.unit_price || ''),
    });
    this.editingItemIndex.set(index);
    if (focusTarget) {
      focusTarget.focus();
    }
  }

  protected saveRow(focusTarget?: HTMLInputElement): void {
    if (this.rowForm.invalid) {
      this.rowForm.markAllAsTouched();
      return;
    }

    const val = this.rowForm.getRawValue();
    const name = val.material_name.trim();
    const hsn = val.hsn_code?.trim() || '';
    const qty = parseFloat(val.quantity);
    const unitPrice = parseFloat(val.unit_price);
    const net = qty * unitPrice;

    const newItem: PurchaseOrderItem = {
      material_name: name,
      description: name,
      hsn_code: hsn,
      hsn_sac: hsn,
      quantity: qty,
      unit_price: unitPrice,
      net_amount: net,
    };

    const idx = this.editingItemIndex();
    if (idx !== null) {
      const updated = [...this.items()];
      const existing = updated[idx];
      updated[idx] = {
        ...existing,
        ...newItem,
      };
      this.items.set(updated);
      this.editingItemIndex.set(null);
    } else {
      this.items.update((list) => [...list, newItem]);
    }

    this.rowForm.reset();
    if (focusTarget) {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  protected cancelRow(): void {
    this.editingItemIndex.set(null);
    this.rowForm.reset();
  }

  protected deleteRow(index: number): void {
    this.items.update((list) => list.filter((_, i) => i !== index));
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

  /* ── Submit Form Handler ───────────────────────────────── */
  protected submit(): void {
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Required',
        detail: 'Please complete all required fields.',
      });
      return;
    }

    if (this.items().length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Materials Required',
        detail: 'Please add at least one material line item to the purchase order.',
      });
      return;
    }

    const val = this.headerForm.getRawValue();
    const poDateStr = val.po_date ? this.formatDate(val.po_date) : '';
    const deliveryDateStr = val.delivery_date ? this.formatDate(val.delivery_date) : '';
    const totalNet = this.dialogTotalNetValue();
    const totalGross = this.dialogTotalGrossValue();
    const gstRate = val.gst_rate !== null && val.gst_rate !== undefined ? Number(val.gst_rate) : 18;
    const gstAmount = this.dialogGstAmount();

    const itemsPayload = this.items().map((it) => ({
      material_name: it.material_name || it.description || '',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || it.hsn_sac || '',
      hsn_sac: it.hsn_sac || it.hsn_code || '',
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price || 0),
      net_amount: Number(it.quantity) * Number(it.unit_price || 0),
    }));

    this.submitting.set(true);
    this.errorMessage.set(null);

    const po = this.editingPO();

    if (po) {
      const updatePayload: PurchaseOrderUpdateInput = {
        project_id: this.projectId(),
        customer_id: val.customer_id || this.project()?.customer_id,
        poc_name: val.poc_name,
        email: val.email,
        po_no: val.po_no,
        po_title: val.po_title,
        po_date: poDateStr,
        delivery_date: deliveryDateStr,
        delivery_term: val.delivery_term,
        payment_terms: val.payment_terms,
        warranty_period: val.warranty_period,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        total_net_amount: totalNet,
        total_gross_amount: totalGross,
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.purchaseOrderService
        .update(po.id, updatePayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: 'Purchase order updated successfully.',
            });
            this.dialogVisible.set(false);
            this.loadPurchaseOrders(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to update purchase order.');
          },
        });
    } else {
      const createPayload: PurchaseOrderCreateInput = {
        project_id: this.projectId(),
        customer_id: val.customer_id || this.project()?.customer_id,
        poc_name: val.poc_name,
        email: val.email,
        po_no: val.po_no,
        po_title: val.po_title,
        po_date: poDateStr,
        delivery_date: deliveryDateStr,
        delivery_term: val.delivery_term,
        payment_terms: val.payment_terms,
        warranty_period: val.warranty_period,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        total_net_amount: totalNet,
        total_gross_amount: totalGross,
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.purchaseOrderService
        .create(createPayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Created',
              detail: 'Purchase order recorded successfully.',
            });
            this.dialogVisible.set(false);
            this.loadPurchaseOrders(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to create purchase order.');
          },
        });
    }
  }

  /* ── Delete Action ─────────────────────────────────────── */
  protected deletePO(po: PurchaseOrder): void {
    if (!confirm(`Are you sure you want to delete the purchase order "${po.po_no || po.po_number || po.po_title}"?`)) {
      return;
    }

    this.purchaseOrderService.delete(po.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Purchase order deleted successfully.',
        });
        this.loadPurchaseOrders(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete purchase order.',
        });
      },
    });
  }

  /* ── Calculation Helpers ───────────────────────────────── */
  protected calculateItemNet(item: PurchaseOrderItem): number {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    return qty * price;
  }

  protected calculatePONet(po: PurchaseOrder): number {
    if (po.total_net_amount !== undefined && po.total_net_amount !== null && !isNaN(Number(po.total_net_amount))) {
      return Number(po.total_net_amount);
    }
    if (!po.items || po.items.length === 0) return 0;
    return po.items.reduce((sum, it) => sum + this.calculateItemNet(it), 0);
  }

  protected calculatePOGross(po: PurchaseOrder): number {
    if (po.total_gross_amount !== undefined && po.total_gross_amount !== null && !isNaN(Number(po.total_gross_amount))) {
      return Number(po.total_gross_amount);
    }
    if (po.total_amount !== undefined && po.total_amount !== null && !isNaN(Number(po.total_amount))) {
      return Number(po.total_amount);
    }
    const net = this.calculatePONet(po);
    const gstRate = po.gst_rate ?? 18;
    return net + (net * gstRate) / 100;
  }

  protected calculatePOGst(po: PurchaseOrder): number {
    if (po.gst_amount !== undefined && po.gst_amount !== null && !isNaN(Number(po.gst_amount))) {
      return Number(po.gst_amount);
    }
    const net = this.calculatePONet(po);
    const gstRate = po.gst_rate ?? 18;
    return (net * gstRate) / 100;
  }

  /* ── Validation Helpers ────────────────────────────────── */
  protected isFieldInvalid(key: string): boolean {
    const c = this.headerForm.get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected getFieldError(key: string): string | null {
    const c = this.headerForm.get(key);
    if (!c || !c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) return 'This field is required.';
    if (c.hasError('email')) return 'Please enter a valid email address.';
    if (c.hasError('minlength')) return 'Value is too short.';
    if (c.hasError('min') || c.hasError('max')) return 'Value is out of valid range.';
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
    if (c.hasError('pattern')) return 'Must be a positive number.';
    return 'Invalid value.';
  }

  /* ── Navigation & Format Helpers ───────────────────────── */
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
