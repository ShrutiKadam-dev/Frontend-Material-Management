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
import { OrderConfirmationService } from '../../../../core/services/order-confirmation';
import {
  SupplierPayment,
  SupplierPaymentCreateInput,
  SupplierPaymentUpdateInput,
} from '../../../../core/models/supplier-payment.model';
import { LatestOrderConfirmation } from '../../../../core/models/order-confirmation.model';
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
  private readonly orderConfirmationService = inject(OrderConfirmationService);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly projectId = signal<number | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly latestOrderConfirmation = signal<LatestOrderConfirmation | null>(null);
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
    swift_charges: [null, [Validators.min(0)]],
    exchange_rate: [null, [Validators.min(0.0001)]],
    total_with_exchange: [null, [Validators.min(0)]],
    total_outflow: [null, [Validators.min(0)]],
  });

  // ── Forex & Bank Charges Metadata Helpers ──────────────────────
  protected extractPaymentForexMeta(payment: SupplierPayment): {
    exchange_rate?: number | null;
    bank_charges_currency?: string | null;
    bank_charges?: number | null;
    swift_charges?: number | null;
    total_with_exchange?: number | null;
    total_outflow?: number | null;
    total_with_bank_charges?: number | null;
    clean_transaction_details: string;
  } {
    const rawTx = payment.transaction_details || '';
    const match = rawTx.match(/<!--fx-meta:({.*?})-->/);
    const rawOutflow = payment.total_outflow ?? payment.total_with_bank_charges;
    const paymentOutflow = rawOutflow != null && (rawOutflow as any) !== '' && !isNaN(Number(rawOutflow)) ? Number(rawOutflow) : undefined;
    const paymentExRate = payment.exchange_rate != null && (payment.exchange_rate as any) !== '' && !isNaN(Number(payment.exchange_rate)) ? Number(payment.exchange_rate) : undefined;
    const paymentBankCharges = payment.bank_charges != null && (payment.bank_charges as any) !== '' && !isNaN(Number(payment.bank_charges)) ? Number(payment.bank_charges) : undefined;
    const paymentSwift = payment.swift_charges != null && (payment.swift_charges as any) !== '' && !isNaN(Number(payment.swift_charges)) ? Number(payment.swift_charges) : undefined;
    const paymentTotEx = payment.total_with_exchange != null && (payment.total_with_exchange as any) !== '' && !isNaN(Number(payment.total_with_exchange)) ? Number(payment.total_with_exchange) : undefined;

    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        const cleanTx = rawTx.replace(/<!--fx-meta:({.*?})-->/, '').trim();
        const metaOutflow = meta.total_outflow != null ? Number(meta.total_outflow) : (meta.total_with_bank_charges != null ? Number(meta.total_with_bank_charges) : undefined);
        return {
          exchange_rate: paymentExRate ?? (meta.exchange_rate != null ? Number(meta.exchange_rate) : undefined),
          bank_charges_currency: payment.bank_charges_currency ?? meta.bank_charges_currency ?? undefined,
          bank_charges: paymentBankCharges ?? (meta.bank_charges != null ? Number(meta.bank_charges) : undefined),
          swift_charges: paymentSwift ?? (meta.swift_charges != null ? Number(meta.swift_charges) : undefined),
          total_with_exchange: paymentTotEx ?? (meta.total_with_exchange != null ? Number(meta.total_with_exchange) : undefined),
          total_outflow: paymentOutflow ?? metaOutflow,
          total_with_bank_charges: paymentOutflow ?? metaOutflow,
          clean_transaction_details: cleanTx,
        };
      } catch {
        // fallback
      }
    }
    return {
      exchange_rate: paymentExRate,
      bank_charges_currency: payment.bank_charges_currency,
      bank_charges: paymentBankCharges,
      swift_charges: paymentSwift,
      total_with_exchange: paymentTotEx,
      total_outflow: paymentOutflow,
      total_with_bank_charges: paymentOutflow,
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

  protected getPaymentSwiftCharges(payment: SupplierPayment): number | null {
    const meta = this.extractPaymentForexMeta(payment);
    const amount = payment.swift_charges ?? meta.swift_charges;
    if (amount != null && Number(amount) > 0) {
      return Number(amount);
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
    const directOutflow = payment.total_outflow ?? payment.total_with_bank_charges ?? meta.total_outflow ?? meta.total_with_bank_charges;
    if (directOutflow != null) return Number(directOutflow);
    const totEx = this.getPaymentTotalWithExchange(payment) ?? (payment.amount_paid ? Number(payment.amount_paid) : null);
    const charges = this.getPaymentBankCharges(payment);
    const swift = this.getPaymentSwiftCharges(payment);
    if (totEx != null) {
      return Math.round((totEx + (charges?.amount || 0) + (swift || 0)) * 100) / 100;
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

  // ── Latest Payment Record ──────────────────────────────────────
  protected readonly latestPayment = computed<SupplierPayment | null>(() => {
    const list = this.payments();
    if (!list.length) return null;
    return [...list].sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0] || null;
  });

  // ── Currency Signal for Cards ──────────────────────────────────
  protected readonly cardCurrency = computed(() => {
    const lp = this.latestPayment();
    return (
      lp?.currency ||
      this.latestOrderConfirmation()?.currency_unit ||
      this.latestOrderConfirmation()?.currency ||
      this.project()?.currency ||
      'INR'
    );
  });

  // ── KPI Summary Signals ────────────────────────────────────────
  protected readonly totalCommitmentValue = computed(() => {
    const lp = this.latestPayment();
    if (lp?.total_supplier_value != null && !isNaN(Number(lp.total_supplier_value)) && Number(lp.total_supplier_value) > 0) {
      return Number(lp.total_supplier_value);
    }
    const oc = this.latestOrderConfirmation();
    if (oc?.total_amount != null && !isNaN(Number(oc.total_amount)) && Number(oc.total_amount) > 0) {
      return Number(oc.total_amount);
    }
    const list = this.payments();
    if (list.length) {
      const maxFromPayments = list.reduce((sum, p) => Math.max(sum, Number(p.total_supplier_value) || 0), 0);
      if (maxFromPayments > 0) {
        return maxFromPayments;
      }
    }
    if (oc?.total_amount != null && !isNaN(Number(oc.total_amount))) {
      return Number(oc.total_amount);
    }
    return 0;
  });

  protected readonly totalDisbursed = computed(() => {
    const lp = this.latestPayment();
    if (lp?.total_paid_amount != null && !isNaN(Number(lp.total_paid_amount))) {
      return Number(lp.total_paid_amount);
    }
    return this.payments().reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
  });

  protected readonly totalPending = computed(() => {
    const lp = this.latestPayment();
    if (lp?.pending_amount != null && !isNaN(Number(lp.pending_amount))) {
      return Math.max(0, Number(lp.pending_amount));
    }
    const total = this.totalCommitmentValue();
    const paid = this.totalDisbursed();
    return Math.max(0, total - paid);
  });

  protected readonly cumulativePaidPercentage = computed(() => {
    const lp = this.latestPayment();
    if (lp?.cumulative_payment_percentage != null && !isNaN(Number(lp.cumulative_payment_percentage))) {
      return Math.min(100, Math.round(Number(lp.cumulative_payment_percentage) * 10) / 10);
    }
    const total = this.totalCommitmentValue();
    if (total <= 0) return 0;
    return Math.min(100, Math.round(((this.totalDisbursed() / total) * 100) * 10) / 10);
  });

  protected readonly pendingPercentage = computed(() => {
    const lp = this.latestPayment();
    if (lp?.pending_percentage != null && !isNaN(Number(lp.pending_percentage))) {
      return Math.max(0, Math.round(Number(lp.pending_percentage) * 10) / 10);
    }
    return Math.max(0, Math.round((100 - this.cumulativePaidPercentage()) * 10) / 10);
  });

  protected readonly disbursementRate = computed(() => {
    return Math.round(this.cumulativePaidPercentage());
  });

  protected readonly latestPaymentStatusMessage = computed(() => {
    const lp = this.latestPayment();
    if (lp?.payment_status_message) {
      return lp.payment_status_message;
    }
    if (this.payments().length > 0) {
      return `${this.cumulativePaidPercentage()}% paid, ${this.pendingPercentage()}% pending`;
    }
    return null;
  });

  protected readonly isPaymentCompleted = computed(() => {
    const lp = this.latestPayment();
    if (lp?.is_payment_completed !== undefined) {
      return Boolean(lp.is_payment_completed);
    }
    return this.totalPending() <= 0.01 && this.totalCommitmentValue() > 0;
  });

  protected getPaymentCommitmentValue(payment: SupplierPayment): number {
    return Number(payment.total_supplier_value) || this.totalCommitmentValue() || 0;
  }

  // ── Dialog Contextual Milestone Signals ────────────────────────
  protected readonly currentAmountPaid = signal<number | null>(null);
  protected readonly currentPercentage = signal<number | null>(null);

  protected readonly dialogPreviouslyPaid = computed(() => {
    const editing = this.editingPayment();
    if (editing) {
      return this.payments()
        .filter((p) => p.id !== editing.id)
        .reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
    }
    return this.totalDisbursed();
  });

  protected readonly dialogPreviouslyPaidPct = computed(() => {
    const total = this.totalCommitmentValue();
    if (total <= 0) return 0;
    return Math.min(100, Math.round(((this.dialogPreviouslyPaid() / total) * 100) * 10) / 10);
  });

  protected readonly dialogAvailablePending = computed(() => {
    const total = this.totalCommitmentValue();
    return Math.max(0, Math.round((total - this.dialogPreviouslyPaid()) * 100) / 100);
  });

  protected readonly dialogAvailablePendingPct = computed(() => {
    const total = this.totalCommitmentValue();
    if (total <= 0) return 0;
    return Math.max(0, Math.round((100 - this.dialogPreviouslyPaidPct()) * 10) / 10);
  });

  protected readonly isAmountExceeding = computed(() => {
    const avail = this.dialogAvailablePending();
    const currentPaid = this.currentAmountPaid();
    if (currentPaid == null || currentPaid <= 0) return false;
    return currentPaid > (avail + 0.01);
  });

  protected readonly isPercentageExceeding = computed(() => {
    const availPct = this.dialogAvailablePendingPct();
    const currentPct = this.currentPercentage();
    if (currentPct == null || currentPct <= 0) return false;
    return currentPct > (availPct + 0.01);
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

    // 2. Fetch Latest Order Confirmation for committed value & currency
    this.orderConfirmationService.getLatestOrderConfirmation(pId).subscribe({
      next: (latest) => this.latestOrderConfirmation.set(latest),
      error: () => {/* non-fatal */ },
    });

    // 3. Fetch Supplier Payments (Step 15 records)
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

    const lp = this.latestPayment();
    const defaultCurrency = lp?.currency || this.cardCurrency();
    const defaultTotal = this.totalCommitmentValue() || null;
    const availPending = this.dialogAvailablePending();
    const availPendingPct = this.dialogAvailablePendingPct();

    let defaultRate: number | null = null;
    if (lp?.exchange_rate != null && !isNaN(Number(lp.exchange_rate))) {
      defaultRate = Number(lp.exchange_rate);
    } else {
      defaultRate = defaultCurrency === 'INR' ? 1 : null;
    }

    const defaultBankChargesCurr = lp?.bank_charges_currency || 'INR';

    // User view: Payment percentage and amount should NOT be pre-patched.
    // It depends on the user how much they want to disburse in this tranche.
    const defaultPending = availPending > 0 ? availPending : null;

    this.paymentForm.reset({
      currency: defaultCurrency,
      payment_percentage: null,
      total_supplier_value: defaultTotal,
      amount_paid: null,
      payment_date: null,
      transaction_details: '',
      pending_amount: defaultPending,
      remark: '',
      bank_charges_currency: defaultBankChargesCurr,
      bank_charges: null,
      swift_charges: null,
      exchange_rate: defaultRate,
      total_with_exchange: null,
      total_outflow: null,
    });

    this.currentAmountPaid.set(null);
    this.currentPercentage.set(null);

    // Apply strict maximum validators based on available outstanding balance
    if (availPending > 0) {
      this.paymentForm.get('amount_paid')?.setValidators([
        Validators.required,
        Validators.min(0.01),
        Validators.max(availPending),
      ]);
      this.paymentForm.get('amount_paid')?.updateValueAndValidity();
    }
    if (availPendingPct > 0) {
      this.paymentForm.get('payment_percentage')?.setValidators([
        Validators.min(0),
        Validators.max(availPendingPct),
      ]);
      this.paymentForm.get('payment_percentage')?.updateValueAndValidity();
    }

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
    const swiftAmt = payment.swift_charges ?? parsedMeta.swift_charges ?? null;
    const amtPaid = payment.amount_paid != null ? Number(payment.amount_paid) : null;
    const totEx = payment.total_with_exchange ?? parsedMeta.total_with_exchange ?? (exRate && amtPaid ? Math.round(amtPaid * Number(exRate) * 100) / 100 : null);
    const totAll = payment.total_with_bank_charges ?? parsedMeta.total_with_bank_charges ?? ((totEx ?? amtPaid ?? 0) + (Number(bcAmt) || 0) + (Number(swiftAmt) || 0));

    this.paymentForm.reset({
      currency: payment.currency || this.cardCurrency(),
      payment_percentage: payment.payment_percentage != null ? Number(payment.payment_percentage) : null,
      total_supplier_value: payment.total_supplier_value != null ? Number(payment.total_supplier_value) : (this.totalCommitmentValue() || null),
      amount_paid: amtPaid,
      payment_date: payDate,
      transaction_details: parsedMeta.clean_transaction_details || payment.transaction_details || '',
      pending_amount: payment.pending_amount != null ? Number(payment.pending_amount) : null,
      remark: payment.remark || '',
      bank_charges_currency: bcCurr,
      bank_charges: bcAmt != null ? Number(bcAmt) : null,
      swift_charges: swiftAmt != null ? Number(swiftAmt) : null,
      exchange_rate: exRate != null ? Number(exRate) : null,
      total_with_exchange: totEx != null ? Number(totEx) : null,
      total_outflow: totAll != null ? Number(totAll) : null,
    });

    this.paymentForm.get('amount_paid')?.setValidators([Validators.required, Validators.min(0.01)]);
    this.paymentForm.get('payment_percentage')?.setValidators([Validators.min(0), Validators.max(100)]);
    this.paymentForm.get('amount_paid')?.updateValueAndValidity();
    this.paymentForm.get('payment_percentage')?.updateValueAndValidity();

    this.currentAmountPaid.set(amtPaid);
    this.currentPercentage.set(payment.payment_percentage != null ? Number(payment.payment_percentage) : null);

    this.paymentDialogVisible.set(true);
  }

  // ── Blur Validation Handlers ───────────────────────────────────
  protected onPercentageBlur(): void {
    if (this.isPercentageExceeding()) {
      const availPct = this.dialogAvailablePendingPct();
      this.messageService.add({
        severity: 'warn',
        summary: 'Limit Exceeded',
        detail: `Entered percentage exceeds remaining balance (${availPct}%). Maximum allowed is ${availPct}%.`,
        life: 4500,
      });
    }
  }

  protected onAmountPaidBlur(): void {
    if (this.isAmountExceeding()) {
      const avail = this.dialogAvailablePending();
      const curr = this.paymentForm.get('currency')?.value || this.cardCurrency();
      this.messageService.add({
        severity: 'warn',
        summary: 'Limit Exceeded',
        detail: `Payment exceeds outstanding balance of ${curr} ${avail.toFixed(2)}. Maximum payable is ${avail.toFixed(2)}.`,
        life: 4500,
      });
    }
  }

  protected onCurrencyChange(curr: string): void {
    if (curr === 'INR') {
      const currentRate = this.paymentForm.get('exchange_rate')?.value;
      if (!currentRate || currentRate === 1) {
        this.paymentForm.patchValue({ exchange_rate: 1 }, { emitEvent: false });
      }
    }
    this.recalculateForexAndBankCharges();
  }

  // ── Dynamic Percentage & Amount Calculations ───────────────────
  protected recalculateForexAndBankCharges(): void {
    const amountPaid = Number(this.paymentForm.get('amount_paid')?.value) || 0;
    const rateVal = this.paymentForm.get('exchange_rate')?.value;
    const rate = rateVal != null && rateVal !== '' && !isNaN(Number(rateVal)) ? Number(rateVal) : null;
    const chargesVal = this.paymentForm.get('bank_charges')?.value;
    const charges = chargesVal != null && chargesVal !== '' && !isNaN(Number(chargesVal)) ? Number(chargesVal) : 0;
    const swiftVal = this.paymentForm.get('swift_charges')?.value;
    const swift = swiftVal != null && swiftVal !== '' && !isNaN(Number(swiftVal)) ? Number(swiftVal) : 0;

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
      totalWithBankCharges = Math.round((totalWithExchange + charges + swift) * 100) / 100;
    } else if (charges > 0 || swift > 0) {
      totalWithBankCharges = Math.round((charges + swift) * 100) / 100;
    }

    this.paymentForm.patchValue({
      total_with_exchange: totalWithExchange,
      total_outflow: totalWithBankCharges,
    }, { emitEvent: false });
  }

  protected onExchangeRateChange(rate: number | null): void {
    this.recalculateForexAndBankCharges();
  }

  protected onBankChargesChange(charges: number | null): void {
    this.recalculateForexAndBankCharges();
  }

  protected onSwiftChargesChange(charges: number | null): void {
    this.recalculateForexAndBankCharges();
  }

  protected onPercentageChange(pct: number | null): void {
    const pVal = pct != null && (pct as any) !== '' && !isNaN(Number(pct)) ? Number(pct) : null;
    this.currentPercentage.set(pVal);

    const total = Number(this.paymentForm.get('total_supplier_value')?.value) || this.totalCommitmentValue() || 0;
    const previouslyPaid = this.dialogPreviouslyPaid();
    if (pVal != null && total > 0) {
      const calculatedAmount = Math.round(((total * pVal) / 100) * 100) / 100;
      this.currentAmountPaid.set(calculatedAmount);
      const totalPaidAfterThis = previouslyPaid + calculatedAmount;
      const pending = Math.max(0, Math.round((total - totalPaidAfterThis) * 100) / 100);
      this.paymentForm.patchValue({
        amount_paid: calculatedAmount,
        pending_amount: pending,
      }, { emitEvent: false });
      this.recalculateForexAndBankCharges();
    } else if (pVal == null) {
      this.currentAmountPaid.set(null);
      const pending = Math.max(0, Math.round((total - previouslyPaid) * 100) / 100);
      this.paymentForm.patchValue({
        amount_paid: null,
        pending_amount: pending,
      }, { emitEvent: false });
      this.recalculateForexAndBankCharges();
    }
  }

  protected onAmountPaidChange(paid: number | null): void {
    const aVal = paid != null && (paid as any) !== '' && !isNaN(Number(paid)) ? Number(paid) : null;
    this.currentAmountPaid.set(aVal);

    const total = Number(this.paymentForm.get('total_supplier_value')?.value) || this.totalCommitmentValue() || 0;
    const previouslyPaid = this.dialogPreviouslyPaid();
    const currentPaid = aVal || 0;
    if (total > 0 && aVal != null && aVal > 0) {
      const calculatedPct = Math.round(((currentPaid / total) * 100) * 10) / 10;
      this.currentPercentage.set(calculatedPct);
      const totalPaidAfterThis = previouslyPaid + currentPaid;
      const pending = Math.max(0, Math.round((total - totalPaidAfterThis) * 100) / 100);
      this.paymentForm.patchValue({
        payment_percentage: calculatedPct,
        pending_amount: pending,
      }, { emitEvent: false });
    } else if (!aVal) {
      this.currentPercentage.set(null);
      const pending = Math.max(0, Math.round((total - previouslyPaid) * 100) / 100);
      this.paymentForm.patchValue({
        payment_percentage: null,
        pending_amount: pending,
      }, { emitEvent: false });
    }
    this.recalculateForexAndBankCharges();
  }

  protected onTotalValueChange(total: number | null): void {
    const totVal = Number(total) || 0;
    const pct = this.currentPercentage() ?? Number(this.paymentForm.get('payment_percentage')?.value);
    const previouslyPaid = this.dialogPreviouslyPaid();
    if (totVal > 0 && !isNaN(pct) && pct > 0) {
      const calculatedAmount = Math.round(((totVal * pct) / 100) * 100) / 100;
      this.currentAmountPaid.set(calculatedAmount);
      const totalPaidAfterThis = previouslyPaid + calculatedAmount;
      const pending = Math.max(0, Math.round((totVal - totalPaidAfterThis) * 100) / 100);
      this.paymentForm.patchValue({
        amount_paid: calculatedAmount,
        pending_amount: pending,
      }, { emitEvent: false });
      this.recalculateForexAndBankCharges();
    }
  }

  protected fillRemainingPayment(): void {
    const availPending = this.dialogAvailablePending();
    const availPendingPct = this.dialogAvailablePendingPct();
    this.currentAmountPaid.set(availPending);
    this.currentPercentage.set(availPendingPct);
    this.paymentForm.patchValue({
      payment_percentage: availPendingPct,
      amount_paid: availPending,
      pending_amount: 0,
    });
    this.recalculateForexAndBankCharges();
  }

  protected extractErrorMessage(err: unknown, fallback: string): string {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    const e = err as any;
    if (e?.error) {
      if (typeof e.error === 'string') return e.error;
      if (e.error.error) {
        if (typeof e.error.error === 'string') return e.error.error;
        if (e.error.error.message) return e.error.error.message;
      }
      if (e.error.message) return e.error.message;
      if (e.error.detail) {
        if (typeof e.error.detail === 'string') return e.error.detail;
        if (Array.isArray(e.error.detail) && e.error.detail[0]?.msg) return e.error.detail[0].msg;
      }
    }
    if (e?.message) return e.message;
    return fallback;
  }

  protected onSubmitPayment(): void {
    if (this.saving()) return;
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    const val = this.paymentForm.getRawValue();
    const existing = this.editingPayment();
    const availPending = this.dialogAvailablePending();
    const availPendingPct = this.dialogAvailablePendingPct();

    // Guard against exceeding outstanding balance
    if (!existing && availPending > 0 && Number(val.amount_paid) > (availPending + 0.01)) {
      const errorMsg = `Payment exceeds outstanding balance of ${val.currency || this.cardCurrency()} ${availPending.toFixed(2)}`;
      this.messageService.add({
        severity: 'error',
        summary: 'Payment Limit Exceeded',
        detail: errorMsg,
        life: 5000,
      });
      return;
    }

    if (!existing && availPendingPct > 0 && Number(val.payment_percentage) > (availPendingPct + 0.01)) {
      const errorMsg = `Payment percentage exceeds remaining balance of ${availPendingPct.toFixed(1)}%`;
      this.messageService.add({
        severity: 'error',
        summary: 'Payment Limit Exceeded',
        detail: errorMsg,
        life: 5000,
      });
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const payDateStr = this.formatDate(val.payment_date);
    const userTx = String(val.transaction_details || '').trim();

    const payload: SupplierPaymentCreateInput = {
      project_id: pId,
      currency: val.currency || 'INR',
      payment_percentage: val.payment_percentage != null && val.payment_percentage !== '' ? Number(val.payment_percentage) : null,
      total_supplier_value: val.total_supplier_value != null && val.total_supplier_value !== '' ? Number(val.total_supplier_value) : null,
      amount_paid: Number(val.amount_paid) || 0,
      payment_date: payDateStr,
      transaction_details: userTx,
      pending_amount: val.pending_amount != null && val.pending_amount !== '' ? Number(val.pending_amount) : null,
      remarks: serializeStepRemarks(this.dialogRemarks()),
      exchange_rate: val.exchange_rate != null && val.exchange_rate !== '' ? Number(val.exchange_rate) : null,
      total_with_exchange: val.total_with_exchange != null && val.total_with_exchange !== '' ? Number(val.total_with_exchange) : null,
      bank_charges_currency: val.bank_charges_currency || 'INR',
      bank_charges: val.bank_charges != null && val.bank_charges !== '' ? Number(val.bank_charges) : null,
      swift_charges: val.swift_charges != null && val.swift_charges !== '' ? Number(val.swift_charges) : null,
      total_outflow: val.total_outflow != null && val.total_outflow !== '' ? Number(val.total_outflow) : null,
    };

    const files = this.selectedFiles();

    if (existing) {
      this.supplierPaymentService
        .updateSupplierPayment(existing.id, payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Payment Updated',
              detail: `Disbursement record #${existing.id} updated successfully.`,
              life: 4000,
            });
            this.paymentDialogVisible.set(false);
            this.loadAllStep15Data();
          },
          error: (err) => {
            console.error('Failed to update supplier payment', err);
            const msg = this.extractErrorMessage(err, 'Failed to update supplier payment. Please try again.');
            const code = (err as any)?.error?.error?.code || (err as any)?.error?.code;
            const isLimitExceeded = code === 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE' || msg.toLowerCase().includes('exceeds outstanding balance');
            this.messageService.add({
              severity: 'error',
              summary: isLimitExceeded ? 'Payment Limit Exceeded' : 'Payment Error',
              detail: msg,
              life: 6000,
            });
            this.errorMessage.set(msg);
          },
        });
    } else {
      this.supplierPaymentService
        .createSupplierPayment(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Payment Recorded',
              detail: `Supplier payment of ${payload.currency} ${Number(payload.amount_paid).toFixed(2)} recorded successfully.`,
              life: 4000,
            });
            this.paymentDialogVisible.set(false);
            this.loadAllStep15Data();
          },
          error: (err) => {
            console.error('Failed to create supplier payment', err);
            const msg = this.extractErrorMessage(err, 'Failed to record supplier payment. Please try again.');
            const code = (err as any)?.error?.error?.code || (err as any)?.error?.code;
            const isLimitExceeded = code === 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE' || msg.toLowerCase().includes('exceeds outstanding balance');
            this.messageService.add({
              severity: 'error',
              summary: isLimitExceeded ? 'Payment Limit Exceeded' : 'Payment Error',
              detail: msg,
              life: 6000,
            });
            this.errorMessage.set(msg);
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

  // ── Calculation Helpers ────────────────────────────────────────
  protected getPaymentPercentage(p: SupplierPayment): number {
    if (p.is_payment_completed || this.getPaymentPendingAmount(p) <= 0) {
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
    const total = this.getPaymentCommitmentValue(p);
    const paid = Number(p.amount_paid) || 0;
    if (total <= 0 || paid <= 0) return 0;
    return Math.min(100, Math.round((paid / total) * 1000) / 10);
  }

  protected getPaymentPendingAmount(p: SupplierPayment): number {
    if (p.is_payment_completed) return 0;
    if (p.pending_amount != null && !isNaN(Number(p.pending_amount))) {
      return Math.max(0, Number(p.pending_amount));
    }
    const total = this.getPaymentCommitmentValue(p);
    const paid = Number(p.amount_paid) || 0;
    return Math.max(0, Math.round((total - paid) * 100) / 100);
  }

  protected getRemainingPercentage(p: SupplierPayment): number {
    if (p.is_payment_completed || this.getPaymentPendingAmount(p) <= 0) {
      return 0;
    }
    if (p.pending_percentage != null && !isNaN(Number(p.pending_percentage))) {
      const pct = Number(p.pending_percentage);
      if (pct >= 0 && pct <= 100) {
        return Math.round(pct * 10) / 10;
      }
    }
    const total = this.getPaymentCommitmentValue(p);
    const pending = this.getPaymentPendingAmount(p);
    if (total <= 0 || pending <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((pending / total) * 1000) / 10));
  }

  // ── Live Calculation Helper for Modal ──────────────────────────
  protected getDialogPendingBalance(): number {
    const val = this.paymentForm.getRawValue();
    const total = Number(val.total_supplier_value) || this.totalCommitmentValue() || 0;
    const currentPaid = Number(val.amount_paid) || 0;
    const previouslyPaid = this.dialogPreviouslyPaid();
    return Math.max(0, Math.round((total - (previouslyPaid + currentPaid)) * 100) / 100);
  }

  protected getDialogPendingPercentage(): number {
    const val = this.paymentForm.getRawValue();
    const total = Number(val.total_supplier_value) || this.totalCommitmentValue() || 0;
    if (total <= 0) return 0;
    const pendingBal = this.getDialogPendingBalance();
    if (pendingBal <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((pendingBal / total) * 1000) / 10));
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

  protected formatDisplayDate(date: Date | string | null | undefined): string {
    if (!date) return '—';
    if (typeof date === 'string') {
      const trimmed = date.trim();
      if (!trimmed) return '—';
      // If already DD-MM-YYYY, return directly without pipe conversion
      if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
        return trimmed;
      }
      // If YYYY-MM-DD
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
