import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, Observable, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
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
import { getTableRowCellValue, isTableRowEmpty, normalizeTableRow } from '../../../../core/utils/form.utils';
import { createStepRemarkItem, parseStepRemarks, serializeStepRemarks } from '../../../../core/utils/remark.utils';
import { StepRemarkItem } from '../../../../core/models/step-remark.model';
import { StepFormDialog } from '../project-timeline/step-form-dialog/step-form-dialog';
import { StepRemarksComponent } from '../../../../shared/components/step-remarks/step-remarks';

export interface EntryDisplayField {
  key: string;
  label: string;
  value: string;
  type: string;
  colSpan: number;
  icon: string;
  isLongText: boolean;
  isHighlight?: boolean;
  isPill?: boolean;
  isTitle?: boolean;
  isClause?: boolean;
}

@Component({
  selector: 'app-project-form-entries',
  imports: [
    CommonModule,
    ButtonModule,
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

  // ── Quick Remark & Collapsible State ──────────────────────────────
  readonly quickRemarkPending = signal<boolean>(false);
  readonly openRemarksEntryIds = signal<Set<string | number>>(new Set());

  isRemarksOpen(entryKey: string | number): boolean {
    return this.openRemarksEntryIds().has(entryKey);
  }

  toggleRemarks(entryKey: string | number): void {
    this.openRemarksEntryIds.update((set) => {
      const next = new Set(set);
      if (next.has(entryKey)) {
        next.delete(entryKey);
      } else {
        next.add(entryKey);
      }
      return next;
    });
  }

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
          const entryKey = entry.id ?? entry.step_number;
          if (entryKey) {
            this.openRemarksEntryIds.update((set) => new Set(set).add(entryKey));
          }
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
    let val = getTableRowCellValue(row, col.key);

    // If total column is blank/dash, check if we can compute from quantity * unit_price
    if (
      (val === undefined || val === null || val === '') &&
      (col.key === 'total_amount' || col.key === 'total_price' || col.key === 'total')
    ) {
      const q = Number(row['quantity'] ?? row['qty']);
      const up = Number(row['unit_price'] ?? row['rate'] ?? row['price']);
      if (!isNaN(q) && !isNaN(up) && q > 0 && up > 0) {
        val = q * up;
      }
    }

    if (val === undefined || val === null || val === '') return '—';

    if (
      (col.type === 'currency' || col.key.includes('price') || col.key.includes('amount')) &&
      (typeof val === 'number' || !isNaN(Number(val)))
    ) {
      return '₹\u00A0' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (col.type === 'number' && (typeof val === 'number' || !isNaN(Number(val)))) {
      return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    }
    if (col.type === 'date' && (typeof val === 'string' || typeof val === 'number' || val instanceof Date)) {
      return formatDisplayDate(val, 'd MMM yyyy');
    }
    return String(val);
  }

  calculateTableTotal(entry: ProjectStep): number | null {
    const items = this.getTableItems(entry);
    if (!items.length) return null;

    const def = this.formDefinition();
    const cols = def?.tableConfig?.columns || this.tableColumns();

    // Check configured totalKey first
    let totalColKey = def?.tableConfig?.totalKey;
    if (!totalColKey) {
      // Find a column explicitly representing total
      totalColKey = cols.find(
        (c) =>
          c.key === 'total_amount' ||
          c.key === 'total_price' ||
          c.key === 'total' ||
          c.key === 'amount',
      )?.key;
    }
    if (!totalColKey) {
      for (const candidate of ['total_amount', 'total_price', 'total', 'amount']) {
        if (items.some((it) => it[candidate] !== undefined && it[candidate] !== null && it[candidate] !== '')) {
          totalColKey = candidate;
          break;
        }
      }
    }
    if (!totalColKey) {
      totalColKey = cols.find((c) => c.type === 'currency' && !c.key.includes('unit') && !c.key.includes('rate'))?.key;
    }
    if (!totalColKey) {
      totalColKey = cols.find((c) => c.type === 'currency')?.key;
    }

    let sum = 0;
    let hasValid = false;
    for (const it of items) {
      let val = totalColKey ? Number(it[totalColKey]) : NaN;
      if (isNaN(val) || val === 0) {
        // Fallback: quantity * unit_price if item row only has quantity & unit_price
        const q = Number(it['quantity'] ?? it['qty']);
        const up = Number(it['unit_price'] ?? it['rate'] ?? it['price']);
        if (!isNaN(q) && !isNaN(up) && q > 0 && up > 0) {
          val = q * up;
        }
      }
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
    return '₹\u00A0' + total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Helper Presentation Methods ─────────────────────────────────────
  getDisplayFields(entry: ProjectStep): EntryDisplayField[] {
    const def = this.formDefinition();
    if (!def || !entry.data || typeof entry.data !== 'object') return [];

    const rawFields: (EntryDisplayField & { _order: number })[] = [];
    for (const f of def.fields) {
      const val = entry.data[f.key];
      if (val !== undefined && val !== null && val !== '') {
        let formattedVal = String(val);
        const strVal = typeof val === 'string' ? val.trim() : '';

        if (Array.isArray(val)) {
          formattedVal = val.join(', ');
        } else if (f.type === 'select' && f.options && typeof val === 'string') {
          const match = f.options.find(
            (opt) => (typeof opt === 'object' && opt !== null ? opt.value === val : opt === val),
          );
          if (match && typeof match === 'object') {
            formattedVal = match.label;
          }
        } else if (f.type === 'currency' && (typeof val === 'number' || !isNaN(Number(val)))) {
          formattedVal = '₹\u00A0' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else if (f.type === 'datetime') {
          const dateInput = typeof val === 'string' || typeof val === 'number' || val instanceof Date ? val : String(val);
          formattedVal = formatDisplayDate(dateInput, 'dd-MM-yyyy, hh:mm a');
        } else if (f.type === 'date') {
          const dateInput = typeof val === 'string' || typeof val === 'number' || val instanceof Date ? val : String(val);
          formattedVal = formatDisplayDate(dateInput, 'd MMM yyyy');
        } else if (strVal && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(strVal)) {
          formattedVal = formatDisplayDate(strVal, 'dd-MM-yyyy, hh:mm a');
        } else if (strVal && /^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
          formattedVal = formatDisplayDate(strVal, 'd MMM yyyy');
        }

        const k = f.key.toLowerCase();
        const isTitle =
          (k.includes('title') || k.includes('subject') || k === 'name' || k === 'purpose') &&
          !k.includes('customer') &&
          !k.includes('supplier');
        const isDateOrTime =
          f.type === 'date' ||
          f.type === 'datetime' ||
          k.includes('date') ||
          k.includes('time') ||
          /^\d{4}-\d{2}-\d{2}/.test(strVal);
        const isRefNumber =
          k === 'id' ||
          k.endsWith('_id') ||
          k.startsWith('id_') ||
          k === 'no' ||
          k.endsWith('_no') ||
          k.startsWith('no_') ||
          k.includes('number') ||
          k.includes('code') ||
          k.includes('ref');

        // Multi-line legal clauses, textarea, or long narrative terms
        const isClause =
          (k.includes('terms') && !k.includes('delivery_terms')) ||
          k.includes('condition') ||
          k.includes('clause') ||
          k.includes('scope') ||
          f.type === 'textarea' ||
          formattedVal.length > 50;

        // Compact specification badges/pills
        const isPill =
          !isClause &&
          !isTitle &&
          (f.type === 'select' ||
            k.includes('validity') ||
            k.includes('period') ||
            k.includes('delivery_terms') ||
            k.includes('status') ||
            k.includes('gst') ||
            k.includes('mode') ||
            k.includes('incoterm') ||
            k.includes('type')) &&
          formattedVal.length <= 25;

        // Structured Column Spanning in a 4-Column Grid:
        // 10: Title (4 cols - spans full width)
        // 20: Dates & Reference Numbers (2 cols - pairs neatly 2 + 2 = 4)
        // 30: Compact Terms & Pills (1 col - packs neatly 1 + 1 + 1 + 1 = 4)
        // 40: Multi-line Clauses & Terms (4 cols - spans full width)
        let colSpan = 1;
        let order = 30;

        if (isTitle) {
          colSpan = 4;
          order = 10;
        } else if (isClause) {
          colSpan = 4;
          order = 40;
        } else if (isDateOrTime || isRefNumber) {
          colSpan = 2;
          order = 20;
        } else {
          colSpan = 1;
          order = 30;
        }

        const isHighlight =
          k.includes('closing') ||
          k.includes('opening');

        rawFields.push({
          key: f.key,
          label: f.label,
          value: formattedVal,
          type: f.type || 'text',
          colSpan,
          icon: this.getFieldIcon(f.key, f.type),
          isLongText: colSpan === 4,
          isHighlight: !!isHighlight,
          isPill: !!isPill,
          isTitle: !!isTitle,
          isClause: !!isClause,
          _order: order,
        });
      }
    }

    return rawFields
      .sort((a, b) => a._order - b._order)
      .map(({ _order, ...rest }) => rest);
  }

  getFieldIcon(fieldKey: string, fieldType?: string): string {
    const k = fieldKey.toLowerCase();
    const t = (fieldType || '').toLowerCase();

    if (t === 'datetime' || t.includes('time') || k.includes('time') || k.includes('closing') || k.includes('opening')) {
      return 'pi pi-clock';
    }
    if (t === 'date' || k.includes('date')) return 'pi pi-calendar';
    if (k.includes('warranty') || k.includes('guarantee') || k.includes('security')) return 'pi pi-shield';
    if (k.includes('valid') || k.includes('period') || k.includes('duration')) return 'pi pi-hourglass';
    if (t === 'currency' || k.includes('fee') || k.includes('amount') || k.includes('price') || k.includes('cost')) {
      return 'pi pi-indian-rupee';
    }
    if (k.includes('customer') || k.includes('client') || k.includes('org')) return 'pi pi-building';
    if (k.includes('supplier') || k.includes('vendor') || k.includes('delivery') || k.includes('transport') || k.includes('incoterm')) {
      return 'pi pi-truck';
    }
    if (k.includes('title') || k.includes('subject') || k.includes('desc') || k.includes('name')) return 'pi pi-bookmark';
    if (k.includes('pay') || k.includes('terms') || k.includes('condition')) return 'pi pi-credit-card';
    if (
      k === 'id' ||
      k.endsWith('_id') ||
      k.startsWith('id_') ||
      k === 'no' ||
      k.endsWith('_no') ||
      k.startsWith('no_') ||
      k.includes('number') ||
      k.includes('code') ||
      k.includes('ref')
    ) {
      return 'pi pi-hashtag';
    }
    if (k.includes('status') || k.includes('stage')) return 'pi pi-info-circle';
    return 'pi pi-file-edit';
  }

  getTableItems(entry: ProjectStep): Array<Record<string, unknown>> {
    let raw: Array<Record<string, unknown>> = [];
    if (entry.data && typeof entry.data === 'object') {
      if (Array.isArray(entry.data['items'])) {
        raw = entry.data['items'] as Array<Record<string, unknown>>;
      } else if (Array.isArray(entry.data['table_items'])) {
        raw = entry.data['table_items'] as Array<Record<string, unknown>>;
      } else if (Array.isArray(entry.data['materials'])) {
        raw = entry.data['materials'] as Array<Record<string, unknown>>;
      }
    } else if (typeof entry.data === 'string') {
      try {
        const parsed = JSON.parse(entry.data);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed['items'])) {
            raw = parsed['items'];
          } else if (Array.isArray(parsed['table_items'])) {
            raw = parsed['table_items'];
          } else if (Array.isArray(parsed['materials'])) {
            raw = parsed['materials'];
          }
        }
      } catch {
        // ignore JSON parse error
      }
    }

    const entryRec = entry as unknown as Record<string, unknown>;
    if (!raw.length && Array.isArray(entryRec['items'])) {
      raw = entryRec['items'] as Array<Record<string, unknown>>;
    }

    return raw.filter((r) => !isTableRowEmpty(r)).map(normalizeTableRow);
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

  hasSpecsOrAttachments(entry: ProjectStep): boolean {
    return this.getDisplayFields(entry).length > 0 || this.getEntryAttachments(entry).length > 0;
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
        'pqb_issuing_date',
        'pqb_issue_date',
        'tender_issue_date',
        'query_date',
        'request_date',
        'eoi_date',
        'nac_date',
        'qo_date',
        'quotation_date',
        'po_date',
        'order_confirmation_date',
        'proforma_invoice_date',
        'invoice_date',
        'packing_list_date',
        'delivery_challan_date',
        'delivery_date',
        'order_date',
        'payment_date',
        'payment_received_date',
        'certificate_date',
        'shipment_date',
        'boe_filing_date',
        'duty_paid_date',
        'lr_rr_awb_date',
        'issue_date',
      ];
      for (const k of dateKeys) {
        if (d[k]) {
          return formatDisplayDate(String(d[k]), 'd MMM yyyy');
        }
      }
    }
    return formatDisplayDate(entry.created_at || entry.completed_at || new Date().toISOString(), 'd MMM yyyy');
  }
}
