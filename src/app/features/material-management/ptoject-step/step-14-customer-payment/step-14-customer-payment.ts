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
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './step-14-customer-payment.html',
  styleUrl: './step-14-customer-payment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step14CustomerPayment implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
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

  // ── Computed Filtered Records ──────────────────────────────────
  protected readonly filteredPayments = computed(() => {
    const list = this.payments();
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return list;

    return list.filter((p) => {
      return (
        String(p.id).includes(query) ||
        (p.invoice_no && p.invoice_no.toLowerCase().includes(query)) ||
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
    return this.payments().reduce((sum, p) => sum + (Number(p.payment_amount) || 0), 0);
  });

  protected readonly totalTdsDeducted = computed(() => {
    return this.payments().reduce((sum, p) => sum + (Number(p.tds) || 0), 0);
  });

  protected readonly totalLdDeducted = computed(() => {
    return this.payments().reduce((sum, p) => sum + (Number(p.ld) || 0), 0);
  });

  protected readonly totalDeductions = computed(() => {
    return this.totalTdsDeducted() + this.totalLdDeducted();
  });

  protected readonly totalOutstandingBalance = computed(() => {
    const inv = this.totalInvoiced();
    const paid = this.totalPaymentReceived();
    const ded = this.totalDeductions();
    return Math.max(0, inv - paid - ded);
  });

  protected readonly realizationRate = computed(() => {
    const inv = this.totalInvoiced();
    if (inv <= 0) return 0;
    const rate = ((this.totalPaymentReceived() + this.totalDeductions()) / inv) * 100;
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

    this.paymentDialogVisible.set(true);
  }

  protected openEditPaymentDialog(payment: CustomerPayment): void {
    this.editingPayment.set(payment);
    this.selectedFiles.set([]);
    this.existingAttachments.set(payment.attachments || []);

    const payDate = payment.payment_date ? new Date(payment.payment_date) : null;

    this.paymentForm.reset({
      invoice_no: payment.invoice_no || '',
      invoice_date: payment.invoice_date || '',
      invoice_value: payment.invoice_value ?? null,
      payment_amount: payment.payment_amount ?? null,
      payment_date: payDate,
      tds: payment.tds ?? 0,
      ld: payment.ld ?? 0,
      remark: payment.remark || '',
    });

    this.paymentDialogVisible.set(true);
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

    const payload: CustomerPaymentCreateInput = {
      project_id: pId,
      invoice_no: String(val.invoice_no).trim(),
      invoice_date: String(val.invoice_date).trim(),
      invoice_value: Number(val.invoice_value) || 0,
      payment_amount: Number(val.payment_amount) || 0,
      payment_date: payDateStr,
      tds: Number(val.tds) || 0,
      ld: Number(val.ld) || 0,
      remark: val.remark ? String(val.remark).trim() : undefined,
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
  protected calculateSettlementBalance(p: CustomerPayment): number {
    const inv = Number(p.invoice_value) || 0;
    const paid = Number(p.payment_amount) || 0;
    const tds = Number(p.tds) || 0;
    const ld = Number(p.ld) || 0;
    return Math.max(0, inv - paid - tds - ld);
  }

  protected getDialogLiveBalance(): number {
    const val = this.paymentForm.getRawValue();
    const inv = Number(val.invoice_value) || 0;
    const paid = Number(val.payment_amount) || 0;
    const tds = Number(val.tds) || 0;
    const ld = Number(val.ld) || 0;
    return inv - paid - tds - ld;
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

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
