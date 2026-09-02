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
import { DatePipe, CurrencyPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { SupplierQuotationService } from '../../../../core/services/supplier-quotation';
import { QuotationRequestService } from '../../../../core/services/quotation-request';
import { CustomerQueryService } from '../../../../core/services/customer-query';
import { SupplierService } from '../../../../core/services/supplier';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  SupplierQuotation,
  SupplierQuotationCreateInput,
  SupplierQuotationItem,
  SupplierQuotationUpdateInput,
} from '../../../../core/models/supplier-quotation.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Supplier } from '../../../../core/models/supplier.model';
import { Project } from '../../../../core/models/project.model';

@Component({
  selector: 'app-step-03-supplier-quotation',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    TooltipModule,
    TableModule,
    DatePipe,
    CurrencyPipe,
  ],
  templateUrl: './step-03-supplier-quotation.html',
  styleUrl: './step-03-supplier-quotation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step03SupplierQuotation implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly supplierQuotationService = inject(SupplierQuotationService);
  private readonly quotationRequestService = inject(QuotationRequestService);
  private readonly customerQueryService = inject(CustomerQueryService);
  private readonly supplierService = inject(SupplierService);
  private readonly projectService = inject(ProjectService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly messageService = inject(MessageService);

  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly quotations = signal<SupplierQuotation[]>([]);
  protected readonly loadingQuotations = signal(true);
  protected readonly submitting = signal(false);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  /** Active quotation being edited, or null for create mode */
  protected readonly editingQuotation = signal<SupplierQuotation | null>(null);

  /** Existing attachments when editing a quotation */
  protected readonly existingAttachments = signal<Attachment[]>([]);

  /** Multiple new file attachments — stored as raw File objects for FormData upload */
  protected readonly attachments = signal<File[]>([]);

  /** Dialog visibility */
  protected readonly dialogVisible = signal(false);

  /** Draft items for the materials table (inside dialog) */
  protected readonly items = signal<SupplierQuotationItem[]>([]);

  /** Inline add/edit row form inside dialog */
  protected readonly addRowVisible = signal(false);
  protected readonly editingIndex = signal<number | null>(null);

  protected readonly totalItems = computed(() => this.items().length);

  protected readonly headerForm = this.fb.group({
    quotation_number: ['', [Validators.required]],
    quotation_date: [null as Date | null, [Validators.required]],
    quotation_value: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    validity: ['60 Days', [Validators.required]],
    incoterms: ['FOB', [Validators.required]],
    payment_terms: ['50% Advance, 50% against Delivery', [Validators.required]],
    delivery_period: ['5 Weeks', [Validators.required]],
    remark: [''],
  });

  protected readonly rowForm = this.fb.group({
    material_name: ['', Validators.required],
    quantity: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,3})?$/)]],
  });

  ngOnInit(): void {
    const projectId = Number(this.route.snapshot.paramMap.get('projectId'));
    this.projectId.set(projectId);

    this.projectService.getProjectById(projectId).subscribe({
      next: (p) => {
        this.project.set(p);
        if (p.supplier_id) {
          this.supplierService.getSupplierById(p.supplier_id).subscribe({
            next: (s) => this.supplier.set(s),
            error: () => {},
          });
        }
      },
      error: () => {},
    });

    this.loadQuotations(projectId);
  }

  private loadQuotations(projectId: number): void {
    this.loadingQuotations.set(true);
    this.supplierQuotationService.getByProject(projectId).subscribe({
      next: (data) => {
        this.quotations.set(data);
        this.loadingQuotations.set(false);
      },
      error: () => {
        this.loadingQuotations.set(false);
      },
    });
  }

  /* ── Dialog (Shared for Add and Edit) ─────────────────── */

  protected openDialog(): void {
    this.editingQuotation.set(null);
    this.headerForm.reset({
      quotation_number: '',
      quotation_date: null,
      quotation_value: '',
      validity: '60 Days',
      incoterms: 'FOB',
      payment_terms: '50% Advance, 50% against Delivery',
      delivery_period: '5 Weeks',
      remark: '',
    });
    this.items.set([]);
    this.existingAttachments.set([]);
    this.attachments.set([]);
    this.addRowVisible.set(false);
    this.editingIndex.set(null);
    this.errorMessage.set(null);
    this.dialogVisible.set(true);

    // Auto-fetch material items from Step 2 / Step 1 if available
    this.quotationRequestService.getByProject(this.projectId()).subscribe({
      next: (requests) => {
        const autoItems: SupplierQuotationItem[] = [];
        requests.forEach((r) => {
          r.items?.forEach((item) => {
            autoItems.push({
              material_name: item.material_name,
              quantity: item.quantity,
            });
          });
        });
        if (autoItems.length > 0) {
          this.items.set(autoItems);
        } else {
          this.loadFallbackItems();
        }
      },
      error: () => this.loadFallbackItems(),
    });
  }

  private loadFallbackItems(): void {
    this.customerQueryService.getByProject(this.projectId()).subscribe({
      next: (queries) => {
        const autoItems: SupplierQuotationItem[] = [];
        queries.forEach((q) => {
          q.items?.forEach((item) => {
            autoItems.push({
              material_name: item.material_name,
              quantity: item.quantity,
            });
          });
        });
        if (autoItems.length > 0) {
          this.items.set(autoItems);
        }
      },
      error: () => {},
    });
  }

  protected openEditDialog(quotation: SupplierQuotation): void {
    this.editingQuotation.set(quotation);
    this.headerForm.setValue({
      quotation_number: quotation.quotation_number ?? '',
      quotation_date: this.parseDate(quotation.quotation_date),
      quotation_value: quotation.quotation_value ? String(quotation.quotation_value) : '',
      validity: quotation.validity ?? '60 Days',
      incoterms: quotation.incoterms ?? 'FOB',
      payment_terms: quotation.payment_terms ?? '50% Advance, 50% against Delivery',
      delivery_period: quotation.delivery_period ?? '5 Weeks',
      remark: quotation.remark ?? '',
    });
    this.items.set(quotation.items ? quotation.items.map((it) => ({ ...it })) : []);
    this.existingAttachments.set(quotation.attachments ?? []);
    this.attachments.set([]);
    this.addRowVisible.set(false);
    this.editingIndex.set(null);
    this.errorMessage.set(null);
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingQuotation.set(null);
  }

  /* ── Item table actions ──────────────────────────────── */

  protected openEditRow(index: number, focusTarget?: HTMLInputElement): void {
    const item = this.items()[index];
    this.rowForm.setValue({
      material_name: item.material_name,
      quantity: String(item.quantity ?? ''),
    });
    this.editingIndex.set(index);
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
    const name = val.material_name?.trim();
    const qty = val.quantity?.trim();

    if (!name || !qty) return;

    const row: SupplierQuotationItem = {
      material_name: name,
      quantity: qty,
    };

    const idx = this.editingIndex();
    if (idx !== null) {
      const updated = [...this.items()];
      updated[idx] = row;
      this.items.set(updated);
      this.editingIndex.set(null);
    } else {
      this.items.update((list) => [...list, row]);
    }

    this.rowForm.reset();
    if (focusTarget) {
      setTimeout(() => focusTarget.focus(), 0);
    }
  }

  protected deleteRow(index: number): void {
    this.items.update((list) => list.filter((_, i) => i !== index));
    if (this.editingIndex() === index) {
      this.cancelRow();
    }
  }

  protected cancelRow(): void {
    this.editingIndex.set(null);
    this.rowForm.reset();
  }

  /* ── Attachments (FormData) ─────────────────────────── */

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    this.attachments.update((list) => [...list, ...Array.from(files)]);
    input.value = '';
  }

  protected removeAttachment(index: number): void {
    this.attachments.update((list) => list.filter((_, i) => i !== index));
  }

  /* ── Submit (Handles both Create and Update) ──────────── */

  protected submit(): void {
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      return;
    }

    const projectId = this.projectId();
    const supplierId = this.project()?.supplier_id;

    if (!supplierId) {
      this.errorMessage.set('Project or supplier not loaded yet. Please wait.');
      return;
    }

    const raw = this.headerForm.getRawValue();
    const qDate = raw.quotation_date as Date;
    const files = this.attachments();
    const current = this.editingQuotation();

    this.submitting.set(true);
    this.errorMessage.set(null);

    const formattedItems = this.items().map((it) => ({
      material_name: it.material_name,
      quantity: !isNaN(Number(it.quantity)) ? Number(it.quantity) : it.quantity,
    }));

    if (current) {
      const updatePayload: SupplierQuotationUpdateInput = {
        project_id: projectId,
        supplier_id: supplierId,
        quotation_number: raw.quotation_number,
        quotation_date: this.formatDate(qDate),
        quotation_value: raw.quotation_value,
        validity: raw.validity,
        incoterms: raw.incoterms,
        payment_terms: raw.payment_terms,
        delivery_period: raw.delivery_period,
        remark: raw.remark ?? '',
        items: formattedItems,
      };

      this.supplierQuotationService
        .update(current.id, updatePayload, files)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: 'Supplier quotation updated successfully.',
              life: 3500,
            });
            this.attachments.set([]);
            this.editingQuotation.set(null);
            this.loadQuotations(projectId);
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update quotation. Please try again.',
            });
          },
        });
    } else {
      const createPayload: SupplierQuotationCreateInput = {
        project_id: projectId,
        supplier_id: supplierId,
        quotation_number: raw.quotation_number,
        quotation_date: this.formatDate(qDate),
        quotation_value: raw.quotation_value,
        validity: raw.validity,
        incoterms: raw.incoterms,
        payment_terms: raw.payment_terms,
        delivery_period: raw.delivery_period,
        remark: raw.remark ?? '',
        items: formattedItems,
      };

      this.supplierQuotationService
        .create(createPayload, files)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Supplier quotation submitted successfully.',
              life: 3500,
            });
            this.attachments.set([]);
            this.loadQuotations(projectId);
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to submit quotation. Please try again.',
            });
          },
        });
    }
  }

  protected deleteQuotation(id: number): void {
    this.supplierQuotationService.delete(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Deleted',
          detail: 'Supplier quotation removed successfully.',
          life: 3000,
        });
        this.loadQuotations(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete supplier quotation.',
        });
      },
    });
  }

  protected downloadAttachment(attachment: Attachment): void {
    this.downloadingAttachmentId.set(attachment.id);
    this.attachmentService
      .downloadAttachment(attachment.id)
      .pipe(finalize(() => this.downloadingAttachmentId.set(null)))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = attachment.file_name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Download Failed',
            detail: `Failed to download ${attachment.file_name}.`,
          });
        },
      });
  }

  protected formatFileSize(bytes: number): string {
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

  protected getSupplierName(supplierId?: number): string {
    if (this.supplier()?.name) return this.supplier()!.name;
    if (this.project()?.supplier_name) return this.project()!.supplier_name!;
    return supplierId ? `Supplier #${supplierId}` : '—';
  }

  protected goBack(): void {
    this.router.navigate(['/projects', this.projectId(), 'steps']);
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
}
