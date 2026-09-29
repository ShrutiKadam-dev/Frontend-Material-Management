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
import { DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';

import { CustomerPaymentService } from '../../../../core/services/customer-payment';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  CustomerPayment,
  CustomerPaymentCreateInput,
  CustomerPaymentUpdateInput,
  CustomerTaxInvoiceLatest,
} from '../../../../core/models/customer-payment.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';
import { StepRemarkItem } from '../../../../core/models/step-remark.model';
import { parseStepRemarks, serializeStepRemarks } from '../../../../core/utils/remark.utils';
import { formatLocalDate, parseLocalDate } from '../../../../core/utils/date.utils';
import { StepRemarksComponent } from '../../../../shared/components/step-remarks/step-remarks';

@Component({
  selector: 'app-step-14-customer-payment',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    TooltipModule,
    DecimalPipe,
    StepRemarksComponent,
  ],
  templateUrl: './step-14-customer-payment.html',
  styleUrl: './step-14-customer-payment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step14CustomerPayment implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly paymentService = inject(CustomerPaymentService);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly attachmentService = inject(AttachmentService);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly projectId = signal<number | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);

  protected readonly payments = signal<CustomerPayment[]>([]);
  protected readonly latestTaxInvoice = signal<CustomerTaxInvoiceLatest | null>(null);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly searchQuery = signal('');

  // ── Dialog & Upload Signals ────────────────────────────────────
  protected readonly paymentDialogVisible = signal(false);
  protected readonly editingPayment = signal<CustomerPayment | null>(null);
  protected readonly selectedFiles = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly dialogRemarks = signal<StepRemarkItem[]>([]);
  protected readonly quickAddingId = signal<number | null>(null);

  // ── Reactive Form ──────────────────────────────────────────────
  protected readonly paymentForm: FormGroup = this.fb.group({
    invoice_no: ['', [Validators.required]],
    invoice_date: ['', [Validators.required]],
    invoice_value: [null, [Validators.required, Validators.min(0)]],
    payment_amount: [null, [Validators.required, Validators.min(0.01)]],
    payment_date: [null, [Validators.required]],
    tds: [0, [Validators.min(0)]],
    ld: [0, [Validators.min(0)]],
    remark: [''],
  });

  // ── Dialog Contextual Remaining Balance & Validation Signals ──
  protected readonly currentInvoiceNo = signal<string>('');
  protected readonly currentInvoiceValue = signal<number | null>(null);
  protected readonly currentPaymentAmount = signal<number | null>(null);
  protected readonly currentTds = signal<number>(0);
  protected readonly currentLd = signal<number>(0);

  constructor() {
    this.paymentForm.valueChanges.subscribe((val) => {
      this.currentInvoiceNo.set(val?.invoice_no ? String(val.invoice_no).trim() : '');
      this.currentInvoiceValue.set(
        val?.invoice_value != null && val?.invoice_value !== '' && !isNaN(Number(val.invoice_value))
          ? Number(val.invoice_value)
          : null,
      );
      this.currentPaymentAmount.set(
        val?.payment_amount != null && val?.payment_amount !== '' && !isNaN(Number(val.payment_amount))
          ? Number(val.payment_amount)
          : null,
      );
      this.currentTds.set(
        val?.tds != null && val?.tds !== '' && !isNaN(Number(val.tds)) ? Number(val.tds) : 0,
      );
      this.currentLd.set(
        val?.ld != null && val?.ld !== '' && !isNaN(Number(val.ld)) ? Number(val.ld) : 0,
      );
    });
  }

  protected readonly dialogPreviouslySettled = computed(() => {
    const editing = this.editingPayment();
    const list = this.payments();
    const currentInvNo = this.currentInvoiceNo().toLowerCase();

    // Filter payments for the same invoice, or all project payments if no invoice_no is set
    const filtered = list.filter((p) => {
      if (editing && p.id === editing.id) return false;
      if (currentInvNo && p.invoice_no) {
        return p.invoice_no.trim().toLowerCase() === currentInvNo;
      }
      return true;
    });

    return filtered.reduce(
      (sum, p) =>
        sum +
        (Number(p.payment_amount ?? p.amount_paid) || 0) +
        (Number(p.tds) || 0) +
        (Number(p.ld ?? p.liquidated_damages) || 0),
      0,
    );
  });

  protected readonly dialogTotalInvoiceValue = computed(() => {
    const formVal = this.currentInvoiceValue();
    if (formVal != null && formVal > 0) return formVal;
    const latestTax = this.latestTaxInvoice();
    if (latestTax && latestTax.net_total > 0) return latestTax.net_total;
    return this.totalInvoiced();
  });

  protected readonly dialogAvailableBalance = computed(() => {
    const total = this.dialogTotalInvoiceValue();
    const prev = this.dialogPreviouslySettled();
    return Math.max(0, Math.round((total - prev) * 100) / 100);
  });

  protected readonly dialogMaxPayable = computed(() => {
    const avail = this.dialogAvailableBalance();
    const tds = this.currentTds();
    const ld = this.currentLd();
    return Math.max(0, Math.round((avail - tds - ld) * 100) / 100);
  });

  protected readonly isAmountExceeding = computed(() => {
    const avail = this.dialogAvailableBalance();
    const payAmt = this.currentPaymentAmount();
    const tds = this.currentTds();
    const ld = this.currentLd();
    if (payAmt == null || payAmt <= 0) return false;
    return (payAmt + tds + ld) > (avail + 0.01) || payAmt > (avail + 0.01);
  });

  // ── Latest Payment Record ──────────────────────────────────────
  protected readonly latestPayment = computed<CustomerPayment | null>(() => {
    const list = this.payments();
    if (!list.length) return null;
    return [...list].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0] || null;
  });

  // ── Computed Filtered Records (Sorted Newest First) ───────────
  protected readonly filteredPayments = computed(() => {
    const list = this.payments();
    const query = this.searchQuery().trim().toLowerCase();
    const sorted = [...list].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    if (!query) return sorted;

    return sorted.filter((p) => {
      return (
        String(p.id).includes(query) ||
        (p.invoice_no && p.invoice_no.toLowerCase().includes(query)) ||
        (p.payment_status && p.payment_status.toLowerCase().includes(query)) ||
        (p.remark && p.remark.toLowerCase().includes(query)) ||
        (p.payment_date && p.payment_date.toLowerCase().includes(query))
      );
    });
  });

  // ── KPI Summary Signals ────────────────────────────────────────
  protected readonly totalInvoiced = computed(() => {
    // If tax invoice template is available, use its net_total; otherwise max of payment invoice_value
    const latest = this.latestTaxInvoice();
    if (latest && latest.net_total > 0) return latest.net_total;

    const list = this.payments();
    if (!list.length) return 0;
    return list.reduce((sum, p) => Math.max(sum, Number(p.invoice_value) || 0), 0);
  });

  protected readonly totalPaymentReceived = computed(() => {
    const lp = this.latestPayment();
    if (lp?.total_paid_amount != null && !isNaN(Number(lp.total_paid_amount))) {
      return Number(lp.total_paid_amount);
    }
    return this.payments().reduce((sum, p) => sum + (Number(p.payment_amount ?? p.amount_paid) || 0), 0);
  });

  protected readonly totalTdsDeducted = computed(() => {
    return this.payments().reduce((sum, p) => sum + (Number(p.tds) || 0), 0);
  });

  protected readonly totalLdDeducted = computed(() => {
    return this.payments().reduce((sum, p) => sum + (Number(p.ld ?? p.liquidated_damages) || 0), 0);
  });

  protected readonly totalDeductions = computed(() => {
    return this.totalTdsDeducted() + this.totalLdDeducted();
  });

  protected readonly totalOutstandingBalance = computed(() => {
    const lp = this.latestPayment();
    if (lp?.is_payment_completed) {
      return 0;
    }
    const inv = this.totalInvoiced();
    const paid = this.totalPaymentReceived();
    const ded = this.totalDeductions();
    const mathOutstanding = Math.max(0, Math.round((inv - paid - ded) * 100) / 100);
    if (lp?.pending_amount != null && !isNaN(Number(lp.pending_amount))) {
      const backendPending = Number(lp.pending_amount);
      if (backendPending <= 0) return 0;
      return Math.min(backendPending, mathOutstanding);
    }
    return mathOutstanding;
  });

  protected readonly realizationRate = computed(() => {
    const lp = this.latestPayment();
    if (lp?.cumulative_payment_percentage != null && !isNaN(Number(lp.cumulative_payment_percentage))) {
      return Math.min(100, Math.round(Number(lp.cumulative_payment_percentage) * 10) / 10);
    }
    const inv = this.totalInvoiced();
    if (inv <= 0) return 0;
    const rate = ((this.totalPaymentReceived() + this.totalDeductions()) / inv) * 100;
    return Math.min(100, Math.round(rate));
  });

  protected readonly isPaymentCompleted = computed(() => {
    const lp = this.latestPayment();
    if (lp?.is_payment_completed !== undefined) {
      return Boolean(lp.is_payment_completed);
    }
    return this.totalOutstandingBalance() <= 0.01 && this.totalInvoiced() > 0;
  });

  protected readonly latestPaymentStatusMessage = computed(() => {
    const lp = this.latestPayment();
    if (lp?.payment_status_message) {
      return lp.payment_status_message;
    }
    if (this.payments().length > 0) {
      return this.isPaymentCompleted() ? 'Payment completed' : `${this.realizationRate()}% settled`;
    }
    return null;
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
    this.loadAllStep14Data();
  }

  // ── Data Fetching ──────────────────────────────────────────────
  protected loadAllStep14Data(): void {
    const pId = this.projectId();
    if (!pId) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    // 1. Fetch Project Details
    this.projectService.getProjectById(pId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj.customer_id) {
          this.customerService.getCustomerById(proj.customer_id).subscribe({
            next: (cust) => this.customer.set(cust),
            error: () => {/* non-fatal */ },
          });
        }
      },
      error: () => {/* non-fatal */ },
    });

    // 2. Fetch Latest Tax Invoice Template (GET /api/v1/customer-tax-invoices/latest)
    this.paymentService.getLatestCustomerTaxInvoice(pId).subscribe({
      next: (template) => this.latestTaxInvoice.set(template),
      error: () => {/* non-fatal */ },
    });

    // 3. Fetch Customer Payments
    this.paymentService
      .getCustomerPayments(pId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.payments.set(data),
        error: (err) => {
          console.error('Failed to load customer payments', err);
          this.errorMessage.set('Failed to load customer payment records. Please try again.');
        },
      });
  }

  // ── Dialog Management & Auto-Patching ──────────────────────────
  protected openCreatePaymentDialog(): void {
    this.editingPayment.set(null);
    this.selectedFiles.set([]);
    this.existingAttachments.set([]);
    this.dialogRemarks.set([]);

    const invoice = this.latestTaxInvoice();

    this.paymentForm.reset({
      invoice_no: invoice?.invoice_no || '',
      invoice_date: invoice?.invoice_date || '',
      invoice_value: invoice?.net_total ?? null,
      payment_amount: null,
      payment_date: null,
      tds: 0,
      ld: 0,
      remark: '',
    });

    this.currentInvoiceNo.set(invoice?.invoice_no || '');
    this.currentInvoiceValue.set(invoice?.net_total ?? null);
    this.currentPaymentAmount.set(null);
    this.currentTds.set(0);
    this.currentLd.set(0);

    this.paymentDialogVisible.set(true);
  }

  protected openEditPaymentDialog(payment: CustomerPayment): void {
    this.editingPayment.set(payment);
    this.selectedFiles.set([]);
    this.existingAttachments.set(payment.attachments || []);
    this.dialogRemarks.set(parseStepRemarks(payment.remarks || payment.remark, payment.payment_date));

    const payDate = parseLocalDate(payment.payment_date);

    const payAmt = Number(payment.payment_amount ?? payment.amount_paid ?? 0);
    const ldAmt = Number(payment.ld ?? payment.liquidated_damages ?? 0);
    const invNo = payment.invoice_no || payment.invoice_number || '';

    this.paymentForm.reset({
      invoice_no: invNo,
      invoice_date: payment.invoice_date || '',
      invoice_value: payment.invoice_value ?? null,
      payment_amount: payAmt || null,
      payment_date: payDate,
      tds: payment.tds ?? 0,
      ld: ldAmt,
      remark: payment.remark || '',
    });

    this.currentInvoiceNo.set(invNo);
    this.currentInvoiceValue.set(payment.invoice_value ?? null);
    this.currentPaymentAmount.set(payAmt || null);
    this.currentTds.set(payment.tds ?? 0);
    this.currentLd.set(ldAmt);

    this.paymentDialogVisible.set(true);
  }

  protected onInvoiceNoInput(val: string): void {
    this.currentInvoiceNo.set(val ? val.trim() : '');
  }

  protected onPaymentAmountInput(val: string): void {
    const num = val !== '' && !isNaN(Number(val)) ? Number(val) : null;
    this.currentPaymentAmount.set(num);
  }

  protected onTdsInput(val: string): void {
    const num = val !== '' && !isNaN(Number(val)) ? Number(val) : 0;
    this.currentTds.set(num);
  }

  protected onLdInput(val: string): void {
    const num = val !== '' && !isNaN(Number(val)) ? Number(val) : 0;
    this.currentLd.set(num);
  }

  protected onInvoiceValueInput(val: string): void {
    const num = val !== '' && !isNaN(Number(val)) ? Number(val) : null;
    this.currentInvoiceValue.set(num);
  }

  protected onPaymentAmountBlur(): void {
    if (this.isAmountExceeding()) {
      const avail = this.dialogAvailableBalance();
      const maxPay = this.dialogMaxPayable();
      this.messageService.add({
        severity: 'warn',
        summary: 'Limit Exceeded',
        detail: `Payment exceeds remaining balance of ₹ ${avail.toFixed(2)}. Maximum payable is ₹ ${maxPay.toFixed(2)}.`,
        life: 4500,
      });
    }
  }

  protected onDeductionBlur(): void {
    if (this.isAmountExceeding()) {
      const avail = this.dialogAvailableBalance();
      const maxPay = this.dialogMaxPayable();
      this.messageService.add({
        severity: 'warn',
        summary: 'Limit Exceeded',
        detail: `Total deductions with payment exceed remaining balance of ₹ ${avail.toFixed(2)}. Maximum payable after deductions is ₹ ${maxPay.toFixed(2)}.`,
        life: 4500,
      });
    }
  }

  protected onSubmitPayment(): void {
    if (this.saving()) return;
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    if (this.isAmountExceeding()) {
      const avail = this.dialogAvailableBalance();
      const maxPay = this.dialogMaxPayable();
      this.messageService.add({
        severity: 'error',
        summary: 'Cannot Submit: Balance Exceeded',
        detail: `Payment amount exceeds the remaining balance of ₹ ${avail.toFixed(2)}. Maximum payable is ₹ ${maxPay.toFixed(2)}.`,
        life: 5000,
      });
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const val = this.paymentForm.getRawValue();
    const payDateStr = this.formatDate(val.payment_date);

    const payload: CustomerPaymentCreateInput = {
      project_id: pId,
      customer_id: this.customer()?.id || this.project()?.customer_id,
      invoice_no: String(val.invoice_no).trim(),
      invoice_number: String(val.invoice_no).trim(),
      invoice_date: String(val.invoice_date).trim(),
      invoice_value: Number(val.invoice_value) || 0,
      payment_amount: Number(val.payment_amount) || 0,
      amount_paid: Number(val.payment_amount) || 0,
      payment_date: payDateStr,
      tds: Number(val.tds) || 0,
      ld: Number(val.ld) || 0,
      liquidated_damages: Number(val.ld) || 0,
      payment_percentage: this.getDialogLivePercentage(),
      remarks: serializeStepRemarks(this.dialogRemarks()),
    };

    const files = this.selectedFiles();
    const existing = this.editingPayment();

    if (existing) {
      this.paymentService
        .updateCustomerPayment(existing.id, payload as CustomerPaymentUpdateInput, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.paymentDialogVisible.set(false);
            this.loadAllStep14Data();
          },
          error: (err) => console.error('Failed to update customer payment', err),
        });
    } else {
      this.paymentService
        .createCustomerPayment(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.paymentDialogVisible.set(false);
            this.loadAllStep14Data();
          },
          error: (err) => console.error('Failed to record customer payment', err),
        });
    }
  }

  protected deletePayment(item: CustomerPayment): void {
    if (!confirm(`Are you sure you want to delete Customer Payment record #${item.id}?`)) return;
    this.paymentService.deleteCustomerPayment(item.id).subscribe({
      next: () => this.loadAllStep14Data(),
      error: (err) => console.error('Failed to delete customer payment', err),
    });
  }

  // ── Navigation ─────────────────────────────────────────────────
  protected goBack(): void {
    const pId = this.projectId();
    if (pId) {
      this.router.navigate(['/projects', pId, 'steps']);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  // ── Calculation Helpers ────────────────────────────────────────
  protected getPaymentPercentage(p: CustomerPayment): number {
    if (p.is_payment_completed || this.calculateSettlementBalance(p) <= 0) {
      if (p.cumulative_payment_percentage != null && !isNaN(Number(p.cumulative_payment_percentage))) {
        return Math.min(100, Math.max(0, Math.round(Number(p.cumulative_payment_percentage) * 10) / 10));
      }
      return 100;
    }
    if (p.payment_percentage != null && !isNaN(Number(p.payment_percentage))) {
      const pct = Number(p.payment_percentage);
      if (pct > 0 && pct <= 100) {
        return Math.round(pct * 10) / 10;
      }
    }
    const inv = Number(p.invoice_value) || this.totalInvoiced();
    const paid = Number(p.payment_amount ?? p.amount_paid) || 0;
    if (inv <= 0 || paid <= 0) return 0;
    return Math.min(100, Math.round((paid / inv) * 1000) / 10);
  }

  protected getRemainingPercentage(p: CustomerPayment): number {
    if (p.is_payment_completed || this.calculateSettlementBalance(p) <= 0) {
      return 0;
    }
    if (p.pending_percentage != null && !isNaN(Number(p.pending_percentage))) {
      const pct = Number(p.pending_percentage);
      if (pct >= 0 && pct <= 100) {
        return Math.round(pct * 10) / 10;
      }
    }
    const inv = Number(p.invoice_value) || this.totalInvoiced();
    const balance = this.calculateSettlementBalance(p);
    if (inv <= 0 || balance <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((balance / inv) * 1000) / 10));
  }

  protected calculateSettlementBalance(p: CustomerPayment): number {
    const inv = Number(p.invoice_value) || 0;
    const paid = Number(p.payment_amount ?? p.amount_paid) || 0;
    const tds = Number(p.tds) || 0;
    const ld = Number(p.ld ?? p.liquidated_damages) || 0;
    const mathBalance = Math.max(0, Math.round((inv - paid - tds - ld) * 100) / 100);

    if (p.is_payment_completed) {
      return 0;
    }
    if (p.pending_amount != null && !isNaN(Number(p.pending_amount))) {
      const backendPending = Number(p.pending_amount);
      if (backendPending <= 0) return 0;
      return Math.min(backendPending, mathBalance);
    }
    return mathBalance;
  }

  protected getDialogLiveBalance(): number {
    const avail = this.dialogAvailableBalance();
    const paid = this.currentPaymentAmount() || 0;
    const tds = this.currentTds();
    const ld = this.currentLd();
    return Math.round((avail - paid - tds - ld) * 100) / 100;
  }

  protected getDialogLivePercentage(): number {
    const val = this.paymentForm.getRawValue();
    const inv = Number(val.invoice_value) || 0;
    const paid = Number(val.payment_amount) || 0;
    if (inv <= 0 || paid <= 0) return 0;
    return Math.round((paid / inv) * 1000) / 10;
  }

  protected getDialogLiveRemainingPercentage(): number {
    const total = this.dialogTotalInvoiceValue();
    if (total <= 0) return 0;
    const remBal = this.getDialogLiveBalance();
    if (remBal <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((remBal / total) * 1000) / 10));
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

  protected getFileIcon(contentType?: string): string {
    if (!contentType) return 'pi pi-file';
    if (contentType.includes('pdf')) return 'pi pi-file-pdf';
    if (contentType.includes('image')) return 'pi pi-image';
    if (contentType.includes('excel') || contentType.includes('sheet') || contentType.includes('csv'))
      return 'pi pi-file-excel';
    if (contentType.includes('word') || contentType.includes('document')) return 'pi pi-file-word';
    return 'pi pi-file';
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
    return 'Invalid value.';
  }

  private formatDate(date: Date | string | null | undefined): string {
    return formatLocalDate(date);
  }

  protected quickAddPaymentRemark(item: CustomerPayment, text: string): void {
    const newRemark: StepRemarkItem = {
      id: `rmk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      created_at: new Date().toISOString(),
    };
    const currentRemarks = parseStepRemarks(item.remarks || item.remark, item.payment_date);
    const updatedRemarks = [...currentRemarks, newRemark];
    const remarksPayload = serializeStepRemarks(updatedRemarks);

    this.quickAddingId.set(item.id);
    const updatePayload: CustomerPaymentUpdateInput = {
      remarks: remarksPayload,
    };

    this.paymentService
      .updateCustomerPayment(item.id, updatePayload)
      .pipe(finalize(() => this.quickAddingId.set(null)))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Remark Added',
            detail: 'New remark saved to Customer Payment.',
            life: 3000,
          });
          this.loadAllStep14Data();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to add remark. Please try again.',
          });
        },
      });
  }

  protected deleteRemarkFromPayment(item: CustomerPayment, remarkId: string): void {
    const currentRemarks = parseStepRemarks(item.remarks || item.remark, item.payment_date);
    const updatedRemarks = currentRemarks.filter((r) => r.id !== remarkId);
    const remarksPayload = serializeStepRemarks(updatedRemarks);

    const updatePayload: CustomerPaymentUpdateInput = {
      remarks: remarksPayload,
    };

    this.paymentService.updateCustomerPayment(item.id, updatePayload).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Remark Deleted',
          detail: 'Remark removed from Customer Payment.',
          life: 3000,
        });
        this.loadAllStep14Data();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete remark.',
        });
      },
    });
  }

  protected formatDisplayDate(date: Date | string | null | undefined): string {
    if (!date) return '—';
    if (typeof date === 'string') {
      const trimmed = date.trim();
      if (!trimmed) return '—';
      if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
        return trimmed;
      }
      const matchYmd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (matchYmd) {
        return `${matchYmd[3]}-${matchYmd[2]}-${matchYmd[1]}`;
      }
    }
    const parsed = parseLocalDate(date);
    if (!parsed) return typeof date === 'string' ? date : '—';
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }
}
