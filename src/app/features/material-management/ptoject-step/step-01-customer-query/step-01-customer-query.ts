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
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { CustomerQueryService } from '../../../../core/services/customer-query';
import { CustomerService } from '../../../../core/services/customer';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  CustomerQuery,
  CustomerQueryCreateInput,
  CustomerQueryItem,
  CustomerQueryUpdateInput,
} from '../../../../core/models/customer-query.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';

@Component({
  selector: 'app-step-01-customer-query',
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
  ],
  templateUrl: './step-01-customer-query.html',
  styleUrl: './step-01-customer-query.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step01CustomerQuery implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly customerQueryService = inject(CustomerQueryService);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly messageService = inject(MessageService);

  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly queries = signal<CustomerQuery[]>([]);
  protected readonly loadingQueries = signal(true);
  protected readonly submitting = signal(false);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  /** Holds the active query being edited, or null for create mode */
  protected readonly editingQuery = signal<CustomerQuery | null>(null);

  /** Existing attachments when editing a query */
  protected readonly existingAttachments = signal<Attachment[]>([]);

  /** Multiple new file attachments — stored as raw File objects for FormData upload */
  protected readonly attachments = signal<File[]>([]);

  /** Dialog visibility */
  protected readonly dialogVisible = signal(false);

  /** Draft items for the materials table (inside dialog) */
  protected readonly items = signal<CustomerQueryItem[]>([]);

  /** Inline add-row form */
  protected readonly addRowVisible = signal(false);
  protected readonly editingIndex = signal<number | null>(null);

  protected readonly totalItems = computed(() => this.items().length);

  protected readonly headerForm = this.fb.group({
    qo_date: [null as Date | null, Validators.required],
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
        this.customerService.getCustomerById(p.customer_id).subscribe({
          next: (c) => this.customer.set(c),
          error: () => {},
        });
      },
      error: () => {},
    });

    this.loadQueries(projectId);
  }

  private loadQueries(projectId: number): void {
    this.loadingQueries.set(true);
    this.customerQueryService.getByProject(projectId).subscribe({
      next: (data) => {
        this.queries.set(data);
        this.loadingQueries.set(false);
      },
      error: () => {
        this.loadingQueries.set(false);
      },
    });
  }

  /* ── Dialog (Shared for Add and Edit) ─────────────────── */

  protected openDialog(): void {
    this.editingQuery.set(null);
    this.headerForm.reset({
      qo_date: null,
      remark: '',
    });
    this.items.set([]);
    this.existingAttachments.set([]);
    this.attachments.set([]);
    this.addRowVisible.set(false);
    this.editingIndex.set(null);
    this.errorMessage.set(null);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(query: CustomerQuery): void {
    this.editingQuery.set(query);
    this.headerForm.setValue({
      qo_date: this.parseDate(query.qo_date),
      remark: query.remark ?? '',
    });
    this.items.set(query.items ? query.items.map((it) => ({ ...it })) : []);
    this.existingAttachments.set(query.attachments ?? []);
    this.attachments.set([]);
    this.addRowVisible.set(false);
    this.editingIndex.set(null);
    this.errorMessage.set(null);
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingQuery.set(null);
  }

  /* ── Item table actions ──────────────────────────────── */

  protected openEditRow(index: number, focusTarget?: HTMLInputElement): void {
    const item = this.items()[index];
    this.rowForm.setValue({ material_name: item.material_name, quantity: item.quantity });
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

    const row: CustomerQueryItem = {
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

  protected isFieldInvalid(key: string): boolean {
    const c = this.headerForm.get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected isRowFieldInvalid(key: string): boolean {
    const c = this.rowForm.get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected getRowFieldError(key: string): string | null {
    const c = this.rowForm.get(key);
    if (!c || !c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) {
      if (key === 'material_name') return 'Material name is required.';
      if (key === 'quantity') return 'Quantity is required.';
    }
    if (c.hasError('pattern') || c.hasError('min')) {
      if (key === 'quantity') return 'Quantity must be a valid positive number.';
    }
    return 'Invalid value.';
  }

  protected removeAttachment(index: number): void {
    this.attachments.update((list) => list.filter((_, i) => i !== index));
  }

  /* ── Submit (Handles both Create and Update) ──────────── */

  protected submit(): void {
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Validation Required',
        detail: 'Please complete all required fields.',
        life: 4000,
      });
      return;
    }

    if (this.items().length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Materials Required',
        detail: 'Please add at least one material item to the query.',
        life: 4000,
      });
      return;
    }

    const projectId = this.projectId();
    const customerId = this.project()?.customer_id;

    if (!customerId) {
      this.errorMessage.set('Project or customer not loaded yet. Please wait.');
      return;
    }

    const raw = this.headerForm.getRawValue();
    const qoDate = raw.qo_date as Date;
    const files = this.attachments();
    const currentQuery = this.editingQuery();

    this.submitting.set(true);
    this.errorMessage.set(null);

    if (currentQuery) {
      const updatePayload: CustomerQueryUpdateInput = {
        project_id: projectId,
        customer_id: customerId,
        qo_date: this.formatDate(qoDate),
        remark: raw.remark ?? '',
        items: this.items(),
      };

      this.customerQueryService
        .update(currentQuery.id, updatePayload, files)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Updated',
              detail: 'Customer query updated successfully.',
              life: 3500,
            });
            this.attachments.set([]);
            this.editingQuery.set(null);
            this.loadQueries(projectId);
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update query. Please try again.',
            });
          },
        });
    } else {
      const createPayload: CustomerQueryCreateInput = {
        project_id: projectId,
        customer_id: customerId,
        qo_date: this.formatDate(qoDate),
        remark: raw.remark ?? '',
        items: this.items(),
      };

      this.customerQueryService
        .create(createPayload, files)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Customer query submitted successfully.',
              life: 3500,
            });
            this.attachments.set([]);
            this.loadQueries(projectId);
          },
          error: () => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to submit query. Please try again.',
            });
          },
        });
    }
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

  protected deleteQuery(id: number): void {
    this.customerQueryService.delete(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Deleted',
          detail: 'Customer query removed successfully.',
          life: 3000,
        });
        this.loadQueries(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete query.',
        });
      },
    });
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
