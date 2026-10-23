import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { catchError, finalize, forkJoin, Observable, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { Project } from '../../../../core/models/project.model';
import { Customer } from '../../../../core/models/customer.model';
import { Supplier } from '../../../../core/models/supplier.model';
import { ProjectStep, ProjectStepRemark, StepStatus } from '../../../../core/models/project-step.model';
import { FormDefinition, FormTableColumn, FORM_CATALOG, getFormDefinition } from '../../../../core/constants/form-catalog';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { SupplierService } from '../../../../core/services/supplier';
import { FormApiService } from '../../../../core/services/form-api';
import { formatDisplayDate } from '../../../../core/utils/date.utils';
import { createStepRemarkItem, parseStepRemarks, serializeStepRemarks } from '../../../../core/utils/remark.utils';
import { StepRemarkItem } from '../../../../core/models/step-remark.model';
import { StepFormDialog } from '../project-timeline/step-form-dialog/step-form-dialog';
import { StepRemarksComponent } from '../../../../shared/components/step-remarks/step-remarks';

@Component({
  selector: 'app-project-form-entries',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    TooltipModule,
    DialogModule,
    StepFormDialog,
    StepRemarksComponent,
  ],
  templateUrl: './project-form-entries.html',
  styleUrl: './project-form-entries.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectFormEntries implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly supplierService = inject(SupplierService);
  private readonly formApiService = inject(FormApiService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  private safeUntilDestroyed<T>() {
    return this.destroyRef
      ? takeUntilDestroyed<T>(this.destroyRef)
      : (source: Observable<T>) => source;
  }

  // ── Route & Entity Signals ──────────────────────────────────────────
  readonly projectId = signal<number | null>(null);
  readonly formCode = signal<string>('');
  readonly project = signal<Project | null>(null);
  readonly customer = signal<Customer | null>(null);
  readonly supplier = signal<Supplier | null>(null);
  readonly allSteps = signal<ProjectStep[]>([]);
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  // ── Filter & Search Signals ─────────────────────────────────────────
  readonly searchQuery = signal<string>('');

  // ── Dialog Signals ──────────────────────────────────────────────────
  readonly dialogVisible = signal<boolean>(false);
  readonly selectedStepForDialog = signal<ProjectStep | null>(null);

  // ── Delete Confirmation Signals ─────────────────────────────────────
  readonly deleteConfirmVisible = signal<boolean>(false);
  readonly stepToDelete = signal<ProjectStep | null>(null);
  readonly deleting = signal<boolean>(false);

  // ── Quick Remark Signals ────────────────────────────────────────────
  readonly quickRemarkPending = signal<boolean>(false);

  // ── Computed Properties ─────────────────────────────────────────────
  readonly formDefinition = computed<FormDefinition | null>(() => {
    const raw = this.formCode();
    if (!raw) return null;

    const num = Number(raw);
    if (!isNaN(num) && num > 0) {
      return getFormDefinition(num) || null;
    }

    if (raw.toLowerCase().includes('quer')) {
      return getFormDefinition('FORM_08_CUSTOMER_QUERY') || null;
    }

    return (
      getFormDefinition(raw) ||
      FORM_CATALOG.find(
        (f) =>
          f.formCode.toLowerCase() === raw.toLowerCase() ||
          f.name.toLowerCase() === raw.toLowerCase(),
      ) ||
      null
    );
  });

  readonly projectIdNumber = computed(() => this.projectId() || 0);

  readonly formStepNumber = computed(() => {
    const def = this.formDefinition();
    if (!def) return '—';
    return ('0' + def.id).slice(-2);
  });

  readonly formCategory = computed(() => {
    return this.formDefinition()?.category || 'Project Pipeline';
  });

  readonly tableColumns = computed<FormTableColumn[]>(() => {
    const def = this.formDefinition();
    if (def?.tableConfig?.columns && def.tableConfig.columns.length > 0) {
      return def.tableConfig.columns;
    }
    return [
      { key: 'sr_no', label: '#', type: 'number', width: '50px' },
      { key: 'description', label: 'Description / Details', type: 'text' },
      { key: 'unit', label: 'Unit', type: 'text', width: '100px' },
      { key: 'quantity', label: 'Quantity', type: 'number', width: '110px' },
      { key: 'total_amount', label: 'Total (₹)', type: 'currency', width: '130px' },
    ];
  });

  readonly projectCode = computed(() => {
    return (
      this.project()?.project_code ||
      (this.projectId() ? `PRJ-${this.projectId()}` : 'PRJ')
    );
  });

  readonly entries = computed<ProjectStep[]>(() => {
    const def = this.formDefinition();
    const rawCode = (this.formCode() || '').toLowerCase();
    const steps = this.allSteps();

    if (!def) {
      return steps.filter((s) => (s.form_code || '').toLowerCase() === rawCode);
    }

    const defCode = def.formCode.toLowerCase();
    const defName = def.name.toLowerCase();

    return steps.filter((s) => {
      const sCode = (s.form_code || '').toLowerCase();
      const sName = (s.step_name || '').toLowerCase();
      return (
        sCode === defCode ||
        sCode === rawCode ||
        s.step_number === def.id ||
        sName === defName ||
        (defName.length > 5 && sName.includes(defName))
      );
    });
  });

  readonly filteredEntries = computed<ProjectStep[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.entries();
    if (!q) return list;

    return list.filter((item) => {
      const matchId = String(item.id || item.step_number).includes(q);
      const matchName = (item.step_name || '').toLowerCase().includes(q);
      const matchStatus = (item.status || '').toLowerCase().includes(q);

      let matchData = false;
      if (item.data && typeof item.data === 'object') {
        const strValues = Object.values(item.data).join(' ').toLowerCase();
        matchData = strValues.includes(q);
      }

      let matchRemarks = false;
      const remarks = this.getEntryRemarks(item);
      matchRemarks = remarks.some((r) => r.text.toLowerCase().includes(q));

      return matchId || matchName || matchStatus || matchData || matchRemarks;
    });
  });

  readonly totalEntriesCount = computed(() => this.entries().length);

  readonly inProgressCount = computed(
    () => this.entries().filter((e) => e.status === 'in_progress').length,
  );

  readonly completedCount = computed(
    () => this.entries().filter((e) => e.status === 'completed').length,
  );

  readonly totalAttachmentsCount = computed(() =>
    this.entries().reduce((sum, e) => sum + this.getEntryAttachments(e).length, 0),
  );

  readonly totalRemarksCount = computed(() =>
    this.entries().reduce((sum, e) => sum + this.getEntryRemarks(e).length, 0),
  );

  ngOnInit(): void {
    // Reactively respond to route parameter changes (e.g., switching steps without full reload)
    this.route.paramMap
      .pipe(this.safeUntilDestroyed())
      .subscribe((params) => {
        const pParam = params.get('projectId');
        const fParam =
          params.get('formCode') ||
          params.get('stepNumber') ||
          (this.route.snapshot.data ? this.route.snapshot.data['formCode'] : '');

        const pId = Number(pParam);
        if (!pId || isNaN(pId)) {
          this.error.set('Invalid or missing project identifier.');
          this.loading.set(false);
          return;
        }

        const prevId = this.projectId();
        const prevCode = this.formCode();
        this.projectId.set(pId);
        this.formCode.set(fParam || '');

        if (prevId !== pId || prevCode !== (fParam || '') || this.allSteps().length === 0) {
          this.loadAllData(pId);
        }
      });
  }

  loadAllData(projectId: number): void {
    this.loading.set(true);
    this.error.set(null);

    const def = this.formDefinition();
    if (!def) {
      this.loading.set(false);
      this.error.set('Form definition not found in catalog.');
      return;
    }

    const entries$ = this.formApiService.getEntries(def, projectId).pipe(
      catchError(() => of([])),
    );

    // Load project metadata and form entries in parallel without waterfalls
    forkJoin({
      project: this.projectService.getProjectById(projectId).pipe(catchError(() => of(null))),
      steps: entries$,
    })
      .pipe(
        this.safeUntilDestroyed(),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ project, steps }) => {
          if (project) {
            this.project.set(project);
            this.loadCustomerAndSupplier(project);
          } else {
            this.error.set('Could not load project context.');
          }
          this.allSteps.set(steps || []);
        },
        error: () => {
          this.error.set('Could not load form entries for this project.');
        },
      });
  }

  private loadCustomerAndSupplier(p: Project): void {
    if (p.customer_id) {
      this.customerService
        .getCustomerById(p.customer_id)
        .pipe(
          this.safeUntilDestroyed(),
          catchError(() => of(null)),
        )
        .subscribe((cust) => this.customer.set(cust));
    }
    if (p.supplier_id) {
      this.supplierService
        .getSupplierById(p.supplier_id)
        .pipe(
          this.safeUntilDestroyed(),
          catchError(() => of(null)),
        )
        .subscribe((supp) => this.supplier.set(supp));
    }
  }

  goBackToTimeline(): void {
    const pId = this.projectId();
    if (pId) {
      this.router.navigate(['/projects', pId, 'steps']);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  // ── Search & Filter ─────────────────────────────────────────────────
  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  // ── Dialog Handlers (Add / Edit) ────────────────────────────────────
  openCreateDialog(): void {
    this.selectedStepForDialog.set(null);
    this.dialogVisible.set(true);
  }

  openEditDialog(entry: ProjectStep): void {
    this.selectedStepForDialog.set(entry);
    this.dialogVisible.set(true);
  }

  onStepSaved(savedStep: ProjectStep): void {
    this.allSteps.update((current) => {
      const idx = current.findIndex(
        (s) =>
          (s.id && savedStep.id && s.id === savedStep.id) ||
          (!savedStep.id && s.step_number === savedStep.step_number && s.form_code === savedStep.form_code),
      );
      if (idx >= 0) {
        const copy = [...current];
        copy[idx] = savedStep;
        return copy;
      }
      return [...current, savedStep];
    });

    this.messageService.add({
      severity: 'success',
      summary: 'Entry Saved',
      detail: `Successfully saved ${savedStep.step_name || 'entry'}.`,
    });
    this.dialogVisible.set(false);
  }

  onStepDeleted(stepId: number): void {
    this.allSteps.update((current) =>
      current.filter((s) => s.id !== stepId && s.step_number !== stepId),
    );
    this.dialogVisible.set(false);
  }

  // ── Delete Confirmation Handlers ────────────────────────────────────
  confirmDeleteEntry(entry: ProjectStep, event?: Event): void {
    if (event) event.stopPropagation();
    this.stepToDelete.set(entry);
    this.deleteConfirmVisible.set(true);
  }

  cancelDelete(): void {
    this.deleteConfirmVisible.set(false);
    this.stepToDelete.set(null);
  }

  executeDelete(): void {
    const step = this.stepToDelete();
    const pId = this.projectId();
    if (!step || !pId) {
      this.cancelDelete();
      return;
    }

    const stepId = step.id || step.step_number;
    this.deleting.set(true);
    const def = this.formDefinition();

    const delete$ = def
      ? this.formApiService.deleteEntry(def, pId, stepId)
      : of(false);

    delete$
      .pipe(
        this.safeUntilDestroyed(),
        finalize(() => {
          this.deleting.set(false);
          this.cancelDelete();
        }),
      )
      .subscribe({
        next: () => {
          this.allSteps.update((current) =>
            current.filter((s) => s.id !== step.id && s.step_number !== step.step_number),
          );
          this.messageService.add({
            severity: 'success',
            summary: 'Entry Deleted',
            detail: `Entry has been successfully removed.`,
            life: 3000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Delete Failed',
            detail: 'Could not delete entry. Please try again.',
          });
        },
      });
  }

  // ── Quick Remark Support ────────────────────────────────────
  onQuickAddRemark(entry: ProjectStep, text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.quickRemarkPending()) return;

    this.quickRemarkPending.set(true);
    const newRemark = createStepRemarkItem(trimmed);
    const pId = this.projectId();
    const stepId = entry.id || entry.step_number;

    if (!pId) {
      this.quickRemarkPending.set(false);
      return;
    }

    const currentRemarks = this.getEntryRemarks(entry);
    const updatedRemarks = [...currentRemarks, newRemark];
    const updatedData: Record<string, unknown> = {
      ...(entry.data || {}),
      remarks: serializeStepRemarks(updatedRemarks),
    };

    const def = this.formDefinition();
    const update$ = def
      ? this.formApiService.updateEntry(def, pId, stepId, updatedData)
      : of(entry);

    update$
      .pipe(
        this.safeUntilDestroyed(),
        finalize(() => this.quickRemarkPending.set(false)),
      )
      .subscribe({
        next: (updated) => {
          this.onStepSaved(updated);
          this.messageService.add({
            severity: 'success',
            summary: 'Remark Added',
            detail: 'Your observation was recorded.',
            life: 3000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Failed',
            detail: 'Could not add remark. Try again.',
          });
        },
      });
  }

  onQuickAddRemarkToEntry(entry: ProjectStep, text: string): void {
    this.onQuickAddRemark(entry, text);
  }

  onDeleteRemarkFromEntry(entry: ProjectStep, remarkId: string): void {
    const currentRemarks = this.getEntryRemarks(entry);
    const filtered = currentRemarks.filter((r) => r.id !== remarkId);
    const remarksPayload = serializeStepRemarks(filtered);

    const pId = this.projectId();
    const stepId = entry.id || entry.step_number;
    if (!pId || !stepId) return;

    const updatedData: Record<string, unknown> = {
      ...(entry.data || {}),
      remarks: remarksPayload,
    };

    const def = this.formDefinition();
    const update$ = def
      ? this.formApiService.updateEntry(def, pId, stepId, updatedData)
      : of(entry);

    update$
      .pipe(this.safeUntilDestroyed())
      .subscribe({
        next: (updated) => {
          this.onStepSaved(updated);
          this.messageService.add({
            severity: 'info',
            summary: 'Remark Removed',
            detail: 'Remark deleted from entry timeline.',
            life: 2500,
          });
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

  downloadAttachment(att: { name: string; size: string }, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.messageService.add({
      severity: 'info',
      summary: 'Document Download',
      detail: `Preparing download for ${att.name}...`,
      life: 3000,
    });
  }

  formatCellValue(row: Record<string, unknown>, col: FormTableColumn, rowIndex: number): string {
    if (col.key === 'sr_no') {
      return String(row['sr_no'] ?? (rowIndex + 1));
    }
    const val = row[col.key];
    if (val === undefined || val === null || val === '') return '—';

    if (col.type === 'currency' && (typeof val === 'number' || !isNaN(Number(val)))) {
      return '₹ ' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (col.type === 'date' && typeof val === 'string') {
      return formatDisplayDate(val);
    }
    return String(val);
  }

  calculateTableTotal(entry: ProjectStep): number | null {
    const items = this.getTableItems(entry);
    if (!items.length) return null;

    const def = this.formDefinition();
    const cols = def?.tableConfig?.columns || this.tableColumns();
    let totalColKey = cols.find(
      (c) =>
        c.type === 'currency' ||
        c.key === 'total_amount' ||
        c.key === 'total_price' ||
        c.key === 'total' ||
        c.key === 'amount',
    )?.key;

    if (!totalColKey) {
      for (const candidate of ['total_amount', 'total_price', 'total', 'amount']) {
        if (items.some((it) => it[candidate] !== undefined && it[candidate] !== null && it[candidate] !== '')) {
          totalColKey = candidate;
          break;
        }
      }
    }

    if (!totalColKey) return null;

    let sum = 0;
    let hasValid = false;
    for (const it of items) {
      const val = Number(it[totalColKey]);
      if (!isNaN(val)) {
        sum += val;
        hasValid = true;
      }
    }
    return hasValid ? sum : null;
  }

  getTableTotalFormatted(entry: ProjectStep): string | null {
    const total = this.calculateTableTotal(entry);
    if (total === null) return null;
    return '₹ ' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Helper Presentation Methods ─────────────────────────────────────
  getDisplayFields(entry: ProjectStep): Array<{ label: string; value: string }> {
    const def = this.formDefinition();
    if (!def || !entry.data || typeof entry.data !== 'object') return [];

    const fields: Array<{ label: string; value: string }> = [];
    for (const f of def.fields) {
      const val = entry.data[f.key];
      if (val !== undefined && val !== null && val !== '') {
        let formattedVal = String(val);
        if (Array.isArray(val)) {
          formattedVal = val.join(', ');
        } else if (f.type === 'select' && f.options && typeof val === 'string') {
          const match = f.options.find(
            (opt) => (typeof opt === 'object' && opt !== null ? opt.value === val : opt === val),
          );
          if (match && typeof match === 'object') {
            formattedVal = match.label;
          }
        } else if (f.type === 'currency' && typeof val === 'number') {
          formattedVal = '₹ ' + val.toLocaleString('en-IN', { minimumFractionDigits: 2 });
        } else if (f.type === 'date' && typeof val === 'string') {
          formattedVal = formatDisplayDate(val);
        }
        fields.push({ label: f.label, value: formattedVal });
      }
    }
    return fields;
  }

  getTableItems(entry: ProjectStep): Array<Record<string, unknown>> {
    if (!entry.data || typeof entry.data !== 'object') return [];
    if (Array.isArray(entry.data['items'])) {
      return entry.data['items'] as Array<Record<string, unknown>>;
    }
    if (Array.isArray(entry.data['table_items'])) {
      return entry.data['table_items'] as Array<Record<string, unknown>>;
    }
    return [];
  }

  getEntryAttachments(entry: ProjectStep): Array<{ name: string; size: string }> {
    if (!entry.data || typeof entry.data !== 'object') return [];
    const list: Array<{ name: string; size: string }> = [];

    if (Array.isArray(entry.data['attachments'])) {
      for (const a of entry.data['attachments'] as unknown[]) {
        if (typeof a === 'object' && a) {
          const rec = a as Record<string, unknown>;
          list.push({
            name: String(rec['file_name'] || rec['name'] || 'document.pdf'),
            size: String(rec['size'] || '—'),
          });
        }
      }
    }

    const count = Number(entry.data['attachments_count']) || 0;
    if (list.length === 0 && count > 0) {
      for (let i = 1; i <= count; i++) {
        list.push({
          name: `${this.formDefinition()?.formCode || 'step'}_attachment_${i}.pdf`,
          size: '—',
        });
      }
    }

    return list;
  }

  getEntryRemarks(entry: ProjectStep): StepRemarkItem[] {
    const list = [...(entry.remarks || [])];
    if (entry.data && typeof entry.data === 'object' && Array.isArray(entry.data['remarks'])) {
      return parseStepRemarks(entry.data['remarks']);
    }
    return parseStepRemarks(list);
  }

  getRemarkInitials(name?: string): string {
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

  getFileIcon(fileName?: string): string {
    if (!fileName) return 'pi pi-file';
    const s = fileName.toLowerCase();
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

  statusLabel(status?: StepStatus): string {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'skipped':
        return 'Skipped';
      default:
        return 'Pending';
    }
  }

  statusIcon(status?: StepStatus): string {
    switch (status) {
      case 'completed':
        return 'pi-check-circle';
      case 'in_progress':
        return 'pi-spin pi-spinner';
      case 'skipped':
        return 'pi-forward';
      default:
        return 'pi-clock';
    }
  }

  getEntryDate(entry: ProjectStep): string {
    if (entry.data && typeof entry.data === 'object') {
      const d = entry.data;
      const dateKeys = [
        'qo_date',
        'po_date',
        'invoice_date',
        'pqb_issuing_date',
        'issue_date',
        'delivery_date',
        'order_date',
        'payment_date',
      ];
      for (const k of dateKeys) {
        if (d[k]) {
          return formatDisplayDate(String(d[k]));
        }
      }
    }
    return formatDisplayDate(entry.created_at || entry.completed_at || new Date().toISOString());
  }
}
