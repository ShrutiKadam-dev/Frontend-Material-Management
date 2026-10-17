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
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';

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
  FormCategory,
  FormDefinition,
  FormFieldDefinition,
  getFormDefinition,
  LEGACY_STEP_TO_FORM_CODE,
} from '../../../core/constants/form-catalog';
import { StepRemarksComponent } from '../../../shared/components/step-remarks/step-remarks';

@Component({
  selector: 'app-dynamic-step-form',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    SelectModule,
    TableModule,
    TooltipModule,
    DialogModule,
    StepRemarksComponent,
    DecimalPipe,
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

  // ── Form Definition & Structure ───────────────────────────────────
  protected readonly formDefinition = signal<FormDefinition | null>(null);
  protected readonly formGroup = signal<FormGroup>(new FormGroup({}));
  protected readonly tableFormArray = signal<FormArray<FormGroup>>(new FormArray<FormGroup>([]));

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
    return this.allCatalogForms.filter((f) => {
      const matchCat = cat === 'All' || f.category === cat;
      const matchQuery =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.formCode.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  });

  protected readonly tableTotalSum = computed(() => {
    const arr = this.tableFormArray().value as Array<Record<string, unknown>>;
    const cfg = this.formDefinition()?.tableConfig;
    if (!cfg || !cfg.totalKey) return 0;
    return arr.reduce((sum, row) => sum + (Number(row[cfg.totalKey!]) || 0), 0);
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const pId = Number(params.get('projectId'));
      const sId = params.get('stepId') || params.get('formCode') || '';
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

    // Default to first form in catalog if unresolved
    if (!resolvedDef) {
      resolvedDef = FORM_CATALOG[0];
    }

    if (!resolvedStep) {
      resolvedStep = {
        id: num || Date.now(),
        project_id: this.projectId(),
        step_number: steps.length + 1,
        step_name: resolvedDef.name,
        description: resolvedDef.description,
        status: 'in_progress',
        progress_percentage: 0,
        completed_at: null,
        form_code: resolvedDef.formCode,
        category: resolvedDef.category,
        phase: resolvedDef.phaseId,
        data: {},
        remarks: [],
      };
    }

    this.currentStep.set(resolvedStep);
    this.stepRemarks.set(resolvedStep.remarks || []);
    this.formDefinition.set(resolvedDef);
    this.buildDynamicForm(resolvedDef, resolvedStep.data ?? {});
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
      const initialValue = savedData[field.key] ?? (this.getDefaultFieldValue(field));
      const validators = field.required ? [Validators.required] : [];
      controls[field.key] = new FormControl(initialValue, validators);
    }

    const group = new FormGroup(controls);
    this.formGroup.set(group);

    // Build Table FormArray if configured
    if (def.tableConfig) {
      const rowsArray = new FormArray<FormGroup>([]);
      const savedRows = Array.isArray(savedData['table_items'])
        ? (savedData['table_items'] as Array<Record<string, unknown>>)
        : [];

      if (savedRows.length > 0) {
        for (const row of savedRows) {
          rowsArray.push(this.createTableRowGroup(def, row));
        }
      } else {
        // Start with 1 default blank row
        rowsArray.push(this.createTableRowGroup(def, { sr_no: 1 }));
      }
      this.tableFormArray.set(rowsArray);
    } else {
      this.tableFormArray.set(new FormArray<FormGroup>([]));
    }
  }

  private getDefaultFieldValue(field: FormFieldDefinition): unknown {
    if (field.type === 'number' || field.type === 'currency') return null;
    if (field.type === 'date') return null;
    return '';
  }

  private createTableRowGroup(def: FormDefinition, initialData: Record<string, unknown> = {}): FormGroup {
    const rowControls: Record<string, FormControl> = {};
    if (!def.tableConfig) return new FormGroup({});

    for (const col of def.tableConfig.columns) {
      const val = initialData[col.key] ?? (col.key === 'sr_no' ? this.tableFormArray().length + 1 : '');
      rowControls[col.key] = new FormControl(val);
    }

    return new FormGroup(rowControls);
  }

  protected addTableRow(): void {
    const def = this.formDefinition();
    if (!def || !def.tableConfig) return;
    const nextSr = this.tableFormArray().length + 1;
    this.tableFormArray().push(this.createTableRowGroup(def, { sr_no: nextSr }));
  }

  protected removeTableRow(index: number): void {
    if (this.tableFormArray().length > 1) {
      this.tableFormArray().removeAt(index);
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot Remove',
        detail: 'At least one row is required in the table.',
      });
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
  }

  protected onFileUpload(event: Event, uploadKey: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        this.uploadedFiles.update((files) => [
          ...files,
          {
            name: file.name,
            size: `${(file.size / 1024).toFixed(1)} KB`,
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

  protected removeUploadedFile(index: number): void {
    this.uploadedFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected saveStep(markAsCompleted: boolean = false): void {
    const pId = this.projectId();
    const cur = this.currentStep();
    if (!pId || !cur) return;

    this.saving.set(true);

    const formData = this.formGroup().value;
    const tableData = this.tableFormArray().value;

    const combinedData: Record<string, unknown> = {
      ...formData,
      table_items: tableData,
      attachments_count: this.uploadedFiles().length,
      form_code: cur.form_code,
    };

    const status: StepStatus = markAsCompleted ? 'completed' : 'in_progress';
    const progress = markAsCompleted ? 100 : 60;

    const stepId = cur.id || cur.step_number;

    this.projectStepService.updateStep(pId, stepId, combinedData, status, progress).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.currentStep.set(updated);
        this.messageService.add({
          severity: markAsCompleted ? 'success' : 'info',
          summary: markAsCompleted ? 'Step Completed!' : 'Draft Saved',
          detail: markAsCompleted
            ? `${cur.step_name} is marked as completed.`
            : 'Changes saved successfully.',
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
