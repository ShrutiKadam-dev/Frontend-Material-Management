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
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { CustomerQueryService } from '../../../../core/services/customer-query';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { AttachmentService } from '../../../../core/services/attachment';
import { ProjectStepService } from '../../../../core/services/project-step';

import {
  CustomerQuery,
  CustomerQueryCreateInput,
  CustomerQueryItem,
  CustomerQueryUpdateInput,
  RemarkPayloadItem,
} from '../../../../core/models/customer-query.model';
import { DatePipe } from '@angular/common';
import { Project } from '../../../../core/models/project.model';
import { Customer } from '../../../../core/models/customer.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { StepRemarkItem } from '../../../../core/models/step-remark.model';
import {
  createStepRemarkItem,
  getCurrentUserFromStorage,
  parseStepRemarks,
  serializeStepRemarks,
} from '../../../../core/utils/remark.utils';
import { formatLocalDate, parseLocalDate, formatDisplayDate } from '../../../../core/utils/date.utils';
import { AppDatePipe } from '../../../../core/pipes/app-date.pipe';
import { StepRemarksComponent } from '../../../../shared/components/step-remarks/step-remarks';

@Component({
  selector: 'app-customer-queries',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    DatePickerModule,
    TooltipModule,
    TableModule,
    DatePipe,
    AppDatePipe,
    StepRemarksComponent,
  ],
  templateUrl: './customer-queries.html',
  styleUrl: './customer-queries.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerQueries implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customerQueryService = inject(CustomerQueryService);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly projectStepService = inject(ProjectStepService);
  private readonly messageService = inject(MessageService);

  // ── Route & Entity Signals ─────────────────────────────────────────
  protected readonly projectId = signal<number>(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly queries = signal<CustomerQuery[]>([]);

  // ── UI & Loading States ────────────────────────────────────────────
  protected readonly loading = signal<boolean>(true);
  protected readonly submitting = signal<boolean>(false);
  protected readonly deleting = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly searchQuery = signal<string>('');
  protected readonly downloadingAttachmentId = signal<number | null>(null);

  // ── Create & Edit Modal Dialog Signals ─────────────────────────────
  protected readonly dialogVisible = signal<boolean>(false);
  protected readonly activeTab = signal<'fields' | 'table' | 'uploads' | 'remarks'>('fields');
  protected readonly editingQuery = signal<CustomerQuery | null>(null);
  protected readonly draftItems = signal<CustomerQueryItem[]>([]);
  protected readonly editingItemIndex = signal<number | null>(null);
  protected readonly existingAttachments = signal<Attachment[]>([]);
  protected readonly newAttachmentFiles = signal<File[]>([]);
  protected readonly dialogRemarks = signal<StepRemarkItem[]>([]);
  protected readonly newRemarkInput = signal<string>('');

  // ── Delete Confirmation Dialog Signals ─────────────────────────────
  protected readonly deleteConfirmVisible = signal<boolean>(false);
  protected readonly queryToDelete = signal<CustomerQuery | null>(null);

  // ── Inline Quick Remark State (Per Query in List) ──────────────────
  protected readonly quickRemarkPending = signal<boolean>(false);

  // ── Form Groups ────────────────────────────────────────────────────
  protected readonly queryHeaderForm = new FormGroup({
    qo_date: new FormControl<Date | null>(null, [Validators.required]),
  });

  protected readonly itemForm = new FormGroup({
    material_name: new FormControl<string>('', [Validators.required]),
    quantity: new FormControl<string>('', [
      Validators.required,
      Validators.pattern(/^\d+(\.\d{1,3})?$/),
    ]),
  });

  // ── Derived KPI & Summary Signals ──────────────────────────────────
  protected readonly totalQueriesCount = computed(() => this.queries().length);

  protected readonly totalMaterialsCount = computed(() =>
    this.queries().reduce((sum, q) => sum + (q.items?.length || 0), 0),
  );

  protected readonly totalAttachmentsCount = computed(() =>
    this.queries().reduce((sum, q) => sum + (q.attachments?.length || 0), 0),
  );

  protected readonly currentUser = computed(() => getCurrentUserFromStorage());

  protected readonly projectCode = computed(() => {
    const p = this.project();
    if (!p) return 'PRJ';
    if (p.project_code) return p.project_code;
    return `PRJ-${p.id < 10 ? '0' + p.id : p.id}`;
  });

  protected readonly filteredQueries = computed(() => {
    const list = this.queries();
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return list;

    return list.filter((item) => {
      const matchId = `query #${item.id}`.includes(q) || `${item.id}` === q;
      const matchDate = item.qo_date ? item.qo_date.toLowerCase().includes(q) : false;
      const matchFormattedDate = item.qo_date
        ? formatDisplayDate(item.qo_date).toLowerCase().includes(q)
        : false;
      const matchItems =
        item.items?.some((it) =>
          it.material_name.toLowerCase().includes(q) || `${it.quantity}`.includes(q),
        ) ?? false;
      const matchAttachments =
        item.attachments?.some((att) => att.file_name.toLowerCase().includes(q)) ?? false;

      return matchId || matchDate || matchFormattedDate || matchItems || matchAttachments;
    });
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!id) {
      this.error.set('Invalid project identifier.');
      this.loading.set(false);
      return;
    }
    this.projectId.set(id);
    this.loadAllData(id);
  }

  protected loadAllData(projectId: number): void {
    this.loading.set(true);
    this.error.set(null);

    // 1. Fetch Project Details
    this.projectService.getProjectById(projectId).subscribe({
      next: (p) => {
        this.project.set(p);
        if (p.customer_id) {
          this.customerService.getCustomerById(p.customer_id).subscribe({
            next: (c) => this.customer.set(c),
            error: () => {},
          });
        }
      },
      error: (err: unknown) => {
        console.error('Failed to load project details', err);
      },
    });

    // 2. Fetch Customer Queries for this Project
    this.customerQueryService.getByProject(projectId).subscribe({
      next: (data) => {
        this.queries.set(data || []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load customer queries', err);
        this.error.set('Unable to load customer queries. Please check backend connection.');
        this.loading.set(false);
      },
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────
  protected goBack(): void {
    this.router.navigate(['/projects', this.projectId(), 'steps']);
  }

  protected goToProjects(): void {
    this.router.navigate(['/projects']);
  }

  // ── Search & Filter ────────────────────────────────────────────────
  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  // ── Open Create Query Dialog ───────────────────────────────────────
  protected openCreateDialog(): void {
    this.editingQuery.set(null);
    this.activeTab.set('fields');
    this.queryHeaderForm.reset({
      qo_date: new Date(),
    });
    this.draftItems.set([{ material_name: '', quantity: '' }]);
    this.existingAttachments.set([]);
    this.newAttachmentFiles.set([]);
    this.dialogRemarks.set([]);
    this.newRemarkInput.set('');
    this.dialogError.set(null);
    this.dialogVisible.set(true);
  }

  // ── Open Edit Query Dialog ─────────────────────────────────────────
  protected openEditDialog(query: CustomerQuery): void {
    this.editingQuery.set(query);
    this.activeTab.set('fields');
    this.queryHeaderForm.reset({
      qo_date: parseLocalDate(query.qo_date) || new Date(),
    });
    const items =
      query.items && query.items.length > 0
        ? query.items.map((it: CustomerQueryItem) => ({ ...it }))
        : [{ material_name: '', quantity: '' }];
    this.draftItems.set(items);
    this.existingAttachments.set(query.attachments ? [...query.attachments] : []);
    this.newAttachmentFiles.set([]);
    this.dialogRemarks.set(
      parseStepRemarks(query.remarks || query.remark, query.qo_date || query.created_at),
    );
    this.newRemarkInput.set('');
    this.dialogError.set(null);
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingQuery.set(null);
    this.dialogError.set(null);
  }

  // ── Line Items Dynamic Flat Table Helpers ─────────────────────────
  protected addDraftItemRow(): void {
    this.draftItems.update((list) => [...list, { material_name: '', quantity: '' }]);
  }

  protected updateItemField(
    index: number,
    field: 'material_name' | 'quantity',
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.draftItems.update((list) => {
      if (!list[index]) return list;
      const copy = [...list];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  }

  protected removeDraftItemRow(index: number): void {
    this.draftItems.update((list) => {
      const remaining = list.filter((_, i) => i !== index);
      return remaining.length > 0 ? remaining : [{ material_name: '', quantity: '' }];
    });
  }

  // ── Attachments Handling in Dialog ─────────────────────────────────
  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    this.newAttachmentFiles.update((list) => [...list, ...Array.from(files)]);
    input.value = '';
  }

  protected onDropAttachmentFiles(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.newAttachmentFiles.update((list) => [
        ...list,
        ...Array.from(event.dataTransfer!.files),
      ]);
    }
  }

  protected removeNewAttachment(index: number): void {
    this.newAttachmentFiles.update((list) => list.filter((_, i) => i !== index));
  }

  // ── Dialog Remarks Handling ────────────────────────────────────────
  protected addDialogRemark(): void {
    const text = this.newRemarkInput().trim();
    if (!text) return;

    const remarkItem = createStepRemarkItem(text);
    this.dialogRemarks.update((list) => [...list, remarkItem]);
    this.newRemarkInput.set('');
  }

  protected removeDialogRemark(index: number): void {
    this.dialogRemarks.update((list) => list.filter((_, i) => i !== index));
  }

  protected getRemarkInitials(name?: string): string {
    if (!name) return 'TM';
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (name[0] || 'TM').toUpperCase();
  }

  // ── Form Validation Helper ─────────────────────────────────────────
  protected isFieldInvalid(key: 'qo_date'): boolean {
    const c = this.queryHeaderForm.get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  // ── Submit Query (Create or Update) ────────────────────────────────
  protected submitQuery(): void {
    if (this.submitting()) return;

    if (this.queryHeaderForm.invalid) {
      this.activeTab.set('fields');
      this.queryHeaderForm.markAllAsTouched();
      this.dialogError.set('Please select a valid Query / QO Date under Form Inputs.');
      this.messageService.add({
        severity: 'warn',
        summary: 'Date Required',
        detail: 'Please select a valid Query / QO Date under Form Inputs.',
        life: 4000,
      });
      return;
    }

    // Filter out rows that are completely empty
    const validItems = this.draftItems()
      .map((it) => ({
        ...it,
        material_name: (it.material_name || '').trim(),
        quantity: typeof it.quantity === 'string' ? it.quantity.trim() : it.quantity,
      }))
      .filter((it) => it.material_name && it.quantity !== '' && it.quantity !== undefined);

    if (validItems.length === 0) {
      this.activeTab.set('table');
      this.dialogError.set('Please provide at least one material item with a name and quantity.');
      this.messageService.add({
        severity: 'warn',
        summary: 'Requirement Required',
        detail: 'Add at least one material item in the Requirement table.',
        life: 4000,
      });
      return;
    }

    const pId = this.projectId();
    const cId = this.project()?.customer_id;

    if (!cId) {
      this.dialogError.set('Project customer reference is not loaded. Please wait or reload.');
      return;
    }

    // Capture pending remark if user typed one without pressing enter
    if (this.newRemarkInput().trim()) {
      this.addDialogRemark();
    }

    const raw = this.queryHeaderForm.getRawValue();
    const qoDateStr = formatLocalDate(raw.qo_date);
    const remarksPayload: RemarkPayloadItem[] = serializeStepRemarks(this.dialogRemarks());
    const files = this.newAttachmentFiles();
    const currentQuery = this.editingQuery();

    this.submitting.set(true);
    this.dialogError.set(null);

    if (currentQuery) {
      // ── UPDATE EXISTING QUERY ──────────────────────────────────────
      const updatePayload: CustomerQueryUpdateInput = {
        project_id: pId,
        customer_id: cId,
        qo_date: qoDateStr,
        remarks: remarksPayload,
        items: validItems,
      };

      this.customerQueryService
        .update(currentQuery.id, updatePayload, files)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Query Updated',
              detail: `Customer Query #${currentQuery.id} updated successfully.`,
              life: 3500,
            });
            this.editingQuery.set(null);
            this.newAttachmentFiles.set([]);
            this.loadAllData(pId);
            this.syncTimelineStep(pId);
          },
          error: (err: unknown) => {
            console.error('Failed to update customer query', err);
            this.dialogError.set('Failed to update query. Please try again.');
            this.messageService.add({
              severity: 'error',
              summary: 'Update Failed',
              detail: 'Could not update customer query.',
            });
          },
        });
    } else {
      // ── CREATE NEW QUERY ───────────────────────────────────────────
      const createPayload: CustomerQueryCreateInput = {
        project_id: pId,
        customer_id: cId,
        qo_date: qoDateStr,
        remarks: remarksPayload,
        items: this.draftItems(),
      };

      this.customerQueryService
        .create(createPayload, files)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: (created) => {
            this.dialogVisible.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Query Created',
              detail: `New Customer Query #${created.id} created successfully.`,
              life: 3500,
            });
            this.newAttachmentFiles.set([]);
            this.loadAllData(pId);
            this.syncTimelineStep(pId);
          },
          error: (err: unknown) => {
            console.error('Failed to create customer query', err);
            this.dialogError.set('Failed to create customer query. Please try again.');
            this.messageService.add({
              severity: 'error',
              summary: 'Creation Failed',
              detail: 'Could not create customer query.',
            });
          },
        });
    }
  }

  // ── Synchronize Step 1 in Timeline ────────────────────────────────
  private syncTimelineStep(projectId: number): void {
    this.projectStepService.getSteps(projectId).subscribe({
      next: (steps) => {
        const step1 = steps.find(
          (s) =>
            s.step_number === 1 ||
            s.form_code === 'FORM_08_CUSTOMER_QUERY' ||
            s.step_name.toLowerCase().includes('query'),
        );
        if (step1 && step1.id) {
          const updatedData = {
            ...(step1.data || {}),
            queries_count: this.queries().length + 1,
            last_query_date: formatLocalDate(new Date()),
          };
          this.projectStepService
            .updateStep(projectId, step1.id, updatedData, 'completed', 100)
            .subscribe({ error: () => {} });
        }
      },
      error: () => {},
    });
  }

  // ── Delete Query Confirmation & Execution ─────────────────────────
  protected confirmDeleteQuery(query: CustomerQuery, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.queryToDelete.set(query);
    this.deleteConfirmVisible.set(true);
  }

  protected cancelDelete(): void {
    this.deleteConfirmVisible.set(false);
    this.queryToDelete.set(null);
  }

  protected executeDelete(): void {
    const query = this.queryToDelete();
    if (!query || this.deleting()) return;

    this.deleting.set(true);
    this.customerQueryService
      .delete(query.id)
      .pipe(finalize(() => this.deleting.set(false)))
      .subscribe({
        next: () => {
          this.deleteConfirmVisible.set(false);
          this.queryToDelete.set(null);
          this.messageService.add({
            severity: 'info',
            summary: 'Query Deleted',
            detail: `Customer Query #${query.id} was deleted.`,
            life: 3000,
          });
          this.loadAllData(this.projectId());
        },
        error: (err: unknown) => {
          console.error('Failed to delete query', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Delete Failed',
            detail: 'Unable to delete query. Please try again.',
          });
        },
      });
  }

  // ── File Downloads & Display Helpers ──────────────────────────────
  protected downloadAttachment(att: Attachment, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.downloadingAttachmentId.set(att.id);
    this.attachmentService
      .downloadAttachment(att.id)
      .pipe(finalize(() => this.downloadingAttachmentId.set(null)))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.file_name || `attachment-${att.id}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Download Failed',
            detail: `Failed to download file ${att.file_name}.`,
          });
        },
      });
  }

  protected formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  protected getFileIcon(typeOrName?: string): string {
    if (!typeOrName) return 'pi pi-file';
    const s = typeOrName.toLowerCase();
    if (s.endsWith('.pdf') || s.includes('pdf')) return 'pi pi-file-pdf';
    if (
      s.endsWith('.png') ||
      s.endsWith('.jpg') ||
      s.endsWith('.jpeg') ||
      s.endsWith('.webp') ||
      s.endsWith('.svg') ||
      s.includes('image')
    ) {
      return 'pi pi-image';
    }
    if (
      s.endsWith('.xlsx') ||
      s.endsWith('.xls') ||
      s.endsWith('.csv') ||
      s.includes('sheet') ||
      s.includes('excel') ||
      s.includes('csv')
    ) {
      return 'pi pi-file-excel';
    }
    if (
      s.endsWith('.docx') ||
      s.endsWith('.doc') ||
      s.includes('word') ||
      s.includes('document')
    ) {
      return 'pi pi-file-word';
    }
    return 'pi pi-file';
  }

  // ── Quick Remark Updates from Query Card ───────────────────────────
  protected onQuickAddRemarkToQuery(query: CustomerQuery, text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.quickRemarkPending()) return;

    const newRemark = createStepRemarkItem(trimmed);
    const existingRemarks = parseStepRemarks(
      query.remarks || query.remark,
      query.qo_date || query.created_at,
    );
    const updatedRemarks = [...existingRemarks, newRemark];
    const remarksPayload = serializeStepRemarks(updatedRemarks);

    this.quickRemarkPending.set(true);
    this.customerQueryService
      .update(query.id, { remarks: remarksPayload })
      .pipe(finalize(() => this.quickRemarkPending.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Remark Recorded',
            detail: 'New remark saved to query.',
            life: 3000,
          });
          this.loadAllData(this.projectId());
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to record remark.',
          });
        },
      });
  }

  protected onDeleteRemarkFromQuery(query: CustomerQuery, remarkId: string): void {
    const existingRemarks = parseStepRemarks(
      query.remarks || query.remark,
      query.qo_date || query.created_at,
    );
    const filtered = existingRemarks.filter((r) => r.id !== remarkId);
    const remarksPayload = serializeStepRemarks(filtered);

    this.customerQueryService.update(query.id, { remarks: remarksPayload }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Remark Removed',
          detail: 'Remark deleted from query.',
          life: 2500,
        });
        this.loadAllData(this.projectId());
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
