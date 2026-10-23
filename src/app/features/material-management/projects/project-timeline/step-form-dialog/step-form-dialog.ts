import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ProjectStep, ProjectStepRemark, StepStatus } from '../../../../../core/models/project-step.model';
import { FormApiService } from '../../../../../core/services/form-api';
import {
  FormDefinition,
  FormFieldDefinition,
  getFormDefinition,
  FORM_CATALOG,
} from '../../../../../core/constants/form-catalog';
import { SelectOption } from '../../../../../core/constants/dropdown-options.constant';
import { getCurrentUserFromStorage } from '../../../../../core/utils/remark.utils';

@Component({
  selector: 'app-step-form-dialog',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    SelectModule,
    TableModule,
    TooltipModule,
    DecimalPipe,
    DatePipe,
  ],
  templateUrl: './step-form-dialog.html',
  styleUrl: './step-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepFormDialog {
  private readonly formApiService = inject(FormApiService);
  private readonly messageService = inject(MessageService);

  // ── Inputs & Two-Way Model ──────────────────────────────────────────
  readonly visible = model<boolean>(false);
  readonly projectId = input.required<number>();
  readonly step = input<ProjectStep | null>(null);
  readonly formDefinition = input<FormDefinition | null>(null);
  readonly projectCode = input<string>('');
  readonly projectTitle = input<string>('');
  readonly customerName = input<string>('');
  readonly supplierName = input<string>('');

  // ── Outputs ─────────────────────────────────────────────────────────
  readonly stepSaved = output<ProjectStep>();
  readonly stepDeleted = output<number>();

  // ── Component State ─────────────────────────────────────────────────
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly deleting = signal<boolean>(false);
  readonly deleteConfirmVisible = signal<boolean>(false);

  readonly resolvedDef = signal<FormDefinition | null>(null);
  readonly formGroup = signal<FormGroup>(new FormGroup({}));
  readonly tableFormArray = signal<FormArray<FormGroup>>(new FormArray<FormGroup>([]));
  readonly uploadedFiles = signal<
    Array<{ name: string; size: string; uploadKey: string; fileRef?: File }>
  >([]);
  readonly stepRemarks = signal<ProjectStepRemark[]>([]);
  readonly newRemarkInput = signal<string>('');

  // ── Active Navigation Tab in Popup ──────────────────────────────────
  readonly activeTab = signal<'fields' | 'table' | 'uploads' | 'remarks'>('fields');

  // ── Derived Signals ─────────────────────────────────────────────────
  readonly isEditMode = computed(() => !!this.step());
  readonly currentUser = computed(() => getCurrentUserFromStorage());

  readonly modalTitle = computed(() => {
    const s = this.step();
    const def = this.resolvedDef();
    if (s) {
      return `Edit Step ${s.step_number}: ${s.step_name}`;
    }
    return def ? `Attach Form: ${def.name}` : 'Form Details';
  });

  readonly isStepCompleted = computed(() => {
    return this.step()?.status === 'completed';
  });

  readonly tableTotalSum = computed(() => {
    const arr = this.tableFormArray().value as Array<Record<string, unknown>>;
    const cfg = this.resolvedDef()?.tableConfig;
    if (!cfg || !cfg.totalKey) return 0;
    return arr.reduce((sum, row) => sum + (Number(row[cfg.totalKey!]) || 0), 0);
  });

  constructor() {
    // Synchronize form when dialog becomes visible or step/definition changes
    effect(() => {
      const isVis = this.visible();
      const currentStep = this.step();
      const defInput = this.formDefinition();

      if (isVis) {
        this.initializeModal(currentStep, defInput);
      } else {
        this.deleteConfirmVisible.set(false);
      }
    });
  }

  private initializeModal(step: ProjectStep | null, defInput: FormDefinition | null): void {
    this.activeTab.set('fields');
    this.newRemarkInput.set('');

    if (step) {
      // ── EDIT MODE (GET latest step data & prefill) ─────────────────
      let def: FormDefinition | undefined;
      if (step.form_code) {
        def = getFormDefinition(step.form_code);
      }
      if (!def) {
        def = FORM_CATALOG.find((f) => f.name.toLowerCase() === step.step_name.toLowerCase()) || FORM_CATALOG[0];
      }
      this.resolvedDef.set(def);

      const pId = this.projectId();
      const stepId = step.id || step.step_number;

      // GET operation to fetch freshest step state via individual form API
      this.loading.set(true);
      const fetch$ = def?.apiEndpoint
        ? this.formApiService.getEntryById(def, stepId, pId).pipe(catchError(() => of(step)))
        : of(step);

      fetch$.subscribe({
        next: (freshStep) => {
          this.loading.set(false);
          const activeStep = freshStep || step;
          const savedData = (activeStep.data as Record<string, unknown>) || {};
          this.populateForm(def!, savedData, activeStep.remarks || []);
        },
        error: () => {
          this.loading.set(false);
          const savedData = (step.data as Record<string, unknown>) || {};
          this.populateForm(def!, savedData, step.remarks || []);
        },
      });
    } else if (defInput) {
      // ── ADD MODE (POST new step from catalog) ──────────────────────
      this.resolvedDef.set(defInput);
      this.populateForm(defInput, {}, []);
    } else {
      const fallback = FORM_CATALOG[0];
      this.resolvedDef.set(fallback);
      this.populateForm(fallback, {}, []);
    }
  }

  private populateForm(
    def: FormDefinition,
    savedData: Record<string, unknown>,
    existingRemarks: ProjectStepRemark[],
  ): void {
    // 1. Dynamic Catalog Form Controls
    const controls: Record<string, FormControl> = {};
    for (const field of def.fields) {
      let initialVal = savedData[field.key];
      if (initialVal === undefined || initialVal === null) {
        initialVal = this.getDefaultFieldValue(field);
      }
      if (field.type === 'multilocation') {
        if (Array.isArray(initialVal)) {
          initialVal = initialVal.map((v) => String(v).trim()).filter(Boolean);
        } else if (typeof initialVal === 'string' && initialVal.trim()) {
          initialVal = initialVal.split(',').map((s) => s.trim()).filter(Boolean);
        } else {
          initialVal = [];
        }
      } else if (field.type === 'select' && field.options && typeof initialVal === 'string' && initialVal.trim()) {
        const strVal = initialVal.toLowerCase();
        const match = field.options.find(
          (opt) => typeof opt === 'object' && opt !== null && opt.label.toLowerCase() === strVal,
        );
        if (match && typeof match === 'object') {
          initialVal = match.value;
        }
      }
      const validators = field.required ? [Validators.required] : [];
      controls[field.key] = new FormControl(initialVal, validators);
    }
    this.formGroup.set(new FormGroup(controls));

    // 2. Line-Item Table Rows
    if (def.tableConfig) {
      const rowsArray = new FormArray<FormGroup>([]);
      const rawRows = savedData['items'] ?? savedData['table_items'];
      const savedRows = Array.isArray(rawRows)
        ? (rawRows as Array<Record<string, unknown>>)
        : [];

      if (savedRows.length > 0) {
        for (const row of savedRows) {
          rowsArray.push(this.createTableRowGroup(def, row));
        }
      } else {
        rowsArray.push(this.createTableRowGroup(def, { sr_no: 1 }));
      }
      this.tableFormArray.set(rowsArray);
    } else {
      this.tableFormArray.set(new FormArray<FormGroup>([]));
    }

    // 4. File Attachments
    const attachedCount = Number(savedData['attachments_count']) || 0;
    if (attachedCount > 0 && this.uploadedFiles().length === 0) {
      this.uploadedFiles.set([
        {
          name: `${def.formCode}_document.pdf`,
          size: '240 KB',
          uploadKey: (def.uploads && def.uploads[0]?.key) || 'main',
        },
      ]);
    } else if (!savedData['attachments_count']) {
      this.uploadedFiles.set([]);
    }

    // 5. Remarks (merge existing step remarks and data.remarks)
    const remarksList: ProjectStepRemark[] = [...(existingRemarks || [])];
    if (Array.isArray(savedData['remarks'])) {
      for (const r of savedData['remarks'] as unknown[]) {
        if (typeof r === 'string' && r.trim()) {
          const trimmed = r.trim();
          if (!remarksList.some((item) => item.remark === trimmed)) {
            remarksList.push({
              remark: trimmed,
              user: 'Form Entry',
              created_at: new Date().toISOString(),
            });
          }
        } else if (r && typeof r === 'object') {
          const rec = r as Record<string, unknown>;
          const text = String(rec['remark'] ?? rec['text'] ?? '').trim();
          if (text && !remarksList.some((item) => item.remark === text)) {
            remarksList.push({
              id: typeof rec['id'] === 'number' ? rec['id'] : undefined,
              remark: text,
              user: typeof rec['user'] === 'string' ? rec['user'] : 'Team Member',
              user_id: typeof rec['user_id'] === 'number' ? rec['user_id'] : undefined,
              created_at: typeof rec['created_at'] === 'string' ? rec['created_at'] : new Date().toISOString(),
            });
          }
        }
      }
    }
    this.stepRemarks.set(remarksList);
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
      const val = initialData[col.key] ?? (col.key === 'sr_no' ? this.tableFormArray().length + 1 : '');
      rowControls[col.key] = new FormControl(val);
    }

    return new FormGroup(rowControls);
  }

  // ── Table Column Layout Helpers ─────────────────────────────────────
  getColumnWidth(key: string, defaultWidth?: string): string {
    if (key === 'sr_no') return '56px';
    if (key === 'description') return '320px';
    if (key === 'hsn_sac') return '120px';
    if (key === 'unit') return '90px';
    if (key === 'quantity') return '110px';
    if (key === 'unit_price') return '130px';
    if (key === 'total_price' || key === 'total_amount') return '140px';
    if (key === 'delivery_date') return '150px';
    return defaultWidth || 'auto';
  }

  getColumnMinWidth(key: string): string {
    if (key === 'sr_no') return '50px';
    if (key === 'description') return '260px';
    if (key === 'hsn_sac') return '110px';
    if (key === 'unit') return '80px';
    if (key === 'quantity') return '100px';
    if (key === 'unit_price') return '120px';
    if (key === 'total_price' || key === 'total_amount') return '130px';
    if (key === 'delivery_date') return '140px';
    return '100px';
  }

  // ── Table Item Operations ───────────────────────────────────────────
  addTableRow(): void {
    const def = this.resolvedDef();
    if (!def || !def.tableConfig) return;
    const nextSr = this.tableFormArray().length + 1;
    this.tableFormArray().push(this.createTableRowGroup(def, { sr_no: nextSr }));
  }

  removeTableRow(index: number): void {
    if (this.tableFormArray().length > 1) {
      this.tableFormArray().removeAt(index);
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Cannot Remove',
        detail: 'At least one item row is required.',
      });
    }
  }

  onTableCellChange(rowIndex: number): void {
    const def = this.resolvedDef();
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

  // ── File Upload Handling (Customer Query Aligned) ──────────────────
  onFilesSelected(event: Event, uploadKey: string = 'main'): void {
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
            fileRef: file,
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

  onFileUpload(event: Event, uploadKey: string = 'main'): void {
    this.onFilesSelected(event, uploadKey);
  }

  onDropFiles(event: DragEvent, uploadKey: string = 'main'): void {
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
            fileRef: file,
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

  getFilesForUpload(uploadKey: string): Array<{ name: string; size: string; uploadKey: string }> {
    const def = this.resolvedDef();
    if (!def || !def.uploads || def.uploads.length <= 1) {
      return this.uploadedFiles();
    }
    return this.uploadedFiles().filter(
      (f) => f.uploadKey === uploadKey || (!f.uploadKey && uploadKey === def.uploads[0]?.key),
    );
  }

  removeUploadedFileByRef(target: { name: string; size: string; uploadKey: string }): void {
    this.uploadedFiles.update((files) => files.filter((f) => f !== target));
  }

  removeUploadedFile(index: number): void {
    this.uploadedFiles.update((files) => files.filter((_, i) => i !== index));
  }

  formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

  // ── Step Remarks Support ──────────────────────────────────────────
  addRemark(): void {
    const text = this.newRemarkInput().trim();
    if (!text) return;

    const session = getCurrentUserFromStorage();
    const userName = session?.user || 'Team Member';
    const userId = session?.user_id;

    const newRmk: ProjectStepRemark = {
      id: Date.now(),
      project_id: this.projectId(),
      remark: text,
      user: userName,
      user_id: userId,
      created_at: new Date().toISOString(),
    };

    this.stepRemarks.update((rmks) => [...rmks, newRmk]);
    this.newRemarkInput.set('');
  }

  removeRemark(index: number): void {
    this.stepRemarks.update((rmks) => rmks.filter((_, i) => i !== index));
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

  // ── POST / PUT: SAVE STEP DATA ──────────────────────────────────────
  saveStep(markAsCompleted: boolean = false): void {
    const pId = this.projectId();
    const def = this.resolvedDef();
    if (!pId || !def) return;

    this.saving.set(true);

    const formData: Record<string, unknown> = { ...this.formGroup().value };
    // Format multilocation fields to comma-separated string for backend compatibility
    for (const field of def.fields) {
      if (field.type === 'multilocation') {
        const val = formData[field.key];
        if (Array.isArray(val)) {
          formData[field.key] = val.join(', ');
        }
      }
    }

    const tableData = this.tableFormArray().value;

    const combinedData: Record<string, unknown> = {
      ...formData,
      items: tableData,
      attachments_count: this.uploadedFiles().length,
      form_code: def.formCode,
      remarks: this.stepRemarks().map((r) => r.remark),
    };

    const status: StepStatus = markAsCompleted ? 'completed' : 'in_progress';
    const progress = markAsCompleted ? 100 : 50;

    const existingStep = this.step();
    const rawFiles = this.uploadedFiles()
      .map((f) => f.fileRef)
      .filter((f): f is File => !!f);

    if (existingStep) {
      // ── PUT/PATCH OPERATION: Update existing step via FormApiService ─
      const stepId = existingStep.id || existingStep.step_number;
      this.formApiService
        .updateEntry(def, pId, stepId, combinedData, rawFiles)
        .subscribe({
          next: (updatedStep) => {
            this.saving.set(false);
            this.messageService.add({
              severity: markAsCompleted ? 'success' : 'info',
              summary: markAsCompleted ? 'Step Completed!' : 'Draft Saved',
              detail: `${updatedStep.step_name} has been updated successfully.`,
            });
            this.stepSaved.emit(updatedStep);
            this.close();
          },
          error: () => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Save Failed',
              detail: 'Could not update step data. Please try again.',
            });
          },
        });
    } else {
      // ── POST OPERATION: Create new entry via FormApiService ─────────
      this.formApiService
        .createEntry(def, pId, combinedData, rawFiles)
        .subscribe({
          next: (newStep) => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'success',
              summary: markAsCompleted ? 'Step Created & Completed!' : 'Form Attached!',
              detail: `${def.name} has been added to the project pipeline.`,
            });
            this.stepSaved.emit(newStep);
            this.close();
          },
          error: () => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Creation Failed',
              detail: 'Could not attach step. Please try again.',
            });
          },
        });
    }
  }

  // ── DELETE OPERATION: Remove Step from Pipeline ─────────────────────
  promptDelete(): void {
    this.deleteConfirmVisible.set(true);
  }

  cancelDelete(): void {
    this.deleteConfirmVisible.set(false);
  }

  confirmDelete(): void {
    const pId = this.projectId();
    const existingStep = this.step();
    if (!pId || !existingStep) return;

    this.deleting.set(true);
    const stepId = existingStep.id || existingStep.step_number;
    const def = this.resolvedDef();

    const delete$ = def
      ? this.formApiService.deleteEntry(def, pId, stepId)
      : of(false);

    delete$.subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteConfirmVisible.set(false);
        this.messageService.add({
          severity: 'info',
          summary: 'Step Removed',
          detail: `${existingStep.step_name} was removed from the project.`,
        });
        this.stepDeleted.emit(stepId);
        this.close();
      },
      error: () => {
        this.deleting.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Delete Failed',
          detail: 'Could not remove step. Please try again.',
        });
      },
    });
  }

  close(): void {
    this.visible.set(false);
  }
}
