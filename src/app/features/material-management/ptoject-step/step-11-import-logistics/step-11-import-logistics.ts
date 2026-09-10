import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { ImportLogisticsService } from '../../../../core/services/import-logistics';
import { BillOfEntryService } from '../../../../core/services/bill-of-entry';
import { CustomerService } from '../../../../core/services/customer';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  ImportLogistics,
  ImportLogisticsCreateInput,
  ImportLogisticsUpdateInput,
  LogisticType,
} from '../../../../core/models/import-logistics.model';
import {
  BillOfEntry,
  BillOfEntryCreateInput,
  BillOfEntryUpdateInput,
} from '../../../../core/models/bill-of-entry.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';
import { LOGISTIC_TYPE_OPTIONS } from '../../../../core/constants/dropdown-options.constant';

export type Step11Tab = 'logistics' | 'bill-of-entry';

@Component({
  selector: 'app-step-11-import-logistics',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    SelectModule,
    TooltipModule,
    TableModule,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './step-11-import-logistics.html',
  styleUrl: './step-11-import-logistics.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step11ImportLogistics implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly logisticsService = inject(ImportLogisticsService);
  private readonly boeService = inject(BillOfEntryService);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly attachmentService = inject(AttachmentService);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly activeTab = signal<Step11Tab>('logistics');
  protected readonly projectId = signal<number | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);

  protected readonly importLogistics = signal<ImportLogistics[]>([]);
  protected readonly billsOfEntry = signal<BillOfEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly downloadingAttachmentId = signal<number | null>(null);

  // ── Dialog States ──────────────────────────────────────────────
  protected readonly logisticsDialogVisible = signal(false);
  protected readonly editingLogistics = signal<ImportLogistics | null>(null);
  protected readonly selectedLogisticsFiles = signal<File[]>([]);
  protected readonly existingLogisticsAttachments = signal<Attachment[]>([]);

  protected readonly boeDialogVisible = signal(false);
  protected readonly editingBoe = signal<BillOfEntry | null>(null);
  protected readonly selectedBoeFiles = signal<File[]>([]);
  protected readonly existingBoeAttachments = signal<Attachment[]>([]);

  // ── Options ────────────────────────────────────────────────────
  protected readonly logisticTypeOptions = LOGISTIC_TYPE_OPTIONS;

  // ── Reactive Forms ─────────────────────────────────────────────
  protected readonly logisticsForm = this.fb.group({
    logistic_type: ['air' as LogisticType, [Validators.required]],
    // Air Freight Fields
    airway_bill_no: [''],
    flight_name: [''],
    flight_no: [''],
    airport_of_loading: [''],
    // Sea Freight Fields
    bill_of_lading_no: [''],
    vessel_name: [''],
    voyage_no: [''],
    port_of_loading: [''],
    // Common Fields
    date: [null as Date | string | null, [Validators.required]],
    port_of_discharge: ['', [Validators.required]],
    remark: [''],
  });

  protected readonly boeForm = this.fb.group({
    bill_of_entry_no: ['', [Validators.required]],
    date: [null as Date | string | null, [Validators.required]],
    total_assessable_value: [0, [Validators.required, Validators.min(0)]],
    bcd: [0, [Validators.min(0)]],
    sws: [0, [Validators.min(0)]],
    igst: [0, [Validators.min(0)]],
    remark: [''],
  });

  // ── Computed Live Values ────────────────────────────────────────
  protected readonly currentLogisticType = signal<LogisticType>('air');
  protected readonly boeLiveTotalDuty = signal<number>(0);

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('projectId');
    const id = rawId ? Number(rawId) : null;
    if (!id || isNaN(id)) {
      this.errorMessage.set('Invalid Project ID.');
      this.loading.set(false);
      return;
    }

    this.projectId.set(id);

    // Watch logistics type changes to toggle validation
    this.logisticsForm.get('logistic_type')?.valueChanges.subscribe((type) => {
      this.currentLogisticType.set(type as LogisticType);
      this.updateLogisticsValidators(type as LogisticType);
    });

    // Watch BOE form changes for instant live duty calculation
    this.boeForm.valueChanges.subscribe((val) => {
      const bcd = Number(val.bcd) || 0;
      const sws = Number(val.sws) || 0;
      const igst = Number(val.igst) || 0;
      this.boeLiveTotalDuty.set(bcd + sws + igst);
    });

    this.loadProject(id);
    this.loadData(id);
  }

  protected selectTab(tab: Step11Tab): void {
    this.activeTab.set(tab);
  }

  protected goBack(): void {
    const pId = this.projectId();
    if (pId) {
      this.router.navigate(['/projects', pId, 'steps']);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  // ── Data Loading ───────────────────────────────────────────────
  private loadProject(id: number): void {
    this.projectService.getProjectById(id).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj.customer_id) {
          this.customerService.getCustomerById(proj.customer_id).subscribe({
            next: (cust) => this.customer.set(cust),
            error: () => { },
          });
        }
      },
      error: () => { },
    });
  }

  private loadData(id: number): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.logisticsService
      .getByProject(id)
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe({
        next: (logistics) => this.importLogistics.set(logistics),
        error: (err) => console.error('Failed to load import logistics', err),
      });

    this.boeService.getByProject(id).subscribe({
      next: (boes) => this.billsOfEntry.set(boes),
      error: (err) => console.error('Failed to load bills of entry', err),
    });
  }

  // ── Sub-Step 1: Import Logistics CRUD ─────────────────────────
  protected openCreateLogisticsDialog(): void {
    this.editingLogistics.set(null);
    this.selectedLogisticsFiles.set([]);
    this.existingLogisticsAttachments.set([]);
    this.errorMessage.set(null);

    this.logisticsForm.reset({
      logistic_type: 'air',
      airway_bill_no: '',
      flight_name: '',
      flight_no: '',
      airport_of_loading: '',
      bill_of_lading_no: '',
      vessel_name: '',
      voyage_no: '',
      port_of_loading: '',
      date: '',
      port_of_discharge: '',
      remark: '',
    });
    this.currentLogisticType.set('air');
    this.updateLogisticsValidators('air');

    this.logisticsDialogVisible.set(true);
  }

  protected openEditLogisticsDialog(item: ImportLogistics): void {
    this.editingLogistics.set(item);
    this.selectedLogisticsFiles.set([]);
    this.existingLogisticsAttachments.set(item.attachments || []);
    this.errorMessage.set(null);

    const type = item.logistic_type || 'air';
    this.currentLogisticType.set(type);

    this.logisticsForm.patchValue({
      logistic_type: type,
      airway_bill_no: item.airway_bill_no || '',
      flight_name: item.flight_name || '',
      flight_no: item.flight_no || '',
      airport_of_loading: item.airport_of_loading || '',
      bill_of_lading_no: item.bill_of_lading_no || '',
      vessel_name: item.vessel_name || '',
      voyage_no: item.voyage_no || '',
      port_of_loading: item.port_of_loading || '',
      date: this.parseDate(item.date),
      port_of_discharge: item.port_of_discharge || '',
      remark: item.remark || '',
    });

    this.updateLogisticsValidators(type);
    this.logisticsDialogVisible.set(true);
  }

  protected closeLogisticsDialog(): void {
    this.logisticsDialogVisible.set(false);
    this.editingLogistics.set(null);
    this.selectedLogisticsFiles.set([]);
    this.existingLogisticsAttachments.set([]);
  }

  private updateLogisticsValidators(type: LogisticType): void {
    const airwayCtrl = this.logisticsForm.get('airway_bill_no');
    const flightNameCtrl = this.logisticsForm.get('flight_name');
    const flightNoCtrl = this.logisticsForm.get('flight_no');
    const airportLoadingCtrl = this.logisticsForm.get('airport_of_loading');

    const blCtrl = this.logisticsForm.get('bill_of_lading_no');
    const vesselCtrl = this.logisticsForm.get('vessel_name');
    const voyageCtrl = this.logisticsForm.get('voyage_no');
    const portLoadingCtrl = this.logisticsForm.get('port_of_loading');

    if (type === 'air') {
      airwayCtrl?.setValidators([Validators.required]);
      flightNameCtrl?.setValidators([Validators.required]);
      flightNoCtrl?.setValidators([Validators.required]);
      airportLoadingCtrl?.setValidators([Validators.required]);

      blCtrl?.clearValidators();
      vesselCtrl?.clearValidators();
      voyageCtrl?.clearValidators();
      portLoadingCtrl?.clearValidators();
    } else {
      blCtrl?.setValidators([Validators.required]);
      vesselCtrl?.setValidators([Validators.required]);
      voyageCtrl?.setValidators([Validators.required]);
      portLoadingCtrl?.setValidators([Validators.required]);

      airwayCtrl?.clearValidators();
      flightNameCtrl?.clearValidators();
      flightNoCtrl?.clearValidators();
      airportLoadingCtrl?.clearValidators();
    }

    airwayCtrl?.updateValueAndValidity();
    flightNameCtrl?.updateValueAndValidity();
    flightNoCtrl?.updateValueAndValidity();
    airportLoadingCtrl?.updateValueAndValidity();
    blCtrl?.updateValueAndValidity();
    vesselCtrl?.updateValueAndValidity();
    voyageCtrl?.updateValueAndValidity();
    portLoadingCtrl?.updateValueAndValidity();
  }

  protected submitLogistics(): void {
    if (this.saving()) return;
    if (this.logisticsForm.invalid) {
      this.logisticsForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const formVal = this.logisticsForm.getRawValue();
    const type = formVal.logistic_type as LogisticType;
    const dateStr = formVal.date
      ? formVal.date instanceof Date
        ? this.formatDate(formVal.date)
        : String(formVal.date)
      : '';

    const payload: ImportLogisticsCreateInput = {
      project_id: pId,
      logistic_type: type,
      date: dateStr,
      port_of_discharge: formVal.port_of_discharge,
      remark: formVal.remark || undefined,
      ...(type === 'air'
        ? {
          airway_bill_no: formVal.airway_bill_no,
          flight_name: formVal.flight_name,
          flight_no: formVal.flight_no,
          airport_of_loading: formVal.airport_of_loading,
        }
        : {
          bill_of_lading_no: formVal.bill_of_lading_no,
          vessel_name: formVal.vessel_name,
          voyage_no: formVal.voyage_no,
          port_of_loading: formVal.port_of_loading,
        }),
    };

    const files = this.selectedLogisticsFiles();
    const editing = this.editingLogistics();

    if (editing) {
      this.logisticsService
        .update(editing.id, payload as ImportLogisticsUpdateInput, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.closeLogisticsDialog();
            this.loadData(pId);
          },
          error: (err) => {
            console.error('Failed to update import logistics', err);
            this.errorMessage.set('Failed to update import logistics record.');
          },
        });
    } else {
      this.logisticsService
        .create(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.closeLogisticsDialog();
            this.loadData(pId);
          },
          error: (err) => {
            console.error('Failed to create import logistics', err);
            this.errorMessage.set('Failed to save import logistics record.');
          },
        });
    }
  }

  protected deleteLogistics(item: ImportLogistics): void {
    if (
      !confirm(
        `Are you sure you want to delete this ${item.logistic_type === 'air' ? 'Air Freight (AWB: ' + item.airway_bill_no + ')' : 'Sea Freight (BL: ' + item.bill_of_lading_no + ')'} record?`,
      )
    ) {
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.logisticsService.delete(item.id).subscribe({
      next: () => this.loadData(pId),
      error: (err) => console.error('Failed to delete import logistics', err),
    });
  }

  // ── Sub-Step 2: Bill of Entry CRUD ────────────────────────────
  protected openCreateBoeDialog(): void {
    this.editingBoe.set(null);
    this.selectedBoeFiles.set([]);
    this.existingBoeAttachments.set([]);
    this.errorMessage.set(null);

    this.boeForm.reset({
      bill_of_entry_no: '',
      date: '',
      total_assessable_value: 0,
      bcd: 0,
      sws: 0,
      igst: 0,
      remark: '',
    });
    this.boeLiveTotalDuty.set(0);

    this.boeDialogVisible.set(true);
  }

  protected openEditBoeDialog(item: BillOfEntry): void {
    this.editingBoe.set(item);
    this.selectedBoeFiles.set([]);
    this.existingBoeAttachments.set(item.attachments || []);
    this.errorMessage.set(null);

    this.boeForm.patchValue({
      bill_of_entry_no: item.bill_of_entry_no || '',
      date: this.parseDate(item.date),
      total_assessable_value: item.total_assessable_value || 0,
      bcd: item.bcd || 0,
      sws: item.sws || 0,
      igst: item.igst || 0,
      remark: item.remark || '',
    });
    this.boeLiveTotalDuty.set(
      (Number(item.bcd) || 0) + (Number(item.sws) || 0) + (Number(item.igst) || 0),
    );

    this.boeDialogVisible.set(true);
  }

  protected closeBoeDialog(): void {
    this.boeDialogVisible.set(false);
    this.editingBoe.set(null);
    this.selectedBoeFiles.set([]);
    this.existingBoeAttachments.set([]);
  }

  protected calculateBoeTotalDuty(item: BillOfEntry): number {
    if (item.total_duty !== undefined && item.total_duty !== null) {
      return Number(item.total_duty);
    }
    const bcd = Number(item.bcd) || 0;
    const sws = Number(item.sws) || 0;
    const igst = Number(item.igst) || 0;
    return bcd + sws + igst;
  }

  protected submitBoe(): void {
    if (this.saving()) return;
    if (this.boeForm.invalid) {
      this.boeForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const formVal = this.boeForm.getRawValue();
    const totalDuty = this.boeLiveTotalDuty();
    const dateStr = formVal.date
      ? formVal.date instanceof Date
        ? this.formatDate(formVal.date)
        : String(formVal.date)
      : '';

    const payload: BillOfEntryCreateInput = {
      project_id: pId,
      bill_of_entry_no: formVal.bill_of_entry_no,
      date: dateStr,
      total_assessable_value: Number(formVal.total_assessable_value) || 0,
      bcd: Number(formVal.bcd) || 0,
      sws: Number(formVal.sws) || 0,
      igst: Number(formVal.igst) || 0,
      total_duty: totalDuty,
      remark: formVal.remark || undefined,
    };

    const files = this.selectedBoeFiles();
    const editing = this.editingBoe();

    if (editing) {
      this.boeService
        .update(editing.id, payload as BillOfEntryUpdateInput, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.closeBoeDialog();
            this.loadData(pId);
          },
          error: (err) => {
            console.error('Failed to update bill of entry', err);
            this.errorMessage.set('Failed to update Bill of Entry record.');
          },
        });
    } else {
      this.boeService
        .create(payload, files)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.closeBoeDialog();
            this.loadData(pId);
          },
          error: (err) => {
            console.error('Failed to create bill of entry', err);
            this.errorMessage.set('Failed to save Bill of Entry record.');
          },
        });
    }
  }

  protected deleteBoe(item: BillOfEntry): void {
    if (!confirm(`Are you sure you want to delete Bill of Entry ${item.bill_of_entry_no}?`)) {
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.boeService.delete(item.id).subscribe({
      next: () => this.loadData(pId),
      error: (err) => console.error('Failed to delete bill of entry', err),
    });
  }

  // ── Validation Helpers ─────────────────────────────────────────
  protected isFieldInvalid(formType: 'logistics' | 'boe', fieldName: string): boolean {
    const target = formType === 'logistics' ? this.logisticsForm : this.boeForm;
    const c = (target as any).get(fieldName);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected getFieldError(formType: 'logistics' | 'boe', fieldName: string): string | null {
    const target = formType === 'logistics' ? this.logisticsForm : this.boeForm;
    const c = (target as any).get(fieldName);
    if (!c || !c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) return 'This field is required.';
    if (c.hasError('min')) return 'Value must be greater than or equal to 0.';
    return 'Invalid field value.';
  }

  // ── File Upload / Attachment Helpers ───────────────────────────
  protected onLogisticsFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.selectedLogisticsFiles.update((current) => [...current, ...newFiles]);
      input.value = '';
    }
  }

  protected removeSelectedLogisticsFile(index: number): void {
    this.selectedLogisticsFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected onBoeFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.selectedBoeFiles.update((current) => [...current, ...newFiles]);
      input.value = '';
    }
  }

  protected removeSelectedBoeFile(index: number): void {
    this.selectedBoeFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected downloadAttachment(att: Attachment): void {
    if (!att || !att.id) return;
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
        error: (err) => console.error('Failed to download attachment', err),
      });
  }

  protected getFileIcon(contentType?: string): string {
    if (!contentType) return 'pi pi-file';
    if (contentType.includes('pdf')) return 'pi pi-file-pdf';
    if (contentType.includes('image')) return 'pi pi-image';
    if (contentType.includes('sheet') || contentType.includes('excel') || contentType.includes('csv'))
      return 'pi pi-file-excel';
    if (contentType.includes('word') || contentType.includes('document')) return 'pi pi-file-word';
    return 'pi pi-file';
  }

  protected formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private parseDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
}
