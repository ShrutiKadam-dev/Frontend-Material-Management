import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { ProjectService } from '../../../core/services/project';
import { ProjectStepService } from '../../../core/services/project-step';
import { CustomerService } from '../../../core/services/customer';
import { SupplierService } from '../../../core/services/supplier';
import { Project } from '../../../core/models/project.model';
import { Customer } from '../../../core/models/customer.model';
import { Supplier } from '../../../core/models/supplier.model';
import { ProjectStep, ProjectStepRemark, StepStatus } from '../../../core/models/project-step.model';
import {
  FORM_CATALOG,
  FormDefinition,
  FormFieldDefinition,
  getFormDefinition,
  LEGACY_STEP_TO_FORM_CODE,
} from '../../../core/constants/form-catalog';
import { SelectOption } from '../../../core/constants/dropdown-options.constant';
import { StepRemarksComponent } from '../../../shared/components/step-remarks/step-remarks';
import {
  formatLocalDate,
  formatLocalDateTime,
  parseLocalDate,
  parseLocalDateTime,
  sanitizePayloadDates,
} from '../../../core/utils/date.utils';
import {
  calculateTableTotalsWithGst,
  cleanTableItems,
  extractGstRate,
  getTableRowCellValue,
  hasGstConfigured,
  isTableRowEmpty,
  normalizeTableRow,
} from '../../../core/utils/form.utils';

