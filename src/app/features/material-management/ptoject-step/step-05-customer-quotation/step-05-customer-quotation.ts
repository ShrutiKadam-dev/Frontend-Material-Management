import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';

import { CustomerQuotationService } from '../../../../core/services/customer-quotation';
import { CostSheetService } from '../../../../core/services/cost-sheet';
import { CustomerService } from '../../../../core/services/customer';
import { ProjectService } from '../../../../core/services/project';
import { AttachmentService } from '../../../../core/services/attachment';
import { DropdownService } from '../../../../core/services/dropdown';
import {
  CURRENCY_OPTIONS,
  INCOTERMS_OPTIONS,
  VALIDITY_UNIT_OPTIONS,
  SelectOption,
} from '../../../../core/constants';
import {
  CustomerQuotation,
  CustomerQuotationCreateInput,
  CustomerQuotationItem,
  CustomerQuotationUpdateInput,
} from '../../../../core/models/customer-quotation.model';
import { StepFormFieldConfig } from '../../../../core/models/step-form-config.model';
import { Attachment } from '../../../../core/models/attachment.model';
import { Customer } from '../../../../core/models/customer.model';
import { Project } from '../../../../core/models/project.model';
import { CostSheet } from '../../../../core/models/cost-sheet.model';

@Component({
  selector: 'app-step-05-customer-quotation',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TextareaModule,
    DatePickerModule,
    TooltipModule,
    TableModule,
    SelectModule,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './step-05-customer-quotation.html',
  styleUrl: './step-05-customer-quotation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step05CustomerQuotation implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly customerQuotationService = inject(CustomerQuotationService);
  private readonly costSheetService = inject(CostSheetService);
  private readonly customerService = inject(CustomerService);
  private readonly projectService = inject(ProjectService);
  private readonly attachmentService = inject(AttachmentService);
  private readonly messageService = inject(MessageService);
  protected readonly dropdownService = inject(DropdownService);

  /* ── Core Signals ─────────────────────────────────────── */
  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly quotations = signal<CustomerQuotation[]>([]);
  protected readonly latestCostSheet = signal<CostSheet | null>(null);
  protected readonly loadingQuotations = signal(true);
  protected readonly loadingCostSheet = signal(false);
  protected readonly submitting = signal(false);
  protected readonly exportingId = signal<number | null>(null);
  protected readonly downloadingAttachmentId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  /* ── Dialog Signals ───────────────────────────────────── */
  protected readonly dialogVisible = signal(false);
  protected readonly editingQuotation = signal<CustomerQuotation | null>(null);
  protected readonly items = signal<CustomerQuotationItem[]>([]);
  protected readonly editingIndex = signal<number | null>(null);
  protected readonly attachments = signal<File[]>([]);
  protected readonly existingAttachments = signal<Attachment[]>([]);

  /* ── Global Dropdown Options ──────────────────────────── */
  protected readonly incotermsOptions = INCOTERMS_OPTIONS;
  protected readonly currencyOptions = CURRENCY_OPTIONS;
  protected readonly validityUnitOptions = VALIDITY_UNIT_OPTIONS;

  /* ── Declarative Form Fields Configuration ────────────── */
  protected readonly formConfig: StepFormFieldConfig[] = [
    {
      key: 'customer_name',
      label: 'Customer',
      type: 'readonly',
      readonlyValueFn: () => this.customer()?.name || this.project()?.customer_name || 'Customer',
      colSpan: 2,
    },
    {
      key: 'quotation_number',
      label: 'Quotation Number',
      type: 'text',
      placeholder: 'Enter quotation number',
      required: true,
      colSpan: 1,
    },
    {
      key: 'quotation_date',
      label: 'Quotation Date',
      type: 'date',
      placeholder: 'Enter quotation date',
      required: true,
      colSpan: 1,
    },
    {
      key: 'quotation_value',
      label: 'Quotation Value',
      type: 'currency-amount',
      currencyKey: 'currency_unit',
      currencyOptions: this.currencyOptions,
      placeholder: 'Enter quotation value',
      required: true,
      colSpan: 1,
    },
    {
      key: 'validity_amount',
      label: 'Validity',
      type: 'validity-unit',
      unitKey: 'validity_unit',
      unitOptions: this.validityUnitOptions,
      placeholder: 'Enter validity',
      required: true,
      colSpan: 1,
    },
  ];

  /* ── Reactive Forms ──────────────────────────────────── */
  protected readonly headerForm = this.fb.group({
    customer_id: [0],
    quotation_number: ['', [Validators.required]],
    quotation_date: ['', [Validators.required]],
    quotation_value: ['', [Validators.required]],
    currency_unit: ['INR', [Validators.required]],
    currency_symbol: ['₹'],
    validity_amount: ['', [Validators.required]],
    validity_unit: ['Days', [Validators.required]],
    remark: [''],
  });

  protected readonly rowForm = this.fb.group({
    material_name: ['', [Validators.required]],
    item_code: [''],
    quantity: ['', [Validators.required]],
    unit_price: [''],
  });

  /* ── Currency Signal ─────────────────────────────────── */
  private readonly currencyUnitSignal = toSignal(
    this.headerForm.controls.currency_unit.valueChanges,
    { initialValue: this.headerForm.controls.currency_unit.value }
  );

  protected readonly selectedCurrencySymbol = computed(() => {
    const unit = this.currencyUnitSignal();
    return this.dropdownService.getCurrencySymbol(unit) || '₹';
  });

  /* ── Derived Summaries ───────────────────────────────── */
  protected readonly totalNetAmount = computed(() => {
    return this.items().reduce((sum, item) => {
      const net = this.calculateNet(item.quantity, item.unit_price);
      return sum + (net ?? 0);
    }, 0);
  });

  protected readonly totalItemCount = computed(() => this.items().length);

  /* ── Lifecycle ───────────────────────────────────────── */
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!id) {
      this.errorMessage.set('Invalid project ID.');
      this.loadingQuotations.set(false);
      return;
    }

    this.projectId.set(id);
    this.loadProjectDetails(id);
    this.loadQuotations(id);
    this.loadLatestCostSheet(id);
  }

  /* ── Data Loaders ────────────────────────────────────── */
  protected loadProjectDetails(projectId: number): void {
    this.projectService.getProjectById(projectId).subscribe({
      next: (proj) => {
        this.project.set(proj);
        if (proj?.customer_id) {
          this.customerService.getCustomerById(proj.customer_id).subscribe({
            next: (cust) => this.customer.set(cust),
            error: () => {/* non-fatal */ },
          });
        }
      },
      error: () => {/* non-fatal */ },
    });
  }

  protected loadQuotations(projectId: number): void {
    this.loadingQuotations.set(true);
    this.customerQuotationService
      .getByProject(projectId)
      .pipe(finalize(() => this.loadingQuotations.set(false)))
      .subscribe({
        next: (data) => this.quotations.set(data || []),
        error: () => {
          this.errorMessage.set('Failed to load customer quotations.');
        },
      });
  }

  protected loadLatestCostSheet(projectId: number): void {
    this.loadingCostSheet.set(true);
    this.costSheetService
      .getLatestByProject(projectId)
      .pipe(finalize(() => this.loadingCostSheet.set(false)))
      .subscribe({
        next: (res) => {
          const sheet = Array.isArray(res) ? res[0] : res;
          this.latestCostSheet.set(sheet || null);
        },
        error: () => {
          // Fallback to getByProject
          this.costSheetService.getByProject(projectId).subscribe({
            next: (sheets) => {
              this.latestCostSheet.set(sheets && sheets.length ? sheets[0] : null);
            },
            error: () => {/* non-fatal */ },
          });
        },
      });
  }

  /* ── Dialog Management ───────────────────────────────── */
  protected openCreateDialog(): void {
    const proj = this.project();
    const cust = this.customer();
    const costSheet = this.latestCostSheet();

    // Map items from latest cost sheet (supporting direct items with pricePerUnitInr/totalPriceInr)
    const outputObj = costSheet?.output as { items?: any[] } | undefined;
    const sourceItems: any[] = (costSheet?.items && costSheet.items.length)
      ? costSheet.items
      : (Array.isArray(outputObj?.items) && outputObj.items.length)
        ? outputObj.items
        : [];

    const mappedItems: CustomerQuotationItem[] = sourceItems.map((it: any, index: number) => {
      const qty = Number(it.quantity) || 1;
      const unitPrice = it.pricePerUnitInr
        ?? (it.totalPriceInr ? Number((it.totalPriceInr / qty).toFixed(2)) : undefined)
        ?? (it.totalCostInr ? Number((it.totalCostInr / qty).toFixed(2)) : undefined)
        ?? (it.totalLineInr ? Number((it.totalLineInr / qty).toFixed(2)) : undefined)
        ?? it.pricePerUnitEur
        ?? 0;

      const lineTotal = it.totalPriceInr
        ?? it.totalCostInr
        ?? it.totalLineInr
        ?? (qty * Number(unitPrice));

      return {
        cost_sheet_item_id: it.id || (costSheet?.items?.[index]?.id),
        quotation_number: it.quotationNumber || costSheet?.items?.[index]?.quotationNumber || '',
        material_name: it.itemDescription || it.material_name || '',
        item_code: it.itemCode || it.item_code || '',
        quantity: it.quantity,
        unit_price: Number(unitPrice) ? Number(Number(unitPrice).toFixed(2)) : '',
        net_amount: Number(lineTotal) ? Number(Number(lineTotal).toFixed(2)) : 0,
        customs_duty_rate: it.customsDutyRate,
      };
    });

    const defaultQuoteVal = costSheet?.cumulativeProjectCostInr
      ? String(costSheet.cumulativeProjectCostInr)
      : mappedItems.length
        ? String(mappedItems.reduce((acc, it) => acc + (Number(it.net_amount) || 0), 0))
        : '';

    this.headerForm.reset({
      customer_id: proj?.customer_id || cust?.id || 0,
      quotation_number: '',
      quotation_date: '',
      quotation_value: '',
      currency_unit: 'INR',
      currency_symbol: '₹',
      validity_amount: '',
      validity_unit: 'Days',
      remark: '',
    });

    this.items.set(mappedItems);
    this.attachments.set([]);
    this.existingAttachments.set([]);
    this.editingQuotation.set(null);
    this.editingIndex.set(null);
    this.rowForm.reset();
    this.errorMessage.set(null);
    this.dialogVisible.set(true);

    if (mappedItems.length > 0) {
      this.messageService.add({
        severity: 'info',
        summary: 'Cost Sheet Synced',
        detail: `Auto-loaded ${mappedItems.length} items from latest Cost Sheet v${costSheet?.versionNumber || 1}.0`,
        life: 3000,
      });
    }
  }

  protected openEditDialog(q: CustomerQuotation): void {
    const [valAmount, valUnit] = this.parseValidity(q.validity);

    this.headerForm.reset({
      customer_id: q.customer_id,
      quotation_number: q.quotation_number,
      quotation_date: q.quotation_date ? q.quotation_date.substring(0, 10) : this.todayIso(),
      quotation_value: q.quotation_value || '',
      currency_unit: q.currency_unit || 'INR',
      currency_symbol: q.currency_symbol || '₹',
      validity_amount: valAmount,
      validity_unit: valUnit,
      remark: q.remark || '',
    });

    this.items.set(q.items ? [...q.items] : []);
    this.attachments.set([]);
    this.existingAttachments.set(q.attachments ? [...q.attachments] : []);
    this.editingQuotation.set(q);
    this.editingIndex.set(null);
    this.rowForm.reset();
    this.errorMessage.set(null);
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingQuotation.set(null);
  }

  /* ── Item Operations ─────────────────────────────────── */
  protected saveRow(matInputEl?: HTMLInputElement): void {
    if (this.rowForm.invalid) {
      this.rowForm.markAllAsTouched();
      return;
    }

    const val = this.rowForm.getRawValue();
    const qty = Number(val.quantity) || 0;
    const price = val.unit_price ? Number(val.unit_price) : 0;
    const net = qty && price ? Number((qty * price).toFixed(2)) : undefined;

    const newItem: CustomerQuotationItem = {
      material_name: val.material_name.trim(),
      item_code: val.item_code?.trim() || '',
      quantity: val.quantity,
      unit_price: val.unit_price ? val.unit_price : undefined,
      net_amount: net,
    };

    const idx = this.editingIndex();
    if (idx !== null && idx >= 0) {
      this.items.update((list) => {
        const next = [...list];
        next[idx] = { ...next[idx], ...newItem };
        return next;
      });
      this.editingIndex.set(null);
    } else {
      this.items.update((list) => [...list, newItem]);
    }

    this.rowForm.reset();
    if (matInputEl) {
      matInputEl.focus();
    }
  }

  protected openEditRow(index: number, matInputEl?: HTMLInputElement): void {
    const item = this.items()[index];
    if (!item) return;

    this.rowForm.setValue({
      material_name: item.material_name,
      item_code: item.item_code || '',
      quantity: String(item.quantity),
      unit_price: item.unit_price !== undefined && item.unit_price !== null ? String(item.unit_price) : '',
    });
    this.editingIndex.set(index);
    if (matInputEl) {
      matInputEl.focus();
    }
  }

  protected cancelRow(): void {
    this.rowForm.reset();
    this.editingIndex.set(null);
  }

  protected deleteRow(index: number): void {
    this.items.update((list) => list.filter((_, i) => i !== index));
    if (this.editingIndex() === index) {
      this.cancelRow();
    }
  }

  /* ── Form Submit & Mutation ──────────────────────────── */
  protected submit(): void {
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      return;
    }

    const raw = this.headerForm.getRawValue();
    const currencySymbol = this.dropdownService.getCurrencySymbol(raw.currency_unit) || '₹';

    const validityStr = raw.validity_amount && raw.validity_unit
      ? `${raw.validity_amount} ${raw.validity_unit}`
      : raw.validity_amount || '';

    const payload: CustomerQuotationCreateInput = {
      project_id: this.projectId(),
      customer_id: Number(raw.customer_id) || this.project()?.customer_id || 0,
      quotation_number: raw.quotation_number.trim(),
      quotation_date: raw.quotation_date,
      quotation_value: raw.quotation_value ? String(raw.quotation_value).trim() : '',
      currency_unit: raw.currency_unit,
      currency_symbol: currencySymbol,
      total_net_amount: this.totalNetAmount(),
      validity: validityStr,
      remark: raw.remark || '',
      items: this.items(),
    };

    this.submitting.set(true);
    const editing = this.editingQuotation();

    const request$ = editing
      ? this.customerQuotationService.update(editing.id, payload, this.attachments())
      : this.customerQuotationService.create(payload, this.attachments());

    request$
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: editing ? 'Updated' : 'Created',
            detail: `Customer quotation ${editing ? 'updated' : 'created'} successfully.`,
            life: 3000,
          });
          this.closeDialog();
          this.loadQuotations(this.projectId());
        },
        error: (err) => {
          const detail = err?.error?.message || err?.error?.error || 'Failed to save customer quotation.';
          this.errorMessage.set(detail);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail,
            life: 4000,
          });
        },
      });
  }

  /* ── File Attachments ────────────────────────────────── */
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      this.attachments.update((prev) => [...prev, ...newFiles]);
      input.value = '';
    }
  }

  protected removeAttachment(index: number): void {
    this.attachments.update((prev) => prev.filter((_, i) => i !== index));
  }

  protected downloadAttachment(att: Attachment): void {
    if (!att.id) return;
    this.downloadingAttachmentId.set(att.id);
    this.attachmentService
      .downloadFile(att)
      .pipe(finalize(() => this.downloadingAttachmentId.set(null)))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.file_name || 'attachment';
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Download failed',
            detail: 'Could not download the attachment.',
            life: 3000,
          });
        },
      });
  }

  /* ── Delete Quotation ────────────────────────────────── */
  protected deleteQuotation(id: number): void {
    this.customerQuotationService.delete(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'info',
          summary: 'Deleted',
          detail: 'Customer quotation removed successfully.',
          life: 3000,
        });
        this.loadQuotations(this.projectId());
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to delete customer quotation.',
          life: 3000,
        });
      },
    });
  }

  /* ── Validation & Computation Helpers ────────────────── */
  protected isFieldInvalid(key: string): boolean {
    const c = this.headerForm.get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected calculateNet(qty: string | number | undefined, price: string | number | undefined): number | null {
    if (!qty || !price) return null;
    const q = Number(qty);
    const p = Number(price);
    if (isNaN(q) || isNaN(p) || q <= 0 || p <= 0) return null;
    return Number((q * p).toFixed(2));
  }

  protected formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected getFileIcon(contentType?: string): string {
    if (!contentType) return 'pi pi-file';
    const type = contentType.toLowerCase();
    if (type.includes('pdf')) return 'pi pi-file-pdf';
    if (type.includes('image')) return 'pi pi-image';
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) {
      return 'pi pi-file-excel';
    }
    if (type.includes('word') || type.includes('document')) {
      return 'pi pi-file-word';
    }
    return 'pi pi-file';
  }

  protected parseValidity(validity?: string): [string, string] {
    if (!validity) return ['30', 'Days'];
    const parts = validity.trim().split(/\s+/);
    if (parts.length >= 2) {
      return [parts[0], parts.slice(1).join(' ')];
    }
    return [parts[0], 'Days'];
  }

  private todayIso(): string {
    return new Date().toISOString().substring(0, 10);
  }

  /* ── Navigation ──────────────────────────────────────── */
  protected goBack(): void {
    this.router.navigate(['/projects', this.projectId(), 'steps']);
  }
}
