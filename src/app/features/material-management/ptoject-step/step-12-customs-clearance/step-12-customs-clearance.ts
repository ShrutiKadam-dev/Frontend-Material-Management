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
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { CustomsClearanceService } from '../../../../core/services/customs-clearance';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { AttachmentService } from '../../../../core/services/attachment';
import {
  CustomsClearance,
  CustomsClearanceCreateInput,
  CustomsClearanceUpdateInput,
} from '../../../../core/models/customs-clearance.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';

@Component({
  selector: 'app-step-12-customs-clearance',
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
    DecimalPipe,
  ],
  templateUrl: './step-12-customs-clearance.html',
  styleUrl: './step-12-customs-clearance.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step12CustomsClearance implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly customsService = inject(CustomsClearanceService);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly attachmentService = inject(AttachmentService);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly projectId = signal<number | null>(null);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);

  protected readonly clearances = signal<CustomsClearance[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly downloadingAttachmentId = signal<number | null>(null);

  // ── Dialog States ──────────────────────────────────────────────
  protected readonly dialogVisible = signal(false);
  protected readonly editingClearance = signal<CustomsClearance | null>(null);

  // Separate document upload categories
  protected readonly selectedDutyChallanFiles = signal<File[]>([]);
  protected readonly selectedBoeFiles = signal<File[]>([]);
  protected readonly selectedOtherDocsFiles = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);

  // ── Live Calculation Signal ─────────────────────────────────────
  protected readonly liveTotalCustomsAmount = signal<number>(0);

  // ── Reactive Form ─────────────────────────────────────────────
  protected readonly clearanceForm = this.fb.group({
    cha_name: ['', [Validators.required]],
    bill_of_entry_no: ['', [Validators.required]],
    boe_date: [null as Date | string | null, [Validators.required]],
    customs_location: ['', [Validators.required]],
    duty_paid_date: [null as Date | string | null],
    challan_no: [''],
    cfs_name: [''],
    transaction_ref_no: [''],
    duty_amount: [0, [Validators.min(0)]],
    igst_amount: [0, [Validators.min(0)]],
    other_customs_charges: [0, [Validators.min(0)]],
    remark: [''],
  });

  // ── View Mode & Filter States ───────────────────────────────────
  protected readonly viewMode = signal<'cards' | 'table'>('cards');
  protected readonly searchQuery = signal<string>('');

  // ── Computed Top Summary Statistics ────────────────────────────
  protected readonly totalRecordsCount = computed(() => this.clearances().length);

  protected readonly totalDutyRemitted = computed(() => {
    return this.clearances().reduce((sum, c) => sum + (Number(c.duty_amount) || 0), 0);
  });

  protected readonly totalIgstRemitted = computed(() => {
    return this.clearances().reduce((sum, c) => sum + (Number(c.igst_amount) || 0), 0);
  });

  protected readonly totalOtherCharges = computed(() => {
    return this.clearances().reduce((sum, c) => sum + (Number(c.other_customs_charges) || 0), 0);
  });

  protected readonly grandTotalCustomsAmount = computed(() => {
    return this.clearances().reduce(
      (sum, c) => sum + (Number(c.total_customs_amount) || 0),
      0,
    );
  });

  // ── Filtered List ──────────────────────────────────────────────
  protected readonly filteredClearances = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.clearances();
    if (!q) return list;

    return list.filter((c) => {
      const chaMatch = c.cha_name?.toLowerCase().includes(q);
      const boeMatch = c.bill_of_entry_no?.toLowerCase().includes(q);
      const locMatch = c.customs_location?.toLowerCase().includes(q);
      const cfsMatch = c.cfs_name?.toLowerCase().includes(q);
      const challanMatch = c.challan_no?.toLowerCase().includes(q);
      const utrMatch = c.transaction_ref_no?.toLowerCase().includes(q);
      const remarkMatch = c.remark?.toLowerCase().includes(q);
      return chaMatch || boeMatch || locMatch || cfsMatch || challanMatch || utrMatch || remarkMatch;
    });
  });

  protected setViewMode(mode: 'cards' | 'table'): void {
    this.viewMode.set(mode);
  }

  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('projectId');
    const id = rawId ? Number(rawId) : null;
    if (!id || isNaN(id)) {
      this.errorMessage.set('Invalid Project ID.');
      this.loading.set(false);
      return;
    }

    this.projectId.set(id);

    // Live calculation listeners for Duty, IGST, and Other charges
    const recalculateTotal = () => {
      const duty = Number(this.clearanceForm.get('duty_amount')?.value) || 0;
      const igst = Number(this.clearanceForm.get('igst_amount')?.value) || 0;
      const other = Number(this.clearanceForm.get('other_customs_charges')?.value) || 0;
      this.liveTotalCustomsAmount.set(duty + igst + other);
    };

    this.clearanceForm.get('duty_amount')?.valueChanges.subscribe(recalculateTotal);
    this.clearanceForm.get('igst_amount')?.valueChanges.subscribe(recalculateTotal);
    this.clearanceForm.get('other_customs_charges')?.valueChanges.subscribe(recalculateTotal);

    this.loadProjectDetails(id);
    this.loadClearanceData(id);
  }

  protected goBack(): void {
    const pId = this.projectId();
    if (pId) {
      this.router.navigate(['/projects', pId, 'steps']);
    } else {
      this.router.navigate(['/projects']);
    }
  }

  private loadProjectDetails(projectId: number): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj.customer_id) {
          this.customerService.getCustomerById(proj.customer_id).subscribe({
            next: (cust) => this.customer.set(cust),
            error: () => {},
          });
        }
      },
      error: () => {},
    });
  }

  protected loadClearanceData(projectId?: number): void {
    const pId = projectId ?? this.projectId();
    if (!pId) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.customsService
      .getByProject(pId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (list) => {
          this.clearances.set(list);
        },
        error: (err: unknown) => {
          console.error('Failed to load customs clearance data', err);
          this.errorMessage.set('Failed to load customs clearance records. Please try again.');
        },
      });
  }

  // ── Dialog Handlers ────────────────────────────────────────────
  protected openCreateDialog(): void {
    this.editingClearance.set(null);
    this.selectedDutyChallanFiles.set([]);
    this.selectedBoeFiles.set([]);
    this.selectedOtherDocsFiles.set([]);
    this.existingAttachments.set([]);
    this.liveTotalCustomsAmount.set(0);

    this.clearanceForm.reset({
      cha_name: '',
      bill_of_entry_no: '',
      boe_date: '',
      customs_location: '',
      duty_paid_date: '',
      challan_no: '',
      cfs_name: '',
      transaction_ref_no: '',
      duty_amount: 0,
      igst_amount: 0,
      other_customs_charges: 0,
      remark: '',
    });

    this.dialogVisible.set(true);
  }

  protected openEditDialog(record: CustomsClearance): void {
    this.editingClearance.set(record);
    this.selectedDutyChallanFiles.set([]);
    this.selectedBoeFiles.set([]);
    this.selectedOtherDocsFiles.set([]);
    this.existingAttachments.set(record.attachments || []);

    const duty = Number(record.duty_amount) || 0;
    const igst = Number(record.igst_amount) || 0;
    const other = Number(record.other_customs_charges) || 0;
    this.liveTotalCustomsAmount.set(duty + igst + other);

    this.clearanceForm.patchValue({
      cha_name: record.cha_name,
      bill_of_entry_no: record.bill_of_entry_no,
      boe_date: record.boe_date ? new Date(record.boe_date) : null,
      customs_location: record.customs_location,
      duty_paid_date: record.duty_paid_date ? new Date(record.duty_paid_date) : null,
      challan_no: record.challan_no || '',
      cfs_name: record.cfs_name || '',
      transaction_ref_no: record.transaction_ref_no || '',
      duty_amount: duty,
      igst_amount: igst,
      other_customs_charges: other,
      remark: record.remark || '',
    });

    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
  }

  // ── Form Submission ────────────────────────────────────────────
  protected onSubmit(): void {
    if (this.clearanceForm.invalid) {
      this.clearanceForm.markAllAsTouched();
      return;
    }

    const pId = this.projectId();
    if (!pId) return;

    this.saving.set(true);
    const formVal = this.clearanceForm.getRawValue();

    const boeDateStr = formVal.boe_date
      ? formVal.boe_date instanceof Date
        ? this.formatDate(formVal.boe_date)
        : String(formVal.boe_date)
      : '';

    const dutyPaidDateStr = formVal.duty_paid_date
      ? formVal.duty_paid_date instanceof Date
        ? this.formatDate(formVal.duty_paid_date)
        : String(formVal.duty_paid_date)
      : undefined;

    const dutyAmount = Number(formVal.duty_amount) || 0;
    const igstAmount = Number(formVal.igst_amount) || 0;
    const otherCharges = Number(formVal.other_customs_charges) || 0;
    const totalCustomsAmount = dutyAmount + igstAmount + otherCharges;

    const payload: CustomsClearanceCreateInput = {
      project_id: pId,
      cha_name: formVal.cha_name,
      bill_of_entry_no: formVal.bill_of_entry_no,
      boe_date: boeDateStr,
      customs_location: formVal.customs_location,
      duty_paid_date: dutyPaidDateStr,
      challan_no: formVal.challan_no || undefined,
      cfs_name: formVal.cfs_name || undefined,
      transaction_ref_no: formVal.transaction_ref_no || undefined,
      duty_amount: dutyAmount,
      igst_amount: igstAmount,
      other_customs_charges: otherCharges,
      total_customs_amount: totalCustomsAmount,
      remark: formVal.remark || undefined,
    };

    const dutyChallanFiles = this.selectedDutyChallanFiles();
    const boeFiles = this.selectedBoeFiles();
    const otherDocsFiles = this.selectedOtherDocsFiles();

    const editItem = this.editingClearance();
    if (editItem) {
      this.customsService
        .update(
          editItem.id,
          payload as CustomsClearanceUpdateInput,
          dutyChallanFiles,
          boeFiles,
          otherDocsFiles,
        )
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.loadClearanceData();
          },
          error: (err: unknown) => {
            console.error('Failed to update customs clearance record', err);
            this.errorMessage.set('Failed to update record. Please try again.');
          },
        });
    } else {
      this.customsService
        .create(payload, dutyChallanFiles, boeFiles, otherDocsFiles)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.loadClearanceData();
          },
          error: (err: unknown) => {
            console.error('Failed to create customs clearance record', err);
            this.errorMessage.set('Failed to save record. Please try again.');
          },
        });
    }
  }

  protected deleteClearance(record: CustomsClearance): void {
    if (!confirm(`Are you sure you want to delete customs clearance entry for BOE #${record.bill_of_entry_no}?`)) {
      return;
    }

    this.loading.set(true);
    this.customsService
      .delete(record.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.loadClearanceData();
        },
        error: (err: unknown) => {
          console.error('Failed to delete customs clearance record', err);
          this.errorMessage.set('Failed to delete record.');
        },
      });
  }

  // ── Document File Upload Handlers ──────────────────────────────
  protected onDutyChallanFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.selectedDutyChallanFiles.update((curr) => [...curr, ...newFiles]);
      input.value = '';
    }
  }

  protected removeSelectedDutyChallanFile(index: number): void {
    this.selectedDutyChallanFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected onBoeFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.selectedBoeFiles.update((curr) => [...curr, ...newFiles]);
      input.value = '';
    }
  }

  protected removeSelectedBoeFile(index: number): void {
    this.selectedBoeFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected onOtherDocsFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.selectedOtherDocsFiles.update((curr) => [...curr, ...newFiles]);
      input.value = '';
    }
  }

  protected removeSelectedOtherDocsFile(index: number): void {
    this.selectedOtherDocsFiles.update((files) => files.filter((_, i) => i !== index));
  }

  // ── Attachment Downloads ───────────────────────────────────────
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
          a.download = att.file_name || 'customs-attachment';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err: unknown) => {
          console.error('Failed to download attachment', err);
        },
      });
  }

  // ── Helper Resolvers ───────────────────────────────────────────
  protected isFieldInvalid(controlName: string): boolean {
    const control = this.clearanceForm.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  protected getFieldError(controlName: string): string | null {
    const control = this.clearanceForm.get(controlName);
    if (!control || !control.errors || !(control.dirty || control.touched)) return null;
    if (control.hasError('required')) return 'This field is required.';
    if (control.hasError('min')) return 'Value must be greater than or equal to 0.';
    return 'Invalid field value.';
  }

  // ── File Format & Icon Helpers ─────────────────────────────────
  protected formatFileSize(bytes?: number): string {
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
    if (
      contentType.includes('sheet') ||
      contentType.includes('excel') ||
      contentType.includes('csv')
    ) {
      return 'pi pi-file-excel';
    }
    if (contentType.includes('word') || contentType.includes('document')) {
      return 'pi pi-file-word';
    }
    return 'pi pi-file';
  }

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
