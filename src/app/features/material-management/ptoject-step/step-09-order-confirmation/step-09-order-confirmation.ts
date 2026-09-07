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

import { OrderConfirmationService } from '../../../../core/services/order-confirmation';
import { CustomerService } from '../../../../core/services/customer';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  LatestSupplierQuotation,
  OrderConfirmation,
  OrderConfirmationCreateInput,
  OrderConfirmationItem,
  OrderConfirmationUpdateInput,
} from '../../../../core/models/order-confirmation.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';
import {
  INCOTERMS_OPTIONS,
  VALIDITY_UNIT_OPTIONS,
} from '../../../../core/constants/dropdown-options.constant';

@Component({
  selector: 'app-step-09-order-confirmation',
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
  templateUrl: './step-09-order-confirmation.html',
  styleUrl: './step-09-order-confirmation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step09OrderConfirmation implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly orderConfirmationService = inject(OrderConfirmationService);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly messageService = inject(MessageService);

  /* ── Core State Signals ─────────────────────────────────── */
  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly orderConfirmations = signal<OrderConfirmation[]>([]);
  protected readonly latestQuotation = signal<LatestSupplierQuotation | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searchQuery = signal('');

  /* ── Dialog & Edit Mode State ───────────────────────────── */
  protected readonly dialogVisible = signal(false);
  protected readonly editingOrder = signal<OrderConfirmation | null>(null);
  protected readonly items = signal<OrderConfirmationItem[]>([]);
  protected readonly editingItemIndex = signal<number | null>(null);
  protected readonly attachments = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);

  /* ── Dropdown Constants ─────────────────────────────────── */
  protected readonly incotermsOptions = INCOTERMS_OPTIONS;
  protected readonly validityUnitOptions = VALIDITY_UNIT_OPTIONS;

  /* ── Reactive Forms ────────────────────────────────────── */
  protected readonly headerForm = this.fb.group({
    order_confirmation_date: [null as Date | null, [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    ref_no: ['', [Validators.required, Validators.minLength(2)]],
    shipping_terms: ['', [Validators.required]],
    warranty_period: ['', [Validators.required]],
    delivery_period: ['', [Validators.required]],
    payment_terms: [''],
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
    const list = this.orderConfirmations();
    if (!q) return list;
    return list.filter(
      (order) =>
        order.ref_no?.toLowerCase().includes(q) ||
        order.reference_number?.toLowerCase().includes(q) ||
        order.email?.toLowerCase().includes(q) ||
        order.shipping_terms?.toLowerCase().includes(q) ||
        order.incoterms?.toLowerCase().includes(q) ||
        order.payment_terms?.toLowerCase().includes(q) ||
        order.remark?.toLowerCase().includes(q)
    );
  });

  protected readonly totalItemCount = computed(() => {
    return this.orderConfirmations().reduce((acc, order) => acc + (order.items?.length || 0), 0);
  });

  protected readonly totalOrderValue = computed(() => {
    return this.orderConfirmations().reduce((total, order) => total + this.calculateOrderNet(order), 0);
  });

  /** Total Net Amount of items in Dialog */
  protected readonly dialogTotalNetValue = computed(() => {
    return this.items().reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
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
    this.loadOrderConfirmations(id);
    this.loadLatestSupplierQuotation(id);
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

  protected loadOrderConfirmations(projectId: number): void {
    this.loading.set(true);
    this.orderConfirmationService
      .getByProject(projectId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.orderConfirmations.set(data || []);
        },
        error: () => {
          this.errorMessage.set('Failed to load order confirmations.');
        },
      });
  }

  protected loadLatestSupplierQuotation(projectId: number): void {
    this.orderConfirmationService
      .getLatestSupplierQuotation(projectId)
      .subscribe({
        next: (data) => {
          this.latestQuotation.set(data);
        },
        error: () => {/* non-fatal */ },
      });
  }

  /* ── Dialog Management ─────────────────────────────────── */
  protected openCreateDialog(): void {
    const latest = this.latestQuotation();
    this.editingOrder.set(null);
    this.errorMessage.set(null);

    // Map items from latest supplier quotation if available
    const mappedItems: OrderConfirmationItem[] = (latest?.items || []).map((it) => {
      const name = it.material_name || it.description || 'Material Item';
      const qty = it.quantity || 1;
      const price = it.unit_price || 0;
      const hsn = it.hsn_code || '';
      return {
        material_name: name,
        description: name,
        hsn_code: hsn,
        quantity: qty,
        unit_price: price,
        net_amount: Number(qty) * Number(price),
      };
    });

    this.headerForm.reset({
      order_confirmation_date: null,
      email: '',
      ref_no: '',
      shipping_terms: latest?.incoterms || latest?.shipping_terms || '',
      payment_terms: latest?.payment_terms || '',
      warranty_period: latest?.warranty_period || '',
      delivery_period: latest?.delivery_period || '',
      remark: '',
    });

    this.items.set(mappedItems);
    this.attachments.set([]);
    this.existingAttachments.set([]);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.dialogVisible.set(true);
  }

  protected openEditDialog(order: OrderConfirmation): void {
    this.editingOrder.set(order);
    this.errorMessage.set(null);

    this.headerForm.setValue({
      order_confirmation_date: this.parseDate(
        order.order_confirmation_date || order.confirmation_date || order.order_date
      ),
      email: order.email || '',
      ref_no: order.ref_no || order.reference_number || order.order_no || '',
      shipping_terms: order.shipping_terms || order.incoterms || order.delivery_terms || '',
      warranty_period: order.warranty_period || '',
      delivery_period: order.delivery_period || '',
      payment_terms: order.payment_terms || '',
      remark: order.remark || '',
    });

    const mappedItems: OrderConfirmationItem[] = (order.items || []).map((it) => ({
      id: it.id,
      order_confirmation_id: it.order_confirmation_id,
      material_name: it.material_name || it.description || '',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || it.hsn_sac || '',
      quantity: it.quantity,
      unit_price: it.unit_price || 0,
      net_amount: Number(it.quantity) * Number(it.unit_price || 0),
    }));

    this.items.set(mappedItems);
    this.attachments.set([]);
    this.existingAttachments.set(order.attachments || []);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingOrder.set(null);
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

    const newItem: OrderConfirmationItem = {
      material_name: name,
      description: name,
      hsn_code: hsn,
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
        detail: 'Please add at least one material line item to the order confirmation.',
      });
      return;
    }

    const val = this.headerForm.getRawValue();
    const dateStr = val.order_confirmation_date ? this.formatDate(val.order_confirmation_date) : '';
    const totalNet = this.dialogTotalNetValue();

    const itemsPayload = this.items().map((it) => ({
      material_name: it.material_name || it.description || '',
      description: it.description || it.material_name || '',
      hsn_code: it.hsn_code || it.hsn_sac || '',
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price || 0),
      net_amount: Number(it.quantity) * Number(it.unit_price || 0),
    }));

    this.submitting.set(true);
    this.errorMessage.set(null);

    const order = this.editingOrder();

    if (order) {
      const updatePayload: OrderConfirmationUpdateInput = {
        project_id: this.projectId(),
        order_confirmation_date: dateStr,
        email: val.email,
        ref_no: val.ref_no,
        shipping_terms: val.shipping_terms,
        warranty_period: val.warranty_period,
        delivery_period: val.delivery_period,
        payment_terms: val.payment_terms || undefined,
        total_amount: totalNet,
        total_net_amount: totalNet,
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.orderConfirmationService
        .update(order.id, updatePayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Order Confirmation Updated',
              detail: 'Order confirmation updated successfully.',
            });
            this.dialogVisible.set(false);
            this.loadOrderConfirmations(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to update order confirmation.');
          },
        });
    } else {
      const createPayload: OrderConfirmationCreateInput = {
        project_id: this.projectId(),
        order_confirmation_date: dateStr,
        email: val.email,
        ref_no: val.ref_no,
        shipping_terms: val.shipping_terms,
        warranty_period: val.warranty_period,
        delivery_period: val.delivery_period,
        payment_terms: val.payment_terms || undefined,
        total_amount: totalNet,
        total_net_amount: totalNet,
        remark: val.remark || '',
        items: itemsPayload,
      };

      this.orderConfirmationService
        .create(createPayload, this.attachments())
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Order Confirmation Created',
              detail: 'Order confirmation recorded successfully.',
            });
            this.dialogVisible.set(false);
            this.loadOrderConfirmations(this.projectId());
          },
          error: (err) => {
            this.errorMessage.set(err?.error?.message || 'Failed to create order confirmation.');
          },
        });
    }
  }

  /* ── Delete Action ─────────────────────────────────────── */
  protected deleteOrder(order: OrderConfirmation): void {
    const ref = order.ref_no || order.reference_number || order.order_no || ('#' + order.id);
    if (!confirm(`Are you sure you want to delete the order confirmation "${ref}"?`)) {
      return;
    }

    this.orderConfirmationService.delete(order.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Order confirmation deleted successfully.',
        });
        this.loadOrderConfirmations(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete order confirmation.',
        });
      },
    });
  }

  /* ── Calculation Helpers ───────────────────────────────── */
  protected calculateItemNet(item: OrderConfirmationItem): number {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    return qty * price;
  }

  protected calculateOrderNet(order: OrderConfirmation): number {
    if (order.total_net_amount !== undefined && order.total_net_amount !== null && !isNaN(Number(order.total_net_amount))) {
      return Number(order.total_net_amount);
    }
    if (order.total_amount !== undefined && order.total_amount !== null && !isNaN(Number(order.total_amount))) {
      return Number(order.total_amount);
    }
    if (!order.items || order.items.length === 0) return 0;
    return order.items.reduce((sum, it) => sum + this.calculateItemNet(it), 0);
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
