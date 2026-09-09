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
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { SupplierPaymentService } from '../../../../core/services/supplier-payment';
import { ProjectService } from '../../../../core/services/project';
import { SupplierService } from '../../../../core/services/supplier';
import { PurchaseOrderService } from '../../../../core/services/purchase-order';
import { SupplierInvoiceService } from '../../../../core/services/supplier-invoice';
import { AttachmentService } from '../../../../core/services/attachment';
import { DropdownService } from '../../../../core/services/dropdown.service';
import {
  SupplierPayment,
  SupplierPaymentCreateInput,
  SupplierPaymentUpdateInput,
} from '../../../../core/models/supplier-payment.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Supplier } from '../../../../core/models/supplier.model';
import { Project } from '../../../../core/models/project.model';
import { PurchaseOrder } from '../../../../core/models/purchase-order.model';
import { SupplierInvoice } from '../../../../core/models/supplier-invoice.model';
import { SelectOption } from '../../../../core/models/select-option.model';

@Component({
  selector: 'app-step-15-supplier-payment',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    SelectModule,
    TooltipModule,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './step-15-supplier-payment.html',
  styleUrl: './step-15-supplier-payment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step15SupplierPayment implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly supplierPaymentService = inject(SupplierPaymentService);
  private readonly projectService = inject(ProjectService);
  private readonly supplierService = inject(SupplierService);
  private readonly poService = inject(PurchaseOrderService);
  private readonly supplierInvoiceService = inject(SupplierInvoiceService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly dropdownService = inject(DropdownService);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly projectId = signal<number | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly payments = signal<SupplierPayment[]>([]);
  protected readonly purchaseOrders = signal<PurchaseOrder[]>([]);
  protected readonly supplierInvoices = signal<SupplierInvoice[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searchQuery = signal('');

  // ── Currency Options ───────────────────────────────────────────
  protected readonly currencyOptions: SelectOption<string>[] =
    this.dropdownService.currencies();

  // ── Dialog & Attachments State ─────────────────────────────────
  protected readonly paymentDialogVisible = signal(false);
  protected readonly editingPayment = signal<SupplierPayment | null>(null);
  protected readonly selectedFiles = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);
  protected readonly downloadingAttachmentId = signal<number | null>(null);

  // ── Reactive Form ──────────────────────────────────────────────
  protected readonly paymentForm: FormGroup = this.fb.group({
    currency: ['INR', [Validators.required]],
    payment_percentage: [null, [Validators.min(0), Validators.max(100)]],
    total_supplier_value: [null, [Validators.min(0)]],
    amount_paid: [null, [Validators.required, Validators.min(0.01)]],
    payment_date: [null, [Validators.required]],
    transaction_details: ['', [Validators.required]],
    pending_amount: [null, [Validators.min(0)]],
    remark: [''],
  });

  // ── Filtered Records ───────────────────────────────────────────
  protected readonly filteredPayments = computed(() => {
    const list = this.payments();
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return list;

    return list.filter((p) => {
      return (
        String(p.id).includes(query) ||
        (p.currency && p.currency.toLowerCase().includes(query)) ||
        (p.transaction_details && p.transaction_details.toLowerCase().includes(query)) ||
        (p.remark && p.remark.toLowerCase().includes(query)) ||
        (p.payment_date && p.payment_date.toLowerCase().includes(query))
      );
    });
  });

  // ── Benchmark Supplier Commitment Reference ─────────────────────
  protected readonly latestPoOrInvoice = computed(() => {
    const invoices = this.supplierInvoices();
    if (invoices.length > 0) {
      const inv = invoices[invoices.length - 1];
      return {
        type: 'Supplier Invoice',
        ref: inv.invoice_no || `INV #${inv.id}`,
        date: inv.invoice_date,
        total: Number(inv.total_amount) || Number(inv.total_net_amount) || 0,
        currency: inv.currency || 'INR',
      };
    }
    const pos = this.purchaseOrders();
    if (pos.length > 0) {
      const po = pos[pos.length - 1];
      return {
        type: 'Purchase Order',
        ref: po.po_no || po.po_number || `PO #${po.id}`,
        date: po.po_date,
        total: Number(po.total_net_amount) || Number(po.total_amount) || 0,
        currency: this.project()?.currency || 'INR',
      };
    }
    return null;
  });

  // ── KPI Summary Signals ────────────────────────────────────────
  protected readonly totalCommitmentValue = computed(() => {
    const bench = this.latestPoOrInvoice();
    if (bench && bench.total > 0) return bench.total;

    const list = this.payments();
    if (!list.length) return 0;
    return list.reduce((sum, p) => Math.max(sum, Number(p.total_supplier_value) || 0), 0);
  });

  protected readonly totalDisbursed = computed(() => {
    return this.payments().reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
  });

  protected readonly totalPending = computed(() => {
    const total = this.totalCommitmentValue();
    const paid = this.totalDisbursed();
    return Math.max(0, total - paid);
  });

  protected readonly disbursementRate = computed(() => {
    const total = this.totalCommitmentValue();
    if (total <= 0) return 0;
    const rate = (this.totalDisbursed() / total) * 100;
    return Math.min(100, Math.round(rate));
  });

  // ── Lifecycle ──────────────────────────────────────────────────
  ngOnInit(): void {
    const pId = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!pId) {
      this.errorMessage.set('Invalid Project ID in route parameter.');
      this.loading.set(false);
      return;
    }
    this.projectId.set(pId);
    this.loadAllStep15Data();
  }

  // ── Data Fetching ──────────────────────────────────────────────
  protected loadAllStep15Data(): void {
    const pId = this.projectId();
    if (!pId) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    // 1. Fetch Project Details
    this.projectService.getProjectById(pId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj.supplier_id) {
          this.supplierService.getSupplierById(proj.supplier_id).subscribe({
            next: (supp) => this.supplier.set(supp),
            error: () => {/* non-fatal */ },
          });
        }
      },
      error: () => {/* non-fatal */ },
    });

    // 2. Fetch Purchase Orders (Step 08 reference)
    this.poService.getByProject(pId).subscribe({
      next: (pos) => this.purchaseOrders.set(pos),
      error: () => {/* non-fatal */ },
    });

    // 3. Fetch Supplier Invoices (Step 10 reference)
    this.supplierInvoiceService.getByProject(pId).subscribe({
      next: (invs) => this.supplierInvoices.set(invs),
      error: () => {/* non-fatal */ },
    });

    // 4. Fetch Supplier Payments (Step 15 records)
    this.supplierPaymentService
      .getSupplierPayments(pId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.payments.set(data),
        error: (err) => {
          console.error('Failed to load supplier payments', err);
          this.errorMessage.set('Failed to load supplier payment records. Please try again.');
        },
      });
  }

  // ── Dialog Management & Calculation ────────────────────────────
  protected openCreatePaymentDialog(): void {
    this.editingPayment.set(null);
    this.selectedFiles.set([]);
    this.existingAttachments.set([]);

    this.paymentForm.reset({
      currency: this.project()?.currency || 'INR',
      payment_percentage: null,
      total_supplier_value: null,
      amount_paid: null,
      payment_date: null,
      transaction_details: '',
      pending_amount: null,
      remark: '',
    });

    this.paymentDialogVisible.set(true);
  }

  protected openEditPaymentDialog(payment: SupplierPayment): void {
    this.editingPayment.set(payment);
    this.selectedFiles.set([]);
    this.existingAttachments.set(payment.attachments || []);

    const payDate = payment.payment_date ? new Date(payment.payment_date) : null;

    this.paymentForm.reset({
      currency: payment.currency || 'INR',
      payment_percentage: payment.payment_percentage ?? null,
      total_supplier_value: payment.total_supplier_value ?? null,
      amount_paid: payment.amount_paid ?? null,
      payment_date: payDate,
      transaction_details: payment.transaction_details || '',
      pending_amount: payment.pending_amount ?? null,
      remark: payment.remark || '',
    });

    this.paymentDialogVisible.set(true);
  }

  // ── Dynamic Percentage & Amount Calculations ───────────────────
  protected onPercentageChange(pct: number | null): void {
    const total = Number(this.paymentForm.get('total_supplier_value')?.value) || 0;
    if (pct != null && total > 0) {
      const calculatedAmount = Math.round(((total * pct) / 100) * 100) / 100;
      const pending = Math.max(0, Math.round((total - calculatedAmount) * 100) / 100);
      this.paymentForm.patchValue({
        amount_paid: calculatedAmount,
        pending_amount: pending,
      }, { emitEvent: false });
    }
  }

  protected onAmountPaidChange(paid: number | null): void {
    const total = Number(this.paymentForm.get('total_supplier_value')?.value) || 0;
    if (paid != null && total > 0) {
      const calculatedPct = Math.round(((paid / total) * 100) * 10) / 10;
      const pending = Math.max(0, Math.round((total - paid) * 100) / 100);
      this.paymentForm.patchValue({
        payment_percentage: Math.min(100, calculatedPct),
        pending_amount: pending,
      }, { emitEvent: false });
    }
  }

  protected onTotalValueChange(total: number | null): void {
    const paid = Number(this.paymentForm.get('amount_paid')?.value) || 0;
    const totVal = Number(total) || 0;
    if (totVal > 0) {
      const pending = Math.max(0, Math.round((totVal - paid) * 100) / 100);
      const calculatedPct = paid > 0 ? Math.round(((paid / totVal) * 100) * 10) / 10 : null;
      this.paymentForm.patchValue({
        pending_amount: pending,
        payment_percentage: calculatedPct,
      }, { emitEvent: false });
    }
  }

  // ── Form Submission ────────────────────────────────────────────
  protected onSubmitPayment(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const val = this.paymentForm.getRawValue();
    let payDateStr = '';
    if (val.payment_date instanceof Date) {
      payDateStr = this.formatDate(val.payment_date);
    } else if (val.payment_date) {
      payDateStr = String(val.payment_date).trim();
    }

    const payload: SupplierPaymentCreateInput = {
      project_id: pId,
      currency: val.currency || 'INR',
      payment_percentage: val.payment_percentage != null ? Number(val.payment_percentage) : undefined,
      total_supplier_value: val.total_supplier_value != null ? Number(val.total_supplier_value) : undefined,
      amount_paid: Number(val.amount_paid) || 0,
      payment_date: payDateStr,
      transaction_details: String(val.transaction_details).trim(),
      pending_amount: val.pending_amount != null ? Number(val.pending_amount) : undefined,
      remark: val.remark ? String(val.remark).trim() : undefined,
    };

    const files = this.selectedFiles();
    const existing = this.editingPayment();

    if (existing) {
      this.supplierPaymentService
        .updateSupplierPayment(existing.id, payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.paymentDialogVisible.set(false);
            this.loadAllStep15Data();
          },
          error: (err) => {
            console.error('Failed to update supplier payment', err);
            this.errorMessage.set('Failed to update supplier payment. Please try again.');
          },
        });
    } else {
      this.supplierPaymentService
        .createSupplierPayment(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.paymentDialogVisible.set(false);
            this.loadAllStep15Data();
          },
          error: (err) => {
            console.error('Failed to create supplier payment', err);
            this.errorMessage.set('Failed to record supplier payment. Please try again.');
          },
        });
    }
  }

  // ── Delete Payment Record ──────────────────────────────────────
  protected deletePayment(id: number): void {
    if (!confirm('Are you sure you want to delete this supplier payment record?')) return;

    this.supplierPaymentService.deleteSupplierPayment(id).subscribe({
      next: () => {
        this.payments.update((list) => list.filter((p) => p.id !== id));
      },
      error: (err) => {
        console.error('Failed to delete supplier payment', err);
        alert('Failed to delete payment record.');
      },
    });
  }

  // ── Navigation ─────────────────────────────────────────────────
  protected goBack(): void {
    const pId = this.projectId();
    if (pId) {
      this.router.navigate(['/projects', pId, 'timeline']);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  // ── Live Calculation Helper for Modal ──────────────────────────
  protected getDialogPendingBalance(): number {
    const val = this.paymentForm.getRawValue();
    const total = Number(val.total_supplier_value) || 0;
    const paid = Number(val.amount_paid) || 0;
    return Math.max(0, total - paid);
  }

  // ── File Management ────────────────────────────────────────────
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.selectedFiles.update((curr) => [...curr, ...newFiles]);
      input.value = '';
    }
  }

  protected onFileDropped(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      const newFiles = Array.from(event.dataTransfer.files);
      this.selectedFiles.update((curr) => [...curr, ...newFiles]);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected removeSelectedFile(index: number): void {
    this.selectedFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected removeExistingAttachment(attId: number): void {
    this.existingAttachments.update((atts) => atts.filter((a) => a.id !== attId));
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
        error: (err) => console.error('Failed to download attachment', err),
      });
  }

  protected formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected isFieldInvalid(form: FormGroup, field: string): boolean {
    const ctrl = form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  protected getFieldError(form: FormGroup, field: string): string {
    const ctrl = form.get(field);
    if (!ctrl || !ctrl.errors) return '';
    if (ctrl.errors['required']) return 'This field is required.';
    if (ctrl.errors['min']) return `Value must be at least ${ctrl.errors['min'].min}.`;
    if (ctrl.errors['max']) return `Value cannot exceed ${ctrl.errors['max'].max}.`;
    return 'Invalid value.';
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
