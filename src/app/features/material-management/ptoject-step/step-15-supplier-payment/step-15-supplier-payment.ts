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
import { SelectOption } from '../../../../core/models/select-option.model';
import { MessageService } from 'primeng/api';
import { StepRemarkItem } from '../../../../core/models/step-remark.model';
import { parseStepRemarks, serializeStepRemarks } from '../../../../core/utils/remark.utils';
import { formatLocalDate, parseLocalDate } from '../../../../core/utils/date.utils';
import { StepRemarksComponent } from '../../../../shared/components/step-remarks/step-remarks';

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
    StepRemarksComponent,
  ],
  templateUrl: './step-15-supplier-payment.html',
  styleUrl: './step-15-supplier-payment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step15SupplierPayment implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly supplierPaymentService = inject(SupplierPaymentService);
  private readonly projectService = inject(ProjectService);
  private readonly supplierService = inject(SupplierService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly dropdownService = inject(DropdownService);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly projectId = signal<number | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly payments = signal<SupplierPayment[]>([]);
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
  protected readonly dialogRemarks = signal<StepRemarkItem[]>([]);
  protected readonly quickAddingId = signal<number | null>(null);

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
    bank_charges_currency: ['INR'],
    bank_charges: [null, [Validators.min(0)]],
    exchange_rate: [null, [Validators.min(0.0001)]],
    total_with_exchange: [null, [Validators.min(0)]],
    total_with_bank_charges: [null, [Validators.min(0)]],
  });

  // ── Forex & Bank Charges Metadata Helpers ──────────────────────
  protected extractPaymentForexMeta(payment: SupplierPayment): {
    exchange_rate?: number | null;
    bank_charges_currency?: string | null;
    bank_charges?: number | null;
    total_with_exchange?: number | null;
    total_with_bank_charges?: number | null;
    clean_transaction_details: string;
  } {
    const rawTx = payment.transaction_details || '';
    const match = rawTx.match(/<!--fx-meta:({.*?})-->/);
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        const cleanTx = rawTx.replace(/<!--fx-meta:({.*?})-->/, '').trim();
        return {
          exchange_rate: meta.exchange_rate != null ? Number(meta.exchange_rate) : undefined,
          bank_charges_currency: meta.bank_charges_currency || undefined,
          bank_charges: meta.bank_charges != null ? Number(meta.bank_charges) : undefined,
          total_with_exchange: meta.total_with_exchange != null ? Number(meta.total_with_exchange) : undefined,
          total_with_bank_charges: meta.total_with_bank_charges != null ? Number(meta.total_with_bank_charges) : undefined,
          clean_transaction_details: cleanTx,
        };
      } catch {
        // fallback
      }
    }
    return {
      exchange_rate: payment.exchange_rate,
      bank_charges_currency: payment.bank_charges_currency,
      bank_charges: payment.bank_charges,
      total_with_exchange: payment.total_with_exchange,
      total_with_bank_charges: payment.total_with_bank_charges,
      clean_transaction_details: rawTx,
    };
  }

  protected getCleanTransactionDetails(payment: SupplierPayment): string {
    return this.extractPaymentForexMeta(payment).clean_transaction_details;
  }

  protected getPaymentExchangeRate(payment: SupplierPayment): number | null {
    const meta = this.extractPaymentForexMeta(payment);
    return payment.exchange_rate ?? meta.exchange_rate ?? null;
  }

  protected getPaymentBankCharges(payment: SupplierPayment): { currency: string; amount: number } | null {
    const meta = this.extractPaymentForexMeta(payment);
    const amount = payment.bank_charges ?? meta.bank_charges;
    if (amount != null && amount > 0) {
      return {
        currency: payment.bank_charges_currency ?? meta.bank_charges_currency ?? 'INR',
        amount: Number(amount),
      };
    }
    return null;
  }

  protected getPaymentTotalWithExchange(payment: SupplierPayment): number | null {
    const meta = this.extractPaymentForexMeta(payment);
    if (payment.total_with_exchange != null) return Number(payment.total_with_exchange);
    if (meta.total_with_exchange != null) return Number(meta.total_with_exchange);
    const rate = this.getPaymentExchangeRate(payment);
    if (rate != null && rate > 0 && payment.amount_paid) {
      return Math.round(Number(payment.amount_paid) * rate * 100) / 100;
    }
    return null;
  }

  protected getPaymentTotalWithBankCharges(payment: SupplierPayment): number | null {
    const meta = this.extractPaymentForexMeta(payment);
    if (payment.total_with_bank_charges != null) return Number(payment.total_with_bank_charges);
    if (meta.total_with_bank_charges != null) return Number(meta.total_with_bank_charges);
    const totEx = this.getPaymentTotalWithExchange(payment) ?? (payment.amount_paid ? Number(payment.amount_paid) : null);
    const charges = this.getPaymentBankCharges(payment);
    if (totEx != null) {
      return Math.round((totEx + (charges?.amount || 0)) * 100) / 100;
    }
    return null;
  }

  // ── Filtered Records ───────────────────────────────────────────
  protected readonly filteredPayments = computed(() => {
    const list = this.payments();
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return list;

    return list.filter((p) => {
      const cleanTx = this.getCleanTransactionDetails(p);
      return (
        String(p.id).includes(query) ||
        (p.currency && p.currency.toLowerCase().includes(query)) ||
        (cleanTx && cleanTx.toLowerCase().includes(query)) ||
        (p.remark && p.remark.toLowerCase().includes(query)) ||
        (p.payment_date && p.payment_date.toLowerCase().includes(query))
      );
    });
  });

  // ── KPI Summary Signals ────────────────────────────────────────
  protected readonly totalCommitmentValue = computed(() => {
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

    // 2. Fetch Supplier Payments (Step 15 records)
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
    this.dialogRemarks.set([]);

    const defaultCurrency = this.project()?.currency || 'INR';
    const defaultRate = defaultCurrency === 'INR' ? 1 : null;

    this.paymentForm.reset({
      currency: defaultCurrency,
      payment_percentage: null,
      total_supplier_value: null,
      amount_paid: null,
      payment_date: null,
      transaction_details: '',
      pending_amount: null,
      remark: '',
      bank_charges_currency: 'INR',
      bank_charges: null,
      exchange_rate: defaultRate,
      total_with_exchange: null,
      total_with_bank_charges: null,
    });

    this.paymentDialogVisible.set(true);
  }

  protected openEditPaymentDialog(payment: SupplierPayment): void {
    this.editingPayment.set(payment);
    this.selectedFiles.set([]);
    this.existingAttachments.set(payment.attachments || []);
    this.dialogRemarks.set(
      parseStepRemarks(payment.remarks || payment.remark, payment.payment_date),
    );

    const payDate = parseLocalDate(payment.payment_date);
    const parsedMeta = this.extractPaymentForexMeta(payment);
    const exRate = payment.exchange_rate ?? parsedMeta.exchange_rate ?? null;
    const bcCurr = payment.bank_charges_currency ?? parsedMeta.bank_charges_currency ?? 'INR';
    const bcAmt = payment.bank_charges ?? parsedMeta.bank_charges ?? null;
    const totEx = payment.total_with_exchange ?? parsedMeta.total_with_exchange ?? (exRate && payment.amount_paid ? Math.round(payment.amount_paid * exRate * 100) / 100 : null);
    const totAll = payment.total_with_bank_charges ?? parsedMeta.total_with_bank_charges ?? ((totEx ?? payment.amount_paid ?? 0) + (bcAmt ?? 0));

    this.paymentForm.reset({
      currency: payment.currency || 'INR',
      payment_percentage: payment.payment_percentage ?? null,
      total_supplier_value: payment.total_supplier_value ?? null,
      amount_paid: payment.amount_paid ?? null,
      payment_date: payDate,
      transaction_details: parsedMeta.clean_transaction_details || payment.transaction_details || '',
      pending_amount: payment.pending_amount ?? null,
      remark: payment.remark || '',
      bank_charges_currency: bcCurr,
      bank_charges: bcAmt,
      exchange_rate: exRate,
      total_with_exchange: totEx,
      total_with_bank_charges: totAll,
    });

    this.paymentDialogVisible.set(true);
  }

  // ── Dynamic Percentage & Amount Calculations ───────────────────
  protected recalculateForexAndBankCharges(): void {
    const amountPaid = Number(this.paymentForm.get('amount_paid')?.value) || 0;
    const rateVal = this.paymentForm.get('exchange_rate')?.value;
    const rate = rateVal != null && rateVal !== '' && !isNaN(Number(rateVal)) ? Number(rateVal) : null;
    const chargesVal = this.paymentForm.get('bank_charges')?.value;
    const charges = chargesVal != null && chargesVal !== '' && !isNaN(Number(chargesVal)) ? Number(chargesVal) : 0;

    let totalWithExchange: number | null = null;
    let totalWithBankCharges: number | null = null;

    if (amountPaid > 0) {
      if (rate != null && rate > 0) {
        totalWithExchange = Math.round(amountPaid * rate * 100) / 100;
      } else {
        totalWithExchange = amountPaid;
      }
    }

    if (totalWithExchange != null) {
      totalWithBankCharges = Math.round((totalWithExchange + charges) * 100) / 100;
    } else if (charges > 0) {
      totalWithBankCharges = charges;
    }

    this.paymentForm.patchValue({
      total_with_exchange: totalWithExchange,
      total_with_bank_charges: totalWithBankCharges,
    }, { emitEvent: false });
  }

  protected onExchangeRateChange(rate: number | null): void {
    this.recalculateForexAndBankCharges();
  }

  protected onBankChargesChange(charges: number | null): void {
    this.recalculateForexAndBankCharges();
  }

  protected onPercentageChange(pct: number | null): void {
    const total = Number(this.paymentForm.get('total_supplier_value')?.value) || 0;
    if (pct != null && total > 0) {
      const calculatedAmount = Math.round(((total * pct) / 100) * 100) / 100;
      const pending = Math.max(0, Math.round((total - calculatedAmount) * 100) / 100);
      this.paymentForm.patchValue({
        amount_paid: calculatedAmount,
        pending_amount: pending,
      }, { emitEvent: false });
      this.recalculateForexAndBankCharges();
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
    this.recalculateForexAndBankCharges();
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

  protected onSubmitPayment(): void {
    if (this.saving()) return;
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const val = this.paymentForm.getRawValue();
    const payDateStr = this.formatDate(val.payment_date);

    const userTx = String(val.transaction_details || '').trim();
    const fxMetaObj = {
      exchange_rate: val.exchange_rate != null && val.exchange_rate !== '' ? Number(val.exchange_rate) : null,
      bank_charges_currency: val.bank_charges_currency || 'INR',
      bank_charges: val.bank_charges != null && val.bank_charges !== '' ? Number(val.bank_charges) : null,
      total_with_exchange: val.total_with_exchange != null ? Number(val.total_with_exchange) : null,
      total_with_bank_charges: val.total_with_bank_charges != null ? Number(val.total_with_bank_charges) : null,
    };
    const txWithMeta = `${userTx} <!--fx-meta:${JSON.stringify(fxMetaObj)}-->`;

    const payload: SupplierPaymentCreateInput = {
      project_id: pId,
      currency: val.currency || 'INR',
      payment_percentage: val.payment_percentage != null ? Number(val.payment_percentage) : undefined,
      total_supplier_value: val.total_supplier_value != null ? Number(val.total_supplier_value) : undefined,
      amount_paid: Number(val.amount_paid) || 0,
      payment_date: payDateStr,
      transaction_details: txWithMeta,
      pending_amount: val.pending_amount != null ? Number(val.pending_amount) : undefined,
      remarks: serializeStepRemarks(this.dialogRemarks()),
      exchange_rate: fxMetaObj.exchange_rate,
      bank_charges_currency: fxMetaObj.bank_charges_currency,
      bank_charges: fxMetaObj.bank_charges,
      total_with_exchange: fxMetaObj.total_with_exchange,
      total_with_bank_charges: fxMetaObj.total_with_bank_charges,
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

  private formatDate(date: Date | string | null | undefined): string {
    return formatLocalDate(date);
  }

  protected quickAddPaymentRemark(item: SupplierPayment, text: string): void {
    const newRemark: StepRemarkItem = {
      id: `rmk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text,
      created_at: new Date().toISOString(),
    };
    const currentRemarks = parseStepRemarks(item.remarks || item.remark, item.payment_date);
    const updatedRemarks = [...currentRemarks, newRemark];
    const remarksPayload = serializeStepRemarks(updatedRemarks);

    this.quickAddingId.set(item.id);
    const updatePayload: SupplierPaymentUpdateInput = {
      remarks: remarksPayload,
    };

    this.supplierPaymentService
      .updateSupplierPayment(item.id, updatePayload)
      .pipe(finalize(() => this.quickAddingId.set(null)))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Remark Added',
            detail: 'New remark saved to Supplier Payment.',
            life: 3000,
          });
          this.loadAllStep15Data();
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

  protected deleteRemarkFromPayment(item: SupplierPayment, remarkId: string): void {
    const currentRemarks = parseStepRemarks(item.remarks || item.remark, item.payment_date);
    const updatedRemarks = currentRemarks.filter((r) => r.id !== remarkId);
    const remarksPayload = serializeStepRemarks(updatedRemarks);

    const updatePayload: SupplierPaymentUpdateInput = {
      remarks: remarksPayload,
    };

    this.supplierPaymentService.updateSupplierPayment(item.id, updatePayload).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Remark Deleted',
          detail: 'Remark removed from Supplier Payment.',
          life: 3000,
        });
        this.loadAllStep15Data();
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
}
