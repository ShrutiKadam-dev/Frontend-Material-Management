import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';

import { CustomerTenderService } from '../../../../core/services/customer-tender';
import { CustomerService } from '../../../../core/services/customer';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  INCOTERMS_OPTIONS,
  VALIDITY_UNIT_OPTIONS,
} from '../../../../core/constants';
import {
  CustomerTender,
  CustomerTenderCreateInput,
  CustomerTenderItem,
  CustomerTenderUpdateInput,
} from '../../../../core/models/customer-tender.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';

@Component({
  selector: 'app-step-06-tender',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    TooltipModule,
    TableModule,
    SelectModule,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './step-06-tender.html',
  styleUrl: './step-06-tender.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step06Tender implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly customerTenderService = inject(CustomerTenderService);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly messageService = inject(MessageService);

  /* ── Core State Signals ────────────────────────────────── */
  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly tenders = signal<CustomerTender[]>([]);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  /* ── Dialog State Signals ──────────────────────────────── */
  protected readonly dialogVisible = signal(false);
  protected readonly editingTender = signal<CustomerTender | null>(null);
  protected readonly items = signal<CustomerTenderItem[]>([]);
  protected readonly editingItemIndex = signal<number | null>(null);
  protected readonly attachments = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);

  /* ── Dropdown Constants ────────────────────────────────── */
  protected readonly incotermsOptions = INCOTERMS_OPTIONS;
  protected readonly validityUnitOptions = VALIDITY_UNIT_OPTIONS;

  /* ── Reactive Forms ────────────────────────────────────── */
  protected readonly headerForm = this.fb.group({
    customer_id: [0],
    officer_name: [''],
    email: ['', [Validators.email]],
    contact_number: [
      '',
      [Validators.pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]{6,20}$/)],
    ],
    address: [''],
    website: [
      '',
      [
        Validators.pattern(
          /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/i
        ),
      ],
    ],
    tender_title: ['', [Validators.required, Validators.minLength(2)]],
    tender_number: ['', [Validators.required]],
    tender_date: [null as Date | null, [Validators.required]],
    opening_date_time: [null as Date | null],
    closing_date_time: [null as Date | null],
    tender_fee: [null as number | null, [Validators.min(0)]],
    validity_amount: [''],
    validity_unit: ['Days'],
    delivery_terms: [''],
    delivery_period: [''],
    payment_terms: [''],
    warranty_period: [''],
    remark: [''],
  });

  protected readonly rowForm = this.fb.group({
    item_code: [''],
    material_name: ['', [Validators.required]],
    quantity: ['', [Validators.required, Validators.pattern(/^[0-9]+(\.[0-9]+)?$/)]],
  });

  /* ── Derived Summaries ─────────────────────────────────── */
  protected readonly totalItemCount = computed(() => this.items().length);

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
    this.loadTenders(id);
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

  protected loadTenders(projectId: number): void {
    this.loading.set(true);
    this.customerTenderService
      .getByProject(projectId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.tenders.set(data || []);
        },
        error: () => {
          this.errorMessage.set('Failed to load customer tenders.');
        },
      });
  }

  /* ── Dialog Management ─────────────────────────────────── */
  protected openCreateDialog(): void {
    const proj = this.project();
    const cust = this.customer();

    this.headerForm.reset({
      customer_id: proj?.customer_id || cust?.id || 0,
      officer_name: '',
      email: '',
      contact_number: '',
      address: '',
      website: '',
      tender_title: '',
      tender_number: '',
      tender_date: null,
      opening_date_time: null,
      closing_date_time: null,
      tender_fee: null,
      validity_amount: '',
      validity_unit: 'Days',
      delivery_terms: '',
      delivery_period: '',
      payment_terms: '',
      warranty_period: '',
      remark: '',
    });

    this.items.set([]);
    this.attachments.set([]);
    this.existingAttachments.set([]);
    this.editingTender.set(null);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.errorMessage.set(null);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(t: CustomerTender): void {
    const [valAmount, valUnit] = this.parseValidity(t.validity);

    this.headerForm.reset({
      customer_id: t.customer_id,
      officer_name: t.officer_name || '',
      email: t.email || '',
      contact_number: t.contact_number || '',
      address: t.address || '',
      website: t.website || '',
      tender_title: t.tender_title || '',
      tender_number: t.tender_number || '',
      tender_date: t.tender_date ? new Date(t.tender_date) : null,
      opening_date_time: t.opening_date_time ? new Date(t.opening_date_time) : null,
      closing_date_time: t.closing_date_time ? new Date(t.closing_date_time) : null,
      tender_fee: t.tender_fee ? Number(t.tender_fee) : null,
      validity_amount: valAmount,
      validity_unit: valUnit,
      delivery_terms: t.delivery_terms || '',
      delivery_period: t.delivery_period || '',
      payment_terms: t.payment_terms || '',
      warranty_period: t.warranty_period || '',
      remark: t.remark || '',
    });

    this.items.set(t.items ? [...t.items] : []);
    this.attachments.set([]);
    this.existingAttachments.set(t.attachments ? [...t.attachments] : []);
    this.editingTender.set(t);
    this.editingItemIndex.set(null);
    this.rowForm.reset();
    this.errorMessage.set(null);
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingTender.set(null);
  }

  /* ── Line Item Operations ──────────────────────────────── */
  protected saveRow(matInputEl?: HTMLInputElement): void {
    if (this.rowForm.invalid) {
      this.rowForm.markAllAsTouched();
      return;
    }

    const val = this.rowForm.getRawValue();
    const newItem: CustomerTenderItem = {
      item_code: val.item_code?.trim() || undefined,
      material_name: val.material_name.trim(),
      quantity: val.quantity,
    };

    const editIdx = this.editingItemIndex();
    if (editIdx !== null) {
      this.items.update((prev) => {
        const next = [...prev];
        next[editIdx] = { ...next[editIdx], ...newItem };
        return next;
      });
      this.editingItemIndex.set(null);
    } else {
      this.items.update((prev) => [...prev, newItem]);
    }

    this.rowForm.reset();
    if (matInputEl) {
      setTimeout(() => matInputEl.focus(), 50);
    }
  }

  protected openEditRow(index: number, matInputEl?: HTMLInputElement): void {
    const item = this.items()[index];
    if (!item) return;

    this.editingItemIndex.set(index);
    this.rowForm.setValue({
      item_code: item.item_code || '',
      material_name: item.material_name || '',
      quantity: String(item.quantity || ''),
    });

    if (matInputEl) {
      setTimeout(() => matInputEl.focus(), 50);
    }
  }

  protected cancelRow(): void {
    this.editingItemIndex.set(null);
    this.rowForm.reset();
  }

  protected deleteRow(index: number): void {
    this.items.update((prev) => prev.filter((_, i) => i !== index));
    if (this.editingItemIndex() === index) {
      this.cancelRow();
    }
  }

  /* ── Submit (Create / Update) ──────────────────────────── */
  protected submit(): void {
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please complete all required fields correctly before saving.',
        life: 4000,
      });
      return;
    }

    if (this.items().length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Materials Required',
        detail: 'Please add at least one material item to the tender before saving.',
        life: 4000,
      });
      return;
    }

    const raw = this.headerForm.getRawValue();

    const validityStr = raw.validity_amount && raw.validity_unit
      ? `${raw.validity_amount} ${raw.validity_unit}`
      : raw.validity_amount || '';

    const payload: CustomerTenderCreateInput = {
      project_id: this.projectId(),
      customer_id: Number(raw.customer_id) || this.project()?.customer_id || 0,
      officer_name: raw.officer_name?.trim() || undefined,
      email: raw.email?.trim() || undefined,
      address: raw.address?.trim() || undefined,
      website: raw.website?.trim() || undefined,
      contact_number: raw.contact_number?.trim() || undefined,
      tender_title: raw.tender_title.trim(),
      tender_number: raw.tender_number.trim(),
      tender_date: this.toIsoString(raw.tender_date) || new Date().toISOString(),
      opening_date_time: this.toIsoString(raw.opening_date_time),
      closing_date_time: this.toIsoString(raw.closing_date_time),
      tender_fee: raw.tender_fee !== null ? Number(raw.tender_fee) : undefined,
      validity: validityStr || undefined,
      delivery_terms: raw.delivery_terms?.trim() || undefined,
      delivery_period: raw.delivery_period?.trim() || undefined,
      payment_terms: raw.payment_terms?.trim() || undefined,
      warranty_period: raw.warranty_period?.trim() || undefined,
      remark: raw.remark?.trim() || undefined,
      items: this.items(),
    };

    this.submitting.set(true);
    const editing = this.editingTender();

    const request$ = editing
      ? this.customerTenderService.update(editing.id, payload, this.attachments())
      : this.customerTenderService.create(payload, this.attachments());

    request$
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: editing ? 'Updated' : 'Created',
            detail: `Customer tender ${editing ? 'updated' : 'created'} successfully.`,
            life: 3000,
          });
          this.closeDialog();
          this.loadTenders(this.projectId());
        },
        error: (err) => {
          const detail = err?.error?.message || err?.error?.error || 'Failed to save customer tender.';
          this.errorMessage.set(detail);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail,
            life: 4000,
          });
        },
      });
  }

  /* ── Delete Tender ─────────────────────────────────────── */
  protected deleteTender(id: number): void {
    this.customerTenderService.delete(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Deleted',
          detail: 'Customer tender removed successfully.',
          life: 3000,
        });
        this.loadTenders(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete customer tender.',
          life: 3000,
        });
      },
    });
  }

  /* ── File Attachments ────────────────────────────────── */
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.attachments.update((prev) => [...prev, ...newFiles]);
      input.value = '';
    }
  }

  protected removeAttachment(index: number): void {
    this.attachments.update((prev) => prev.filter((_, i) => i !== index));
  }

  protected downloadAttachment(att: Attachment): void {
    if (!att.id) return;
    this.downloadingAttachmentId.set(att.id);
    this.attachmentService
      .downloadFile(att)
      .pipe(finalize(() => this.downloadingAttachmentId.set(null)))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.file_name || 'attachment';
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Download failed',
            detail: 'Could not download the attachment.',
            life: 3000,
          });
        },
      });
  }

  /* ── Helper Functions ─────────────────────────────────── */
  protected isFieldInvalid(key: string): boolean {
    const c = this.headerForm.get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected isRowFieldInvalid(key: string): boolean {
    const c = this.rowForm.get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected getFieldError(key: string): string | null {
    const c = this.headerForm.get(key);
    if (!c || !c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) {
      if (key === 'tender_title') return 'Tender title is required.';
      if (key === 'tender_number') return 'Tender number is required.';
      if (key === 'tender_date') return 'Tender date is required.';
      return 'This field is required.';
    }
    if (c.hasError('email')) return 'Please enter a valid email address.';
    if (c.hasError('min')) {
      if (key === 'tender_fee') return 'Tender fee cannot be negative.';
      return 'Value is too small.';
    }
    if (c.hasError('pattern')) {
      if (key === 'website') return 'Please enter a valid URL (e.g. https://eprocure.gov.in or www.eprocure.gov.in).';
      if (key === 'contact_number') return 'Please enter a valid contact number (e.g. +91-9876543210).';
      return 'Invalid format.';
    }
    if (c.hasError('minlength')) {
      return 'Must be at least 2 characters.';
    }
    return 'Invalid field value.';
  }

  protected getRowFieldError(key: string): string | null {
    const c = this.rowForm.get(key);
    if (!c || !c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) {
      if (key === 'material_name') return 'Material description is required.';
      if (key === 'quantity') return 'Quantity is required.';
      return 'This field is required.';
    }
    if (c.hasError('pattern') || c.hasError('min')) {
      if (key === 'quantity') return 'Quantity must be a valid positive number.';
    }
    return 'Invalid field value.';
  }

  protected getDeliveryTermLabel(term?: string): string {
    if (!term) return '';
    const match = this.incotermsOptions.find((opt) => opt.value === term || opt.label === term);
    return match ? match.label : term;
  }

  protected formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected getFileIcon(contentType?: string): string {
    if (!contentType) return 'pi pi-file';
    const type = contentType.toLowerCase();
    if (type.includes('pdf')) return 'pi pi-file-pdf';
    if (type.includes('image')) return 'pi pi-image';
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) {
      return 'pi pi-file-excel';
    }
    if (type.includes('word') || type.includes('document')) {
      return 'pi pi-file-word';
    }
    return 'pi pi-file';
  }

  protected parseValidity(validity?: string): [string, string] {
    if (!validity) return ['90', 'Days'];
    const parts = validity.trim().split(/\s+/);
    if (parts.length >= 2) {
      return [parts[0], parts.slice(1).join(' ')];
    }
    return [parts[0], 'Days'];
  }

  private toIsoString(val: unknown): string | undefined {
    if (!val) return undefined;
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? undefined : val.toISOString();
    }
    if (typeof val === 'string' && val.trim()) {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toISOString();
    }
    return undefined;
  }

  /* ── Navigation ──────────────────────────────────────── */
  protected goBack(): void {
    this.router.navigate(['/projects', this.projectId(), 'steps']);
  }
}
