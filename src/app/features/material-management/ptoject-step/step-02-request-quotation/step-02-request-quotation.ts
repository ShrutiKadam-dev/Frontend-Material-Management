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
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';

import { QuotationRequestService } from '../../../../core/services/quotation-request';
import { CustomerQueryService } from '../../../../core/services/customer-query';
import { SupplierService } from '../../../../core/services/supplier';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  QuotationRequest,
  QuotationRequestCreateInput,
  QuotationRequestItem,
} from '../../../../core/models/quotation-request.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Supplier } from '../../../../core/models/supplier.model';
import { Project } from '../../../../core/models/project.model';

@Component({
  selector: 'app-step-02-request-quotation',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    CheckboxModule,
    TooltipModule,
    DatePipe,
  ],
  templateUrl: './step-02-request-quotation.html',
  styleUrl: './step-02-request-quotation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step02RequestQuotation implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly quotationRequestService = inject(QuotationRequestService);
  private readonly customerQueryService = inject(CustomerQueryService);
  private readonly supplierService = inject(SupplierService);
  private readonly projectService = inject(ProjectService);
  private readonly attachmentService = inject(AttachmentService);

  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly requests = signal<QuotationRequest[]>([]);
  protected readonly loadingRequests = signal(true);
  protected readonly submitting = signal(false);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  /** Multiple file attachments — stored as raw File objects for FormData upload */
  protected readonly attachments = signal<File[]>([]);

  /** Dialog visibility */
  protected readonly dialogVisible = signal(false);

  /** Draft items for the materials table (inside dialog) */
  protected readonly items = signal<QuotationRequestItem[]>([]);

  /** Inline add-row form */
  protected readonly addRowVisible = signal(false);
  protected readonly editingIndex = signal<number | null>(null);

  protected readonly totalItems = computed(() => this.items().length);

  protected readonly headerForm = this.fb.group({
    quotation_requested_date: [null as Date | null, Validators.required],
    supplier_contacted: [true],
    remarks: [''],
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

    this.loadRequests(projectId);
  }

  private loadRequests(projectId: number): void {
    this.loadingRequests.set(true);
    this.quotationRequestService.getByProject(projectId).subscribe({
      next: (data) => {
        this.requests.set(data);
        this.loadingRequests.set(false);
      },
      error: () => {
        this.loadingRequests.set(false);
      },
    });
  }

  /* ── Dialog ──────────────────────────────────────────── */

  protected openDialog(): void {
    this.headerForm.reset({
      quotation_requested_date: null,
      supplier_contacted: true,
      remarks: '',
    });
    this.items.set([]);
    this.attachments.set([]);
    this.addRowVisible.set(false);
    this.editingIndex.set(null);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.dialogVisible.set(true);

    // Auto-fetch material items from Step 1 (Customer Queries)
    this.customerQueryService.getByProject(this.projectId()).subscribe({
      next: (queries) => {
        const autoItems: QuotationRequestItem[] = [];
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

  protected closeDialog(): void {
    this.dialogVisible.set(false);
  }

  /* ── Item table actions ──────────────────────────────── */

  protected openAddRow(): void {
    this.rowForm.reset();
    this.editingIndex.set(null);
    this.addRowVisible.set(true);
  }

  protected openEditRow(index: number): void {
    const item = this.items()[index];
    this.rowForm.setValue({ material_name: item.material_name, quantity: item.quantity });
    this.editingIndex.set(index);
    this.addRowVisible.set(true);
  }

  protected saveRow(): void {
    if (this.rowForm.invalid) {
      this.rowForm.markAllAsTouched();
      return;
    }
    const row: QuotationRequestItem = {
      material_name: this.rowForm.getRawValue().material_name,
      quantity: this.rowForm.getRawValue().quantity,
    };
    const idx = this.editingIndex();
    if (idx !== null) {
      const updated = [...this.items()];
      updated[idx] = row;
      this.items.set(updated);
    } else {
      this.items.update((list) => [...list, row]);
    }
    this.addRowVisible.set(false);
    this.editingIndex.set(null);
  }

  protected deleteRow(index: number): void {
    this.items.update((list) => list.filter((_, i) => i !== index));
  }

  protected cancelRow(): void {
    this.addRowVisible.set(false);
    this.editingIndex.set(null);
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

  /* ── Submit ──────────────────────────────────────────── */

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
    const reqDate = raw.quotation_requested_date as Date;
    const files = this.attachments();

    const payload: QuotationRequestCreateInput = {
      project_id: projectId,
      supplier_id: supplierId,
      quotation_requested_date: this.formatDate(reqDate),
      supplier_contacted: Boolean(raw.supplier_contacted),
      remarks: raw.remarks ?? '',
      items: this.items(),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.quotationRequestService
      .create(payload, files)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.dialogVisible.set(false);
          this.successMessage.set('Quotation request submitted successfully.');
          this.attachments.set([]);
          this.loadRequests(projectId);
        },
        error: () => {
          this.errorMessage.set('Failed to submit quotation request. Please try again.');
        },
      });
  }

  protected deleteRequest(id: number): void {
    this.quotationRequestService.delete(id).subscribe({
      next: () => this.loadRequests(this.projectId()),
      error: () => this.errorMessage.set('Failed to delete quotation request.'),
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
          this.errorMessage.set(`Failed to download ${attachment.file_name}.`);
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
}