@Component({
  selector: 'app-dynamic-step-form',
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    SelectModule,
    TooltipModule,
    StepRemarksComponent,
  ],
  templateUrl: './dynamic-step-form.html',
  styleUrl: './dynamic-step-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicStepForm implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly projectStepService = inject(ProjectStepService);
  private readonly customerService = inject(CustomerService);
  private readonly supplierService = inject(SupplierService);
  private readonly messageService = inject(MessageService);

  // ── Route & State Signals ─────────────────────────────────────────
  protected readonly projectId = signal<number>(0);
  protected readonly stepIdentifier = signal<string>(''); // could be stepId or formCode
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly currentStep = signal<ProjectStep | null>(null);
  protected readonly stepRemarks = signal<ProjectStepRemark[]>([]);
  protected readonly allSteps = signal<ProjectStep[]>([]);
  protected readonly loading = signal<boolean>(true);
  protected readonly saving = signal<boolean>(false);
  protected readonly isFormInvalid = signal<boolean>(false);
  private formStatusSub?: Subscription;
  private readonly destroyRef = inject(DestroyRef, { optional: true });

  // ── Form Definition & Structure ───────────────────────────────────
  protected readonly formDefinition = signal<FormDefinition | null>(null);
  protected readonly formGroup = signal<FormGroup>(new FormGroup({}));
  protected readonly tableFormArray = signal<FormArray<FormGroup>>(new FormArray<FormGroup>([]));

  protected readonly isSaveDisabled = computed(() => {
    if (this.saving() || this.loading()) return true;
    return this.isFormInvalid();
  });

  // ── Uploaded Attachments Simulation / Tracking ────────────────────
  protected readonly uploadedFiles = signal<Array<{ name: string; size: string; uploadKey: string }>>([]);

  // ── Add Next Step Modal inside Form ───────────────────────────────
  protected readonly catalogModalVisible = signal<boolean>(false);
  protected readonly catalogSearch = signal<string>('');
  protected readonly selectedCategory = signal<string>('All');
  protected readonly allCatalogForms = FORM_CATALOG;

  // ── Derived Signals ───────────────────────────────────────────────
  protected readonly currentStepIndex = computed(() => {
    const list = this.allSteps();
    const cur = this.currentStep();
    if (!cur) return 0;
    const idx = list.findIndex((s) => s.id === cur.id || s.step_number === cur.step_number);
    return idx >= 0 ? idx + 1 : 1;
  });

  protected readonly totalStepsCount = computed(() => this.allSteps().length || 1);

  protected readonly isStepCompleted = computed(
    () => this.currentStep()?.status === 'completed',
  );

  protected readonly filteredCatalog = computed(() => {
    const q = this.catalogSearch().toLowerCase().trim();
    const cat = this.selectedCategory();
    return this.allCatalogForms.filter((f: FormDefinition) => {
      const matchCat = cat === 'All' || f.category === cat;
      const matchQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.formCode.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  });

  protected clearCatalogSearch(): void {
    this.catalogSearch.set('');
  }

  protected readonly tableVersion = signal<number>(0);
  protected readonly formVersion = signal<number>(0);

  protected readonly tableTotalSum = computed(() => {
    this.tableVersion();
    const arr = (this.tableFormArray()?.value || []) as Array<Record<string, unknown>>;
    const cfg = this.formDefinition()?.tableConfig;
    if (!cfg || !cfg.totalKey) return 0;
    return arr.reduce((sum, row) => sum + (Number(row[cfg.totalKey!]) || 0), 0);
  });

  protected readonly tableNetAmount = computed(() => this.tableTotalSum());

  protected readonly tableGstRate = computed(() => {
    this.formVersion();
    const def = this.formDefinition();
    const formVals = (this.formGroup()?.value || {}) as Record<string, unknown>;
    return extractGstRate(formVals, def?.fields) ?? 0;
  });

  protected readonly tableGstAmount = computed(() => {
    this.formVersion();
    const net = this.tableNetAmount();
    const formVals = (this.formGroup()?.value || {}) as Record<string, unknown>;
    const explicitGst =
      formVals['gst_amount'] !== undefined && formVals['gst_amount'] !== null && formVals['gst_amount'] !== ''
        ? Number(formVals['gst_amount'])
        : null;
    return calculateTableTotalsWithGst(net, this.tableGstRate(), explicitGst).gst_amount;
  });

  protected readonly tableGrossTotalSum = computed(() => {
    this.formVersion();
    const net = this.tableNetAmount();
    const formVals = (this.formGroup()?.value || {}) as Record<string, unknown>;
    const explicitGst =
      formVals['gst_amount'] !== undefined && formVals['gst_amount'] !== null && formVals['gst_amount'] !== ''
        ? Number(formVals['gst_amount'])
        : null;
    return calculateTableTotalsWithGst(net, this.tableGstRate(), explicitGst).total_gross_amount;
  });

  protected readonly hasTableGst = computed(() => {
    this.formVersion();
    const def = this.formDefinition();
    const formVals = (this.formGroup()?.value || {}) as Record<string, unknown>;
    return hasGstConfigured(def?.fields, formVals) || this.tableGstRate() > 0 || this.tableGstAmount() > 0;
  });

  ngOnInit(): void {
    this.destroyRef?.onDestroy(() => {
      this.formStatusSub?.unsubscribe();
    });

    this.route.paramMap.subscribe((params) => {
      const pId = Number(params.get('projectId'));
      const sId = params.get('stepId') || params.get('formCode') || '';
      if (pId && (sId === '1' || sId === 'FORM_08_CUSTOMER_QUERY')) {
        this.router.navigate(['/projects', pId, 'customer-queries'], { replaceUrl: true });
        return;
      }
      this.projectId.set(pId);
      this.stepIdentifier.set(sId);
      this.loadData();
    });
  }

  protected loadData(): void {
    const pId = this.projectId();
    const sId = this.stepIdentifier();
    if (!pId) return;

    this.loading.set(true);

    // 1. Fetch Project
    this.projectService.getProjectById(pId).subscribe({
      next: (p) => {
        this.project.set(p);
        if (p.customer_id) {
          this.customerService.getCustomerById(p.customer_id).subscribe((c) => this.customer.set(c));
        }
        if (p.supplier_id) {
          this.supplierService.getSupplierById(p.supplier_id).subscribe((s) => this.supplier.set(s));
        }
      },
    });

    // 2. Fetch Steps & Resolve this Step
    this.projectStepService.getSteps(pId).subscribe({
      next: (steps) => {
        this.allSteps.set(steps);
        this.resolveCurrentStep(steps, sId);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private resolveCurrentStep(steps: ProjectStep[], stepIdentifier: string): void {
    let resolvedStep: ProjectStep | null = null;
    let resolvedDef: FormDefinition | undefined;

    // Check by numeric step id or step number
    const num = Number(stepIdentifier);
    if (!isNaN(num) && num > 0) {
      resolvedStep = steps.find((s) => s.id === num || s.step_number === num) ?? null;
      if (resolvedStep?.form_code) {
        resolvedDef = getFormDefinition(resolvedStep.form_code);
      } else if (LEGACY_STEP_TO_FORM_CODE[num]) {
        resolvedDef = getFormDefinition(LEGACY_STEP_TO_FORM_CODE[num]);
      }
    } else if (stepIdentifier) {
      // By form code string (e.g. FORM_01_PQB or BILL_OF_ENTRY)
      resolvedStep = steps.find((s) => s.form_code === stepIdentifier) ?? null;
      resolvedDef = getFormDefinition(stepIdentifier);
    }

    const finalDef: FormDefinition = resolvedDef ?? FORM_CATALOG[0]!;

    if (!resolvedStep) {
      resolvedStep = {
        id: num || Date.now(),
        project_id: this.projectId(),
        step_number: steps.length + 1,
        step_name: finalDef.name,
        description: finalDef.description,
        status: 'in_progress',
        progress_percentage: 0,
        completed_at: null,
        form_code: finalDef.formCode,
        category: finalDef.category,
        phase: finalDef.phaseId,
        data: {},
        remarks: [],
      };
    }

    this.currentStep.set(resolvedStep);
    this.stepRemarks.set(resolvedStep.remarks || []);
    this.formDefinition.set(finalDef);
    this.buildDynamicForm(finalDef, resolvedStep.data ?? {});
  }

  protected onAddRemark(text: string): void {
    const newRmk: ProjectStepRemark = {
      id: Date.now(),
      project_id: this.projectId(),
      remark: text,
      user: 'Team Member',
      created_at: new Date().toISOString(),
    };
    this.stepRemarks.update((rmks) => [...rmks, newRmk]);
  }

  private buildDynamicForm(def: FormDefinition, savedData: Record<string, unknown>): void {
    const controls: Record<string, FormControl> = {};

    for (const field of def.fields) {
      let initialValue = savedData[field.key];
      if (initialValue === undefined || initialValue === null) {
        initialValue = this.getDefaultFieldValue(field);
      }
      if (field.type === 'multilocation') {
        if (Array.isArray(initialValue)) {
          initialValue = initialValue.map((v) => String(v).trim()).filter(Boolean);
        } else if (typeof initialValue === 'string' && initialValue.trim()) {
          initialValue = initialValue.split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          initialValue = [];
        }
      } else if (field.type === 'select' && field.options && typeof initialValue === 'string' && initialValue.trim()) {
        const strVal = initialValue.toLowerCase();
        const match = field.options.find(
          (opt) => typeof opt === 'object' && opt !== null && opt.label.toLowerCase() === strVal,
        );
        if (match && typeof match === 'object') {
          initialValue = match.value;
        }
      } else if (field.type === 'date') {
        initialValue = initialValue ? parseLocalDate(initialValue as string | Date) : null;
      } else if (field.type === 'datetime') {
        initialValue = initialValue ? parseLocalDateTime(initialValue as string | Date) : null;
      }
      const validators = field.required ? [Validators.required] : [];
      controls[field.key] = new FormControl(initialValue, validators);
    }

    const group = new FormGroup(controls);
    this.formGroup.set(group);
    this.isFormInvalid?.set?.(group.invalid);
    this.formStatusSub?.unsubscribe();
    this.formStatusSub = group.valueChanges?.subscribe?.(() => {
      this.isFormInvalid?.set?.(group.invalid);
      this.formVersion.update((v) => v + 1);
    });

    // Build Table FormArray if configured
    if (def.tableConfig) {
      const rowsArray = new FormArray<FormGroup>([]);
      const rawRows =
        savedData['items'] ??
        savedData['table_items'] ??
        savedData['materials'] ??
        savedData['requirements'] ??
        savedData['query_items'] ??
        savedData['customer_query_items'] ??
        (Array.isArray((savedData as Record<string, unknown>)['items']) ? savedData['items'] : undefined);
      const savedRows = Array.isArray(rawRows)
        ? (rawRows as Array<Record<string, unknown>>)
            .filter((r) => !isTableRowEmpty(r))
            .map(normalizeTableRow)
        : [];

      for (const row of savedRows) {
        rowsArray.push(this.createTableRowGroup(def, row));
      }
      this.tableFormArray.set(rowsArray);
    } else {
      this.tableFormArray.set(new FormArray<FormGroup>([]));
    }
  }

  private getDefaultFieldValue(field: FormFieldDefinition): unknown {
    if (field.type === 'number' || field.type === 'currency') return null;
    if (field.type === 'date' || field.type === 'datetime') return null;
    if (field.type === 'multilocation') return [];
    return '';
  }

  // ── Select and Location Field Helpers ──────────────────────────────
  getSelectOptions(field: FormFieldDefinition): SelectOption<string>[] {
    if (!field.options) return [];
    return field.options.map((opt) =>
      typeof opt === 'string' ? { label: opt, value: opt } : opt,
    );
  }

  getLocations(fieldKey: string): string[] {
    const val = this.formGroup()?.get(fieldKey)?.value;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim()) {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }

  addLocation(fieldKey: string, inputElement: HTMLInputElement): void {
    const raw = inputElement.value.trim();
    if (!raw) return;

    const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const current = this.getLocations(fieldKey);
    const next = [...current];

    for (const item of items) {
      if (!next.includes(item)) {
        next.push(item);
      }
    }

    const control = this.formGroup()?.get(fieldKey);
    if (control) {
      control.setValue(next);
      control.markAsDirty();
    }
    inputElement.value = '';
  }

  removeLocation(fieldKey: string, index: number): void {
    const current = this.getLocations(fieldKey);
    const next = current.filter((_, i) => i !== index);
    const control = this.formGroup()?.get(fieldKey);
    if (control) {
      control.setValue(next);
      control.markAsDirty();
    }
  }

  onLocationInputKeydown(event: KeyboardEvent, fieldKey: string, inputElement: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addLocation(fieldKey, inputElement);
    }
  }

  private createTableRowGroup(def: FormDefinition, initialData: Record<string, unknown> = {}): FormGroup {
    const rowControls: Record<string, FormControl> = {};
    if (!def.tableConfig) return new FormGroup({});

    for (const col of def.tableConfig.columns) {
      let val = getTableRowCellValue(initialData, col.key);
      if (val === undefined || val === null) {
        val = col.key === 'sr_no' ? this.tableFormArray().length + 1 : '';
      }
      if (col.type === 'date' && val) {
        val = formatLocalDate(val as Date | string);
      }
      rowControls[col.key] = new FormControl(val);
    }

    if (initialData['id'] !== undefined && initialData['id'] !== null) {
      rowControls['id'] = new FormControl(initialData['id']);
    }

    return new FormGroup(rowControls);
  }

  protected addTableRow(): void {
    const def = this.formDefinition();
    if (!def || !def.tableConfig) return;
    const nextSr = this.tableFormArray().length + 1;
    this.tableFormArray().push(this.createTableRowGroup(def, { sr_no: nextSr }));
    this.tableVersion?.update?.((v) => v + 1);
  }

  protected removeTableRow(index: number): void {
    if (this.tableFormArray().length > 0) {
      this.tableFormArray().removeAt(index);
      // Re-sequence remaining row sr_no
      this.tableFormArray().controls.forEach((group, idx) => {
        group.get('sr_no')?.setValue(idx + 1);
      });
      this.tableVersion?.update?.((v) => v + 1);
    }
  }

  protected onTableCellChange(rowIndex: number): void {
    const def = this.formDefinition();
    if (!def || !def.tableConfig || !def.tableConfig.autoCalculateTotal) return;

    const row = this.tableFormArray().at(rowIndex) as FormGroup;
    const qKey = def.tableConfig.quantityKey || 'quantity';
    const pKey = def.tableConfig.unitPriceKey || 'unit_price';
    const tKey = def.tableConfig.totalKey || 'total_amount';

    const qty = Number(row.get(qKey)?.value) || 0;
    const price = Number(row.get(pKey)?.value) || 0;

    if (qty >= 0 && price >= 0) {
      const total = qty * price;
      row.patchValue({ [tKey]: total }, { emitEvent: false });
    }
    this.tableVersion.update((v) => v + 1);

    if (this.hasTableGst() && this.formGroup()?.get('gst_amount')) {
      this.formGroup().patchValue({ gst_amount: this.tableGstAmount() }, { emitEvent: false });
    }
  }

  // ── File Upload Handling (Customer Query Aligned) ──────────────────
  protected onFilesSelected(event: Event, uploadKey: string = 'main'): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        this.uploadedFiles.update((files) => [
          ...files,
          {
            name: file.name,
            size: this.formatFileSize(file.size),
            uploadKey,
          },
        ]);
      }
      this.messageService.add({
        severity: 'success',
        summary: 'File Attached',
        detail: `Added ${input.files.length} document(s).`,
      });
      input.value = '';
    }
  }

  protected onFileUpload(event: Event, uploadKey: string = 'main'): void {
    this.onFilesSelected(event, uploadKey);
  }

  protected onDropFiles(event: DragEvent, uploadKey: string = 'main'): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const files = event.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.uploadedFiles.update((filesList) => [
          ...filesList,
          {
            name: file.name,
            size: this.formatFileSize(file.size),
            uploadKey,
          },
        ]);
      }
      this.messageService.add({
        severity: 'success',
        summary: 'File Attached',
        detail: `Added ${files.length} document(s).`,
      });
    }
  }

  protected getFilesForUpload(uploadKey: string): Array<{ name: string; size: string; uploadKey: string }> {
    const def = this.formDefinition();
    if (!def || !def.uploads || def.uploads.length <= 1) {
      return this.uploadedFiles();
    }
    return this.uploadedFiles().filter(
      (f) => f.uploadKey === uploadKey || (!f.uploadKey && uploadKey === def.uploads[0]?.key),
    );
  }

  protected removeUploadedFileByRef(target: { name: string; size: string; uploadKey: string }): void {
    this.uploadedFiles.update((files) => files.filter((f) => f !== target));
  }

  protected removeUploadedFile(index: number): void {
    this.uploadedFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  protected getFileIcon(fileName?: string): string {
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

  protected saveStep(): void {
    const pId = this.projectId();
    const cur = this.currentStep();
    if (!pId || !cur) return;

    if (this.formGroup()?.invalid) {
      this.formGroup()?.markAllAsTouched?.();
      this.isFormInvalid.set(true);
      this.messageService.add({
        severity: 'warn',
        summary: 'Required Fields Missing',
        detail: 'Please fill in all required fields before saving.',
      });
      return;
    }

    this.saving.set(true);

    const rawFormData: Record<string, unknown> = { ...this.formGroup().value };
    const def = this.formDefinition();
    if (def) {
      for (const field of def.fields) {
        if (field.type === 'multilocation') {
          const val = rawFormData[field.key];
          if (Array.isArray(val)) {
            rawFormData[field.key] = val.join(', ');
          }
        }
      }
    }
    const rawTableData = (this.tableFormArray().value || []) as Array<Record<string, unknown>>;
    const cleanedTableData = cleanTableItems(rawTableData);

    const sanitizedPayload = sanitizePayloadDates(
      {
        ...rawFormData,
        items: cleanedTableData,
      },
      def?.fields,
      def?.tableConfig?.columns,
    );

    const { items: sanitizedItems, ...sanitizedFormData } = sanitizedPayload;

    const combinedData: Record<string, unknown> = {
      ...sanitizedFormData,
      items: (sanitizedItems ?? cleanedTableData) as unknown[],
      attachments_count: this.uploadedFiles().length,
      form_code: cur.form_code,
    };

    if (def?.tableConfig?.autoCalculateTotal) {
      const net =
        typeof this.tableNetAmount === 'function'
          ? this.tableNetAmount()
          : typeof this.tableTotalSum === 'function'
            ? this.tableTotalSum()
            : 0;
      combinedData['total_net_amount'] = net;
      if (typeof this.hasTableGst === 'function' && this.hasTableGst()) {
        const gross = typeof this.tableGrossTotalSum === 'function' ? this.tableGrossTotalSum() : net;
        const gstAmt = typeof this.tableGstAmount === 'function' ? this.tableGstAmount() : 0;
        combinedData['total_gross_amount'] = gross;
        combinedData['gst_amount'] = gstAmt;
        combinedData['total_amount'] = gross;
      } else {
        combinedData['total_gross_amount'] = net;
        combinedData['total_amount'] = net;
      }
    }

    const status: StepStatus = 'completed';
    const progress = 100;

    const stepId = cur.id || cur.step_number;

    this.projectStepService.updateStep(pId, stepId, combinedData, status, progress).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.currentStep.set(updated);
        this.messageService.add({
          severity: 'success',
          summary: 'Step Saved',
          detail: `${cur.step_name} has been saved successfully.`,
        });
      },
      error: () => {
        this.saving.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Save Failed',
          detail: 'Could not save step data. Please try again.',
        });
      },
    });
  }

  protected goBackToTimeline(): void {
    this.router.navigate(['/projects', this.projectId(), 'steps']);
  }

  protected openAddStepModal(): void {
    this.catalogModalVisible.set(true);
  }

  protected onSelectCatalogForm(form: FormDefinition): void {
    const pId = this.projectId();
    if (!pId) return;

    this.projectStepService.addStep(pId, form.formCode, form.name).subscribe({
      next: (newStep) => {
        this.catalogModalVisible.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Step Added',
          detail: `Added ${form.name} to the project.`,
        });
        // Navigate to the newly added step
        this.router.navigate(['/projects', pId, 'step-form', newStep.id || newStep.form_code]);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to add step.',
        });
      },
    });
  }
}
