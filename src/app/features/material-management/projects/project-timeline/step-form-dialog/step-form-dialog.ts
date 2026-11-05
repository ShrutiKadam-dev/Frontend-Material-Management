import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
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
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';

import { Observable, catchError, finalize, forkJoin, map, of, Subscription } from 'rxjs';

import { ProjectStep, ProjectStepRemark } from '../../../../../core/models/project-step.model';
import { FormApiService } from '../../../../../core/services/form-api';
import {
  FORM_CATALOG,
  FormDefinition,
  FormFieldDefinition,
  FormTableColumn,
  getFormDefinition,
} from '../../../../../core/constants/form-catalog';
import {
  CURRENCY_OPTIONS,
  CURRENCY_SYMBOLS,
  getCurrencySymbol,
  parseCurrencyAmount,
  SelectOption,
} from '../../../../../core/constants/dropdown-options.constant';
import { getCurrentUserFromStorage } from '../../../../../core/utils/remark.utils';
import {
  formatDisplayDate,
  formatLocalDate,
  formatLocalDateTime,
  parseLocalDate,
  parseLocalDateTime,
  sanitizePayloadDates,
} from '../../../../../core/utils/date.utils';
import {
  calculateTableTotalsWithGst,
  cleanTableItems,
  extractGstRate,
  getClosingDateKeyForField,
  getTableRowCellValue,
  hasGstConfigured,
  isCustomerField,
  isProjectTitleField,
  isSupplierField,
  isTableRowEmpty,
  normalizeTableRow,
  toValidDate,
  validateDateSequence,
} from '../../../../../core/utils/form.utils';
import { Project } from '../../../../../core/models/project.model';
import { Customer } from '../../../../../core/models/customer.model';
import { Supplier } from '../../../../../core/models/supplier.model';
import { ProjectService } from '../../../../../core/services/project';
import { CustomerService } from '../../../../../core/services/customer';
import { SupplierService } from '../../../../../core/services/supplier';
import { SupplierQuotationService } from '../../../../../core/services/supplier-quotation';
import { PreQualificationBidService } from '../../../../../core/services/pre-qualification-bid';
import { ProjectStepService } from '../../../../../core/services/project-step';

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
    TooltipModule,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './step-form-dialog.html',
  styleUrl: './step-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepFormDialog {
  private readonly formApiService = inject(FormApiService);
  private readonly messageService = inject(MessageService);
  private readonly projectService = inject(ProjectService, { optional: true });
  private readonly customerService = inject(CustomerService, { optional: true });
  private readonly supplierService = inject(SupplierService, { optional: true });
  private readonly supplierQuotationService = inject(SupplierQuotationService, { optional: true });
  private readonly preQualificationBidService = inject(PreQualificationBidService, { optional: true });
  private readonly projectStepService = inject(ProjectStepService, { optional: true });
  private readonly cdr = inject(ChangeDetectorRef);

  readonly fetchingSupplierQuotation = signal<boolean>(false);
  readonly fetchingNationalPqb = signal<boolean>(false);
  readonly fetchingPreviousStep = signal<boolean>(false);

  // ── Inputs & Two-Way Model ──────────────────────────────────────────
  readonly visible = model<boolean>(false);
  readonly projectId = input.required<number>();
  readonly step = input<ProjectStep | null>(null);
  readonly formDefinition = input<FormDefinition | null>(null);
  readonly projectCode = input<string>('');
  readonly projectTitle = input<string>('');
  readonly customerName = input<string>('');
  readonly supplierName = input<string>('');
  readonly existingSteps = input<ProjectStep[] | null>(null);

  private isResolvingCorrigendum = false;

  // ── Fallback Metadata State (when inputs are not provided) ──────────
  readonly fallbackProject = signal<Project | null>(null);
  readonly fallbackCustomer = signal<Customer | null>(null);
  readonly fallbackSupplier = signal<Supplier | null>(null);

  readonly effectiveProjectTitle = computed(
    () => this.projectTitle() || this.fallbackProject()?.project_title || '',
  );
  readonly effectiveCustomerName = computed(
    () =>
      this.customerName() ||
      this.fallbackCustomer()?.name ||
      this.fallbackProject()?.customer_name ||
      '',
  );
  readonly effectiveSupplierName = computed(
    () =>
      this.supplierName() ||
      this.fallbackSupplier()?.name ||
      this.fallbackProject()?.supplier_name ||
      '',
  );

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
  readonly isFormInvalid = signal<boolean>(false);
  private formStatusSub?: Subscription;
  private readonly destroyRef = inject(DestroyRef, { optional: true });

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

  checkSaveDisabled(): boolean {
    if (this.saving() || this.deleting() || this.loading()) {
      return true;
    }
    return Boolean(this.isFormInvalid?.());
  }

  readonly isSaveDisabled = computed(() => this.checkSaveDisabled());

  readonly modalTitle = computed(() => {
    const s = this.step();
    const def = this.resolvedDef();
    if (s) {
      return `Edit Step ${s.step_number}: ${s.step_name}`;
    }
    return def ? `Attach Form: ${def.name}` : 'Form Details';
  });


  readonly tableVersion = signal<number>(0);
  readonly formVersion = signal<number>(0);

  readonly isCostSheet = computed(() => this.resolvedDef()?.formCode === 'FORM_10_COST_SHEET');
  readonly isPqbBidDocument = computed(() => this.resolvedDef()?.formCode === 'FORM_02_PQB_BID_DOCUMENT');
  readonly isCorrigendum = computed(() => this.resolvedDef()?.formCode === 'FORM_03_CORRIGENDUM');
  readonly linkedTenderStep = signal<ProjectStep | null>(null);
  readonly corrigendumLinkedInfo = computed(() => {
    if (!this.isCorrigendum()) return null;
    this.formVersion();
    const step = this.linkedTenderStep();
    const fg = this.formGroup();
    const againstRef = String(fg?.get('against_ref_no')?.value || '').trim();
    const refTitle = String(fg?.get('ref_title')?.value || '').trim();

    if (step) {
      const stepData = (step.data as Record<string, unknown>) || {};
      const fallbackRef = String(
        stepData['tender_enquiry_no'] ||
        stepData['tender_no'] ||
        stepData['icb_no'] ||
        stepData['ste_no'] ||
        stepData['lte_no'] ||
        stepData['pac_no'] ||
        stepData['eoi_no'] ||
        stepData['pqb_no'] ||
        stepData['against_ref_no'] ||
        stepData['against_tender_no'] ||
        '',
      ).trim();
      const fallbackTitle = String(
        stepData['tender_title'] ||
        stepData['icb_title'] ||
        stepData['techno_title'] ||
        stepData['pac_title'] ||
        stepData['lte_title'] ||
        stepData['ste_title'] ||
        stepData['pqb_title'] ||
        stepData['eoi_title'] ||
        stepData['ref_title'] ||
        stepData['title'] ||
        '',
      ).trim();
      const defName = step.form_code ? getFormDefinition(step.form_code)?.name : null;
      const stepName = (step.step_name && !step.step_name.toLowerCase().includes('previous tender') && !step.step_name.toLowerCase().includes('preceding tender'))
        ? step.step_name
        : (defName || 'National Pre-Qualification Bid (PQB)');
      return {
        stepName,
        refNo: againstRef || fallbackRef,
        title: refTitle || fallbackTitle,
        formCode: step.form_code || '',
      };
    }

    if (againstRef || refTitle) {
      let probableName = 'National Pre-Qualification Bid (PQB)';
      const upperRef = (againstRef + ' ' + refTitle).toUpperCase();
      if ((upperRef.includes('BID') || upperRef.includes('DOC')) && upperRef.includes('ICB')) {
        probableName = 'Bid Document - International Competitive Bidding (ICB)';
      } else if ((upperRef.includes('BID') || upperRef.includes('DOC')) && (upperRef.includes('TECHNO') || upperRef.includes('COMMERCIAL'))) {
        probableName = 'Bid Document - Techno Commercial Tender';
      } else if ((upperRef.includes('BID') || upperRef.includes('DOC')) && upperRef.includes('STE')) {
        probableName = 'Bid Document - Single Tender Enquiry (STE)';
      } else if ((upperRef.includes('BID') || upperRef.includes('DOC')) && upperRef.includes('LTE')) {
        probableName = 'Bid Document - Limited Tender Enquiry (LTE)';
      } else if ((upperRef.includes('BID') || upperRef.includes('DOC')) && upperRef.includes('PQB')) {
        probableName = 'Bid Document for PQB';
      } else if (upperRef.includes('ICB') || upperRef.includes('INTERNATIONAL')) {
        probableName = 'International Competitive Bidding (ICB)';
      } else if (upperRef.includes('TECHNO') || upperRef.includes('COMMERCIAL')) {
        probableName = 'Techno Commercial Tender';
      } else if (upperRef.includes('PAC')) {
        probableName = 'PAC Tender';
      } else if (upperRef.includes('EOI') || upperRef.includes('EXPRESSION')) {
        probableName = 'Expression of Interest (EOI)';
      } else if (upperRef.includes('LTE') || upperRef.includes('LIMITED')) {
        probableName = 'Limited Tender Enquiry (LTE)';
      } else if (upperRef.includes('STE') || upperRef.includes('SINGLE')) {
        probableName = 'Single Tender Enquiry (STE)';
      } else if (upperRef.includes('PQB') || upperRef.includes('PRE-QUALIFICATION')) {
        probableName = 'National Pre-Qualification Bid (PQB)';
      }

      return {
        stepName: probableName,
        refNo: againstRef,
        title: refTitle,
        formCode: '',
      };
    }

    return null;
  });

  getCorrigendumSourceStepName(info: { stepName?: string } | null): string {
    if (info?.stepName && !info.stepName.toLowerCase().includes('previous tender') && !info.stepName.toLowerCase().includes('preceding tender')) {
      return info.stepName;
    }
    return 'Preceding Tender Step (ICB / Techno Commercial / PAC / EOI / PQB / LTE / STE)';
  }

  readonly corrigendumSourceStepName = computed(() => this.getCorrigendumSourceStepName(this.corrigendumLinkedInfo()));

  getCorrigendumFetchButtonLabel(info: { formCode?: string; stepName?: string } | null): string {
    const fcode = info?.formCode || '';
    const sname = (info?.stepName || '').toLowerCase();
    if (fcode === 'FORM_36_BID_DOC_ICB' || (sname.includes('bid doc') && (sname.includes('icb') || sname.includes('international')))) {
      return 'Fetch from Bid Doc ICB';
    }
    if (fcode === 'FORM_35_ICB' || sname.includes('international competitive') || sname.includes('icb')) {
      return 'Fetch from ICB';
    }
    if (fcode === 'FORM_29_BID_DOC_TECHNO_COMMERCIAL' || (sname.includes('bid doc') && (sname.includes('techno') || sname.includes('commercial')))) {
      return 'Fetch from Bid Doc Techno Commercial';
    }
    if (fcode === 'FORM_30_TECHNO_COMMERCIAL_TENDER' || sname.includes('techno commercial')) {
      return 'Fetch from Techno Commercial Tender';
    }
    if (fcode === 'FORM_13_PAC_TENDER' || sname.includes('pac tender') || sname.includes('pac')) {
      return 'Fetch from PAC Tender';
    }
    if (fcode === 'FORM_07_EOI' || sname.includes('expression of interest') || sname.includes('eoi')) {
      return 'Fetch from EOI';
    }
    if (fcode === 'FORM_34_BID_DOC_STE' || (sname.includes('bid doc') && (sname.includes('ste') || sname.includes('single tender')))) {
      return 'Fetch from Bid Doc STE';
    }
    if (fcode === 'FORM_31_BID_DOC_LTE' || (sname.includes('bid doc') && (sname.includes('lte') || sname.includes('limited tender')))) {
      return 'Fetch from Bid Doc LTE';
    }
    if (fcode === 'FORM_02_PQB_BID_DOCUMENT' || (sname.includes('bid doc') && sname.includes('pqb'))) {
      return 'Fetch from Bid Doc PQB';
    }
    if (fcode === 'FORM_04_LTE' || sname.includes('limited tender') || sname.includes('lte')) {
      return 'Fetch from LTE';
    }
    if (fcode === 'FORM_33_STE' || sname.includes('single tender') || sname.includes('ste')) {
      return 'Fetch from STE';
    }
    return 'Fetch from National PQB';
  }

  readonly corrigendumFetchButtonLabel = computed(() => this.getCorrigendumFetchButtonLabel(this.corrigendumLinkedInfo()));

  readonly tableTotalSum = computed(() => {
    this.tableVersion();
    const arr = (this.tableFormArray()?.value || []) as Array<Record<string, unknown>>;
    const cfg = this.resolvedDef()?.tableConfig;
    if (!cfg || !cfg.totalKey) return 0;
    return arr.reduce((sum, row) => {
      const val = Number(row[cfg.totalKey!]);
      if (!isNaN(val) && val !== 0) {
        return sum + val;
      }
      if (cfg.quantityKey && cfg.unitPriceKey) {
        const q = Number(row[cfg.quantityKey]) || 0;
        const p = Number(row[cfg.unitPriceKey]) || 0;
        return sum + q * p;
      }
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  });

  readonly tableNetAmount = computed(() => this.tableTotalSum());

  readonly tableGstRate = computed(() => {
    this.formVersion();
    const def = this.resolvedDef();
    if (def?.formCode === 'FORM_10_COST_SHEET') return 0;
    const formVals = (this.formGroup()?.value || {}) as Record<string, unknown>;
    return extractGstRate(formVals, def?.fields) ?? 0;
  });

  readonly tableGstAmount = computed(() => {
    this.formVersion();
    const def = this.resolvedDef();
    if (def?.formCode === 'FORM_10_COST_SHEET') return 0;
    const net = this.tableNetAmount();
    const formVals = (this.formGroup()?.value || {}) as Record<string, unknown>;
    const explicitGst =
      formVals['gst_amount'] !== undefined && formVals['gst_amount'] !== null && formVals['gst_amount'] !== ''
        ? Number(formVals['gst_amount'])
        : null;
    return calculateTableTotalsWithGst(net, this.tableGstRate(), explicitGst).gst_amount;
  });

  readonly tableGrossTotalSum = computed(() => {
    this.formVersion();
    const def = this.resolvedDef();
    if (def?.formCode === 'FORM_10_COST_SHEET') return this.tableNetAmount();
    const net = this.tableNetAmount();
    const formVals = (this.formGroup()?.value || {}) as Record<string, unknown>;
    const explicitGst =
      formVals['gst_amount'] !== undefined && formVals['gst_amount'] !== null && formVals['gst_amount'] !== ''
        ? Number(formVals['gst_amount'])
        : null;
    return calculateTableTotalsWithGst(net, this.tableGstRate(), explicitGst).total_gross_amount;
  });

  readonly hasTableGst = computed(() => {
    this.formVersion();
    const def = this.resolvedDef();
    if (def?.formCode === 'FORM_10_COST_SHEET') {
      return false;
    }
    const formVals = (this.formGroup()?.value || {}) as Record<string, unknown>;
    return hasGstConfigured(def?.fields, formVals) || this.tableGstRate() > 0 || this.tableGstAmount() > 0;
  });

  // ── Currency Selection & Dynamic Table Currency ─────────────────────
  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly selectedCurrency = signal<string>('INR');
  readonly selectedCurrencySymbol = computed(() => getCurrencySymbol(this.selectedCurrency()));

  readonly tableCurrencySymbol = computed(() => {
    this.formVersion();
    const def = this.resolvedDef();
    if (def?.formCode === 'FORM_10_COST_SHEET') {
      return '€';
    }
    const hasCurrencySelect = def?.fields.some((f) => this.isCurrencyWithSelect(f));
    if (hasCurrencySelect) {
      return this.selectedCurrencySymbol();
    }
    return '₹';
  });

  isCurrencyWithSelect(field: FormFieldDefinition): boolean {
    return Boolean(field.hasCurrencySelect || field.key === 'quotation_value');
  }

  onCurrencyChange(newCurrency: string): void {
    if (!newCurrency) return;
    const clean = newCurrency.trim().toUpperCase();
    this.selectedCurrency.set(clean);
    const fg = this.formGroup();
    if (fg) {
      fg.get('currency_unit')?.setValue(clean, { emitEvent: false });
      fg.get('currency_symbol')?.setValue(getCurrencySymbol(clean), { emitEvent: false });
    }
    this.formVersion.update((v) => v + 1);
  }

  getColumnLabel(col: FormTableColumn): string {
    if (col.label.includes('[EUR]') || col.label.includes('(€)')) {
      return col.label;
    }
    if (col.type === 'currency' && !col.label.includes('(') && !col.label.includes('[')) {
      return `${col.label} (${this.tableCurrencySymbol()})`;
    }
    return col.label;
  }

  /**
   * Returns the minimum selectable Date for a given date/datetime field.
   * If the field is an opening date and its closing date is filled,
   * all dates prior to the closing date will be disabled in the datepicker.
   */
  getMinDate(fieldKey: string): Date | null {
    this.formVersion();
    const def = this.resolvedDef();
    if (!def) return null;
    const availableKeys = def.fields.map((f) => f.key);
    const closingKey = getClosingDateKeyForField(fieldKey, availableKeys);
    if (!closingKey) return null;

    const closingVal = this.formGroup()?.get(closingKey)?.value;
    const closingDate = toValidDate(closingVal);
    if (!closingDate) return null;

    const currentField = def.fields.find((f) => f.key === fieldKey);
    if (currentField?.type === 'date') {
      return new Date(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate());
    }

    return closingDate;
  }

  /**
   * Returns human-readable label of the closing date field associated with an opening date field.
   */
  getClosingDateLabel(fieldKey: string): string {
    const def = this.resolvedDef();
    if (!def) return 'Closing Date & Time';
    const availableKeys = def.fields.map((f) => f.key);
    const closingKey = getClosingDateKeyForField(fieldKey, availableKeys);
    if (!closingKey) return 'Closing Date & Time';
    const field = def.fields.find((f) => f.key === closingKey);
    return field?.label || 'Closing Date & Time';
  }

  loadFromSupplierQuotation(showNotification = true): void {
    const pId = this.projectId();
    if (!pId || !this.supplierQuotationService) return;

    this.fetchingSupplierQuotation.set(true);
    this.supplierQuotationService.getLatest(pId).subscribe({
      next: (res: unknown) => {
        this.fetchingSupplierQuotation.set(false);
        const data = (res || {}) as Record<string, unknown>;
        const rawItems = Array.isArray(data['items']) ? (data['items'] as Array<Record<string, unknown>>) : [];

        if (rawItems.length === 0) {
          if (showNotification) {
            this.messageService.add({
              severity: 'warn',
              summary: 'No Supplier Quotation Items',
              detail: 'No items found in latest Quotation from Supplier for this project.',
            });
          }
          return;
        }

        const def = this.resolvedDef();
        if (!def || !def.tableConfig) return;

        const rowsArray = new FormArray<FormGroup>([]);
        let totalEur = 0;

        for (let i = 0; i < rawItems.length; i++) {
          const item = rawItems[i];
          const desc = String(item['description'] || item['material_name'] || `Item ${i + 1}`).trim();
          const icode = String(item['item_code'] || item['hsn_code'] || item['hsn_sac'] || `ITEM-${i + 1}`).trim();
          const pEur = Number(item['price_per_unit_eur'] ?? item['unit_price'] ?? 0);
          const qty = Number(item['quantity'] ?? 1);

          totalEur += pEur * qty;

          const rowData: Record<string, unknown> = {
            sr_no: i + 1,
            description: desc,
            item_code: icode,
            price_per_unit_eur: pEur,
            quantity: qty,
            total_price_eur: pEur * qty,
          };

          rowsArray.push(this.createTableRowGroup(def, rowData));
        }

        this.tableFormArray.set(rowsArray);
        this.tableVersion.update((v) => v + 1);

        const totalEurCtrl = this.formGroup()?.get('total_amount_eur');
        if (totalEurCtrl && totalEur > 0) {
          totalEurCtrl.setValue(Number(totalEur.toFixed(2)), { emitEvent: false });
        }

        if (showNotification) {
          this.messageService.add({
            severity: 'success',
            summary: 'Quotation Data Loaded',
            detail: `Imported ${rawItems.length} line items from latest Quotation from Supplier.`,
          });
        }
      },
      error: () => {
        this.fetchingSupplierQuotation.set(false);
        if (showNotification) {
          this.messageService.add({
            severity: 'info',
            summary: 'Supplier Quotation Unavailable',
            detail: 'Could not fetch latest supplier quotation items for this project.',
          });
        }
      },
    });
  }

  loadFromNationalPreQualificationBid(showNotification = true): void {
    const pId = this.projectId();
    if (!pId || !this.preQualificationBidService) return;

    this.fetchingNationalPqb.set(true);
    this.preQualificationBidService.getLatest(pId).subscribe({
      next: (pqb) => {
        this.fetchingNationalPqb.set(false);
        const data = (pqb || {}) as Record<string, unknown>;

        const title = String(
          data['pqb_title'] ||
            data['pqbTitle'] ||
            data['title'] ||
            data['bid_title'] ||
            data['name'] ||
            '',
        ).trim();

        const no = String(
          data['pqb_no'] ||
            data['pqbNo'] ||
            data['pqb_number'] ||
            data['pqbNumber'] ||
            data['bid_no'] ||
            data['bid_number'] ||
            data['number'] ||
            '',
        ).trim();

        if (!title && !no) {
          if (showNotification) {
            this.messageService.add({
              severity: 'warn',
              summary: 'National PQB Not Found',
              detail: 'No latest National Pre-Qualification Bid found for this project to patch.',
            });
          }
          return;
        }

        const fg = this.formGroup();
        if (!fg) return;

        const patchPayload: Record<string, unknown> = {};
        if (title && fg.get('pqb_title')) {
          patchPayload['pqb_title'] = title;
        }
        if (no && fg.get('pqb_no')) {
          patchPayload['pqb_no'] = no;
        }

        const rawIssueDate =
          data['pqb_issuing_date'] || data['pqb_issue_date'] || data['issue_date'];
        if (rawIssueDate && fg.get('pqb_issue_date') && !fg.get('pqb_issue_date')?.value) {
          patchPayload['pqb_issue_date'] = parseLocalDate(rawIssueDate as string | Date);
        }

        const rawClosing = data['pqb_closing_date_time'] || data['closing_date_time'];
        if (
          rawClosing &&
          fg.get('pqb_closing_date_time') &&
          !fg.get('pqb_closing_date_time')?.value
        ) {
          patchPayload['pqb_closing_date_time'] = parseLocalDateTime(rawClosing as string | Date);
        }

        const rawOpening = data['pqb_opening_date_time'] || data['opening_date_time'];
        if (
          rawOpening &&
          fg.get('pqb_opening_date_time') &&
          !fg.get('pqb_opening_date_time')?.value
        ) {
          patchPayload['pqb_opening_date_time'] = parseLocalDateTime(rawOpening as string | Date);
        }

        fg.patchValue(patchPayload);
        fg.markAsDirty();
        this.formVersion.update((v) => v + 1);
        this.cdr.markForCheck();

        if (showNotification) {
          this.messageService.add({
            severity: 'success',
            summary: 'PQB Details Patched',
            detail: `Patched PQB Title "${title}" and PQB No. "${no}" from latest National PQB.`,
          });
        }
      },
      error: () => {
        this.fetchingNationalPqb.set(false);
        if (showNotification) {
          this.messageService.add({
            severity: 'info',
            summary: 'National PQB Unavailable',
            detail: 'Could not fetch latest National Pre-Qualification Bid for this project.',
          });
        }
      },
    });
  }

  private isTenderOrPqbStep(s: ProjectStep): boolean {
    if (!s) return false;
    const fcode = (s.form_code || '').toUpperCase().trim();
    const name = (s.step_name || '').toLowerCase().trim();

    const resolvedDef = s.form_code
      ? getFormDefinition(s.form_code)
      : s.step_name
        ? getFormDefinition(s.step_name)
        : s.step_number
          ? getFormDefinition(s.step_number)
          : undefined;

    const canonicalCode = (resolvedDef?.formCode || fcode).toUpperCase();

    // Whitelist allowed Bid Documents for Corrigendum (ICB, Techno Commercial, LTE, STE)
    const isAllowedBidDoc =
      canonicalCode === 'FORM_36_BID_DOC_ICB' ||
      canonicalCode === 'FORM_29_BID_DOC_TECHNO_COMMERCIAL' ||
      canonicalCode === 'FORM_31_BID_DOC_LTE' ||
      canonicalCode === 'FORM_34_BID_DOC_STE' ||
      fcode === 'FORM_36_BID_DOC_ICB' ||
      fcode === 'FORM_29_BID_DOC_TECHNO_COMMERCIAL' ||
      fcode === 'FORM_31_BID_DOC_LTE' ||
      fcode === 'FORM_34_BID_DOC_STE' ||
      (name.includes('bid doc') && (
        name.includes('icb') ||
        name.includes('international') ||
        name.includes('techno') ||
        name.includes('commercial') ||
        name.includes('lte') ||
        name.includes('limited tender') ||
        name.includes('ste') ||
        name.includes('single tender')
      ));

    // Strictly exclude Corrigendum, Bid Submission, and any other non-whitelisted Bid Documents
    if (
      fcode === 'FORM_03_CORRIGENDUM' ||
      canonicalCode === 'FORM_03_CORRIGENDUM' ||
      name.includes('corrigendum') ||
      name.includes('bid submission') ||
      (!isAllowedBidDoc && (fcode.includes('BID_DOC') || canonicalCode.includes('BID_DOC') || name.includes('bid doc')))
    ) {
      return false;
    }

    const allowedCodes = [
      'FORM_35_ICB',
      'FORM_36_BID_DOC_ICB',
      'FORM_30_TECHNO_COMMERCIAL_TENDER',
      'FORM_29_BID_DOC_TECHNO_COMMERCIAL',
      'FORM_13_PAC_TENDER',
      'FORM_07_EOI',
      'FORM_01_PQB',
      'FORM_04_LTE',
      'FORM_31_BID_DOC_LTE',
      'FORM_33_STE',
      'FORM_30_STE',
      'FORM_STE',
      'FORM_33_SINGLE_TENDER_ENQUIRY',
      'FORM_34_BID_DOC_STE',
    ];

    if (allowedCodes.includes(canonicalCode) || allowedCodes.includes(fcode)) {
      return true;
    }

    // Check legacy step number 6 which is PAC Tender
    if (s.step_number === 6 || (s.step_order && s.step_order === 6)) {
      return true;
    }

    // Check category
    if (resolvedDef?.category === 'Pre-Bidding & Tenders' && (!canonicalCode.includes('BID_DOC') || isAllowedBidDoc)) {
      return true;
    }

    // Name matching for any of the 7 tender/enquiry steps
    return (
      isAllowedBidDoc ||
      name.includes('international competitive bidding') ||
      name.includes('icb') ||
      name.includes('techno commercial') ||
      name.includes('pac tender') ||
      name.includes('pac') ||
      name.includes('expression of interest') ||
      name.includes('eoi') ||
      name.includes('national pre') ||
      name.includes('pre-qualification') ||
      name.includes('pre qualification') ||
      name.includes('pqb') ||
      name.includes('limited tender') ||
      name.startsWith('lte') ||
      name.includes('single tender') ||
      name.startsWith('ste') ||
      name.includes('customer tender') ||
      name.includes('tender enquiry') ||
      name.includes('tender')
    );
  }

  findPrecedingTenderStep(
    allSteps: ProjectStep[],
    currentStep: ProjectStep | null,
  ): ProjectStep | undefined {
    const getStepNum = (s: ProjectStep | null | undefined): number => {
      if (!s) return 0;
      return s.step_number ?? s.step_order ?? 0;
    };

    const getStepTime = (s: ProjectStep): number => {
      const dtStr = s.updated_at || s.created_at || s.completed_at;
      if (dtStr) {
        const t = new Date(dtStr).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      return 0;
    };

    const candidates = (allSteps || []).filter((s) => {
      if (currentStep && s.id && currentStep.id && s.id === currentStep.id) {
        return false;
      }
      return this.isTenderOrPqbStep(s);
    });

    if (candidates.length === 0) return undefined;

    // 1. If currentStep has an against_ref_no saved or in form, try to find an exact matching candidate
    const currentRef = currentStep
      ? String(
          (currentStep.data as Record<string, unknown>)?.[ 'against_ref_no' ] ||
          (currentStep.data as Record<string, unknown>)?.[ 'against_tender_no' ] ||
          this.formGroup()?.get('against_ref_no')?.value ||
          '',
        ).trim().toLowerCase()
      : '';

    if (currentRef) {
      const exactRefMatch = candidates.find((c) => {
        const cd = (c.data as Record<string, unknown>) || {};
        const cr = c as unknown as Record<string, unknown>;
        const candRefs = [
          cd['tender_enquiry_no'],
          cd['tender_no'],
          cd['icb_no'],
          cd['ste_no'],
          cd['lte_no'],
          cd['pac_no'],
          cd['eoi_no'],
          cd['pqb_no'],
          cd['against_ref_no'],
          cr['tender_enquiry_no'],
          cr['tender_no'],
          cr['pqb_no'],
        ].filter(Boolean).map((r) => String(r).trim().toLowerCase());
        return candRefs.includes(currentRef);
      });
      if (exactRefMatch) {
        return exactRefMatch;
      }
    }

    // 2. Corrigendum comes after the steps in the sequence:
    // If currentStep has a known step_number/order, prefer candidates that strictly precede it
    let scopedCandidates = candidates;
    const currentNum = getStepNum(currentStep);
    const currentIndex = currentStep ? allSteps.findIndex((s) => s.id && s.id === currentStep.id) : -1;

    if (currentNum > 0) {
      const prior = candidates.filter((s) => getStepNum(s) > 0 && getStepNum(s) < currentNum);
      if (prior.length > 0) {
        scopedCandidates = prior;
      }
    } else if (currentIndex > 0) {
      const prior = candidates.filter((s) => {
        const idx = allSteps.indexOf(s);
        return idx >= 0 && idx < currentIndex;
      });
      if (prior.length > 0) {
        scopedCandidates = prior;
      }
    }

    const getFormWeight = (s: ProjectStep): number => {
      const fcode = (s.form_code || '').toUpperCase();
      const name = (s.step_name || '').toLowerCase();
      if (fcode === 'FORM_36_BID_DOC_ICB' || (name.includes('bid doc') && (name.includes('icb') || name.includes('international')))) return 55;
      if (fcode === 'FORM_35_ICB' || name.includes('international competitive') || name.startsWith('icb')) return 50;
      if (fcode === 'FORM_29_BID_DOC_TECHNO_COMMERCIAL' || (name.includes('bid doc') && (name.includes('techno') || name.includes('commercial')))) return 45;
      if (fcode === 'FORM_30_TECHNO_COMMERCIAL_TENDER' || name.includes('techno commercial') || name.startsWith('techno')) return 40;
      if (fcode === 'FORM_34_BID_DOC_STE' || (name.includes('bid doc') && (name.includes('ste') || name.includes('single tender')))) return 35;
      if (fcode === 'FORM_33_STE' || fcode === 'FORM_30_STE' || fcode === 'FORM_STE' || name.includes('single tender') || name.startsWith('ste')) return 30;
      if (fcode === 'FORM_31_BID_DOC_LTE' || (name.includes('bid doc') && (name.includes('lte') || name.includes('limited tender')))) return 25;
      if (fcode === 'FORM_04_LTE' || name.includes('limited tender') || name.startsWith('lte')) return 20;
      if (fcode === 'FORM_13_PAC_TENDER' || name.includes('pac tender') || name.startsWith('pac')) return 18;
      if (fcode === 'FORM_07_EOI' || name.includes('expression of interest') || name.startsWith('eoi')) return 15;
      if (fcode === 'FORM_01_PQB' || name.includes('pre') || name.includes('pqb')) return 10;
      return 1;
    };

    const sorted = [...scopedCandidates].sort((a, b) => {
      // 1. Prefer steps with actual tender data over completely empty shells
      const hasDataA = this.hasTenderData(a) ? 1 : 0;
      const hasDataB = this.hasTenderData(b) ? 1 : 0;
      if (hasDataA !== hasDataB) return hasDataB - hasDataA;

      // 2. Highest step order / number among candidates (closest preceding step)
      const numDiff = getStepNum(b) - getStepNum(a);
      if (numDiff !== 0) return numDiff;

      // 3. Newest timestamp wins
      const timeDiff = getStepTime(b) - getStepTime(a);
      if (timeDiff !== 0) return timeDiff;

      // 4. Completed steps preferred over pending
      if (a.status === 'completed' && b.status !== 'completed') return -1;
      if (b.status === 'completed' && a.status !== 'completed') return 1;

      // 5. Form workflow weight
      const weightDiff = getFormWeight(b) - getFormWeight(a);
      if (weightDiff !== 0) return weightDiff;

      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    return sorted[0];
  }

  loadFromPreviousTenderStep(showNotification = true): void {
    if (typeof this.fetchingPreviousStep === 'function' && this.fetchingPreviousStep()) return;
    const pId = typeof this.projectId === 'function' ? this.projectId() : (this.projectId as unknown as number);
    if (!pId) return;

    const inMemory = typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
    const currentStep = typeof this.step === 'function' ? this.step() : null;
    const candidateInMemory = (inMemory && inMemory.length > 0)
      ? this.findPrecedingTenderStep(inMemory, currentStep)
      : undefined;

    if (candidateInMemory) {
      this.fetchAndApplyTenderStep(pId, candidateInMemory, showNotification);
      return;
    }

    // If candidate not in memory, query project steps or fallback directly to backend /latest endpoints
    this.fetchingPreviousStep?.set?.(true);

    if (this.projectStepService) {
      this.projectStepService.getSteps(pId).pipe(
        catchError(() => of([] as ProjectStep[])),
      ).subscribe({
        next: (allSteps) => {
          const candidateFromSteps = this.findPrecedingTenderStep(allSteps || [], currentStep);
          if (candidateFromSteps) {
            this.fetchAndApplyTenderStep(pId, candidateFromSteps, showNotification);
          } else {
            this.fetchLatestTenderFromBackend(pId, showNotification);
          }
        },
        error: () => {
          this.fetchLatestTenderFromBackend(pId, showNotification);
        },
      });
    } else {
      this.fetchLatestTenderFromBackend(pId, showNotification);
    }
  }

  private fetchAndApplyTenderStep(
    pId: number,
    targetStep: ProjectStep,
    showNotification: boolean,
  ): void {
    const targetDef = targetStep.form_code
      ? getFormDefinition(targetStep.form_code)
      : targetStep.step_name
        ? getFormDefinition(targetStep.step_name)
        : undefined;
    const selectedStep = targetStep;

    this.fetchingPreviousStep?.set?.(true);
    const fetchTarget$: Observable<ProjectStep> = (targetDef?.apiEndpoint && this.formApiService)
      ? this.formApiService.getLatestEntry(targetDef, pId).pipe(
          map((latestStep: ProjectStep | null): ProjectStep => {
            if (latestStep) {
              return {
                ...selectedStep,
                ...latestStep,
                data: {
                  ...((selectedStep.data as Record<string, unknown>) || {}),
                  ...((latestStep.data as Record<string, unknown>) || {}),
                },
              };
            }
            return selectedStep;
          }),
          catchError(() => of(selectedStep)),
        )
      : of(selectedStep);

    fetchTarget$.pipe(
      finalize(() => this.fetchingPreviousStep?.set?.(false)),
    ).subscribe({
      next: (detailedStep: ProjectStep) => {
        const activeStep = detailedStep || selectedStep;
        if (this.hasTenderData(activeStep)) {
          this.applyPreviousStepToCorrigendum(activeStep, showNotification);
        } else {
          // If in-memory step or its /latest endpoint returned 0 tender data, fall back to probe backend for other tender steps (LTE, PQB, STE)
          this.fetchLatestTenderFromBackend(pId, showNotification);
        }
      },
      error: () => {
        if (this.hasTenderData(selectedStep)) {
          this.applyPreviousStepToCorrigendum(selectedStep, showNotification);
        } else {
          this.fetchLatestTenderFromBackend(pId, showNotification);
        }
      },
    });
  }

  private hasTenderData(s: ProjectStep | null | undefined): boolean {
    if (!s) return false;
    const d = (s.data as Record<string, unknown>) || {};
    const rec = s as unknown as Record<string, unknown>;
    return Boolean(
      d['tender_title'] ||
      d['pqb_title'] ||
      d['lte_title'] ||
      d['ste_title'] ||
      d['eoi_title'] ||
      d['icb_title'] ||
      d['pac_title'] ||
      d['techno_title'] ||
      d['ref_title'] ||
      d['title'] ||
      d['bid_title'] ||
      d['tender_enquiry_no'] ||
      d['tender_no'] ||
      d['pqb_no'] ||
      d['eoi_no'] ||
      d['ste_no'] ||
      d['lte_no'] ||
      d['icb_no'] ||
      d['pac_no'] ||
      d['against_ref_no'] ||
      rec['tender_title'] ||
      rec['tender_enquiry_no'] ||
      rec['pqb_title'] ||
      rec['eoi_title'] ||
      rec['icb_title'] ||
      rec['pac_title'] ||
      (Array.isArray(d['items']) && d['items'].length > 0) ||
      (Array.isArray(d['requirements']) && d['requirements'].length > 0) ||
      (Array.isArray(d['table_items']) && d['table_items'].length > 0)
    );
  }

  private fetchLatestTenderFromBackend(pId: number, showNotification: boolean): void {
    this.fetchingPreviousStep?.set?.(true);

    const icbBidDocDef = getFormDefinition('FORM_36_BID_DOC_ICB');
    const icbDef = getFormDefinition('FORM_35_ICB');
    const technoBidDocDef = getFormDefinition('FORM_29_BID_DOC_TECHNO_COMMERCIAL');
    const technoDef = getFormDefinition('FORM_30_TECHNO_COMMERCIAL_TENDER');
    const pacDef = getFormDefinition('FORM_13_PAC_TENDER');
    const eoiDef = getFormDefinition('FORM_07_EOI');
    const pqbBidDocDef = getFormDefinition('FORM_02_PQB_BID_DOCUMENT');
    const pqbDef = getFormDefinition('FORM_01_PQB');
    const lteBidDocDef = getFormDefinition('FORM_31_BID_DOC_LTE');
    const lteDef = getFormDefinition('FORM_04_LTE');
    const steBidDocDef = getFormDefinition('FORM_34_BID_DOC_STE');
    const steDef = getFormDefinition('FORM_33_STE');
    const corrDef = getFormDefinition('FORM_03_CORRIGENDUM');

    if (!this.formApiService) {
      this.fetchingPreviousStep?.set?.(false);
      this.ensureCorrigendumDefaultRows();
      if (showNotification) {
        this.messageService?.add({
          severity: 'info',
          summary: 'Preceding Tender Step Not Found',
          detail:
            'No preceding ICB, Techno Commercial Tender, PAC Tender, EOI, National Pre-Qualification Bid (PQB), LTE, or STE step found. Initialized default comparison rows.',
        });
      }
      return;
    }

    forkJoin({
      icbBidDoc: icbBidDocDef ? this.formApiService.getLatestEntry(icbBidDocDef, pId).pipe(catchError(() => of(null))) : of(null),
      icb: icbDef ? this.formApiService.getLatestEntry(icbDef, pId).pipe(catchError(() => of(null))) : of(null),
      technoBidDoc: technoBidDocDef ? this.formApiService.getLatestEntry(technoBidDocDef, pId).pipe(catchError(() => of(null))) : of(null),
      techno: technoDef ? this.formApiService.getLatestEntry(technoDef, pId).pipe(catchError(() => of(null))) : of(null),
      pac: pacDef ? this.formApiService.getLatestEntry(pacDef, pId).pipe(catchError(() => of(null))) : of(null),
      eoi: eoiDef ? this.formApiService.getLatestEntry(eoiDef, pId).pipe(catchError(() => of(null))) : of(null),
      pqbBidDoc: pqbBidDocDef ? this.formApiService.getLatestEntry(pqbBidDocDef, pId).pipe(catchError(() => of(null))) : of(null),
      pqb: pqbDef ? this.formApiService.getLatestEntry(pqbDef, pId).pipe(catchError(() => of(null))) : of(null),
      lteBidDoc: lteBidDocDef ? this.formApiService.getLatestEntry(lteBidDocDef, pId).pipe(catchError(() => of(null))) : of(null),
      lte: lteDef ? this.formApiService.getLatestEntry(lteDef, pId).pipe(catchError(() => of(null))) : of(null),
      steBidDoc: steBidDocDef ? this.formApiService.getLatestEntry(steBidDocDef, pId).pipe(catchError(() => of(null))) : of(null),
      ste: steDef ? this.formApiService.getLatestEntry(steDef, pId).pipe(catchError(() => of(null))) : of(null),
      corr: corrDef ? this.formApiService.getLatestEntry(corrDef, pId).pipe(catchError(() => of(null))) : of(null),
    }).pipe(
      finalize(() => this.fetchingPreviousStep?.set?.(false)),
    ).subscribe({
      next: (results) => {
        const candidates = [
          results.icbBidDoc,
          results.icb,
          results.technoBidDoc,
          results.techno,
          results.pac,
          results.eoi,
          results.steBidDoc,
          results.lteBidDoc,
          results.ste,
          results.lte,
          results.pqbBidDoc,
          results.pqb,
          results.corr,
        ].filter((s): s is ProjectStep => Boolean(s && this.hasTenderData(s)));

        let activeStep: ProjectStep | null = null;
        if (candidates.length > 0) {
          const getStepTime = (s: ProjectStep): number => {
            const dtStr = s.updated_at || s.created_at || s.completed_at;
            if (dtStr) {
              const t = new Date(dtStr).getTime();
              if (!isNaN(t) && t > 0) return t;
            }
            return 0;
          };

          const sorted = [...candidates].sort((a, b) => {
            const timeDiff = getStepTime(b) - getStepTime(a);
            if (timeDiff !== 0) return timeDiff;
            return (Number(b.id) || 0) - (Number(a.id) || 0);
          });
          activeStep = sorted[0];
        }

        if (activeStep) {
          this.applyPreviousStepToCorrigendum(activeStep, showNotification);
        } else {
          this.ensureCorrigendumDefaultRows();
          if (showNotification) {
            this.messageService?.add({
              severity: 'info',
              summary: 'Preceding Tender Step Not Found',
              detail:
                'No preceding ICB, Techno Commercial Tender, PAC Tender, EOI, National Pre-Qualification Bid (PQB), LTE, or STE step found. Initialized default comparison rows.',
            });
          }
        }
      },
      error: () => {
        this.ensureCorrigendumDefaultRows();
        if (showNotification) {
          this.messageService?.add({
            severity: 'info',
            summary: 'Preceding Tender Step Not Found',
            detail:
              'No preceding ICB, Techno Commercial Tender, PAC Tender, EOI, National Pre-Qualification Bid (PQB), LTE, or STE step found. Initialized default comparison rows.',
          });
        }
      },
    });
  }

  private applyPreviousStepToCorrigendum(targetStep: ProjectStep, showNotification: boolean): void {
    let stepData: Record<string, unknown> = {};
    if (typeof targetStep.data === 'string') {
      try {
        stepData = JSON.parse(targetStep.data);
      } catch {
        stepData = {};
      }
    } else if (targetStep.data && typeof targetStep.data === 'object') {
      stepData = { ...(targetStep.data as Record<string, unknown>) };
    }
    const stepRec = targetStep as unknown as Record<string, unknown>;

    // 1. Extract Title: EOI / PQB / Tender Title
    const title = String(
      stepData['tender_title'] ||
        stepData['icb_title'] ||
        stepData['techno_title'] ||
        stepData['pac_title'] ||
        stepData['lte_title'] ||
        stepData['ste_title'] ||
        stepData['pqb_title'] ||
        stepData['eoi_title'] ||
        stepData['title'] ||
        stepData['bid_title'] ||
        stepRec['tender_title'] ||
        stepRec['icb_title'] ||
        stepRec['techno_title'] ||
        stepRec['pac_title'] ||
        stepRec['lte_title'] ||
        stepRec['ste_title'] ||
        stepRec['pqb_title'] ||
        stepRec['eoi_title'] ||
        stepRec['title'] ||
        (typeof this.effectiveProjectTitle === 'function' ? this.effectiveProjectTitle() : '') ||
        '',
    ).trim();

    // 2. Extract Ref No: Against EOI / PQB / Tender No.
    const refNo = String(
      stepData['tender_enquiry_no'] ||
        stepData['tender_no'] ||
        stepData['icb_no'] ||
        stepData['ste_no'] ||
        stepData['lte_no'] ||
        stepData['pac_no'] ||
        stepData['eoi_no'] ||
        stepData['pqb_no'] ||
        stepData['against_tender_no'] ||
        stepData['against_ref_no'] ||
        stepData['bid_no'] ||
        stepData['bid_number'] ||
        stepData['number'] ||
        stepRec['tender_enquiry_no'] ||
        stepRec['tender_no'] ||
        stepRec['icb_no'] ||
        stepRec['ste_no'] ||
        stepRec['lte_no'] ||
        stepRec['pac_no'] ||
        stepRec['eoi_no'] ||
        stepRec['pqb_no'] ||
        '',
    ).trim();

    // 3. Extract Closing Date & Time
    const rawClosing =
      stepData['closing_date_time'] ||
      stepData['pqb_closing_date_time'] ||
      stepData['bid_submission_due_date_time'] ||
      stepData['eoi_closing_date_time'] ||
      stepData['bid_submission_date'] ||
      stepRec['closing_date_time'] ||
      stepRec['pqb_closing_date_time'] ||
      stepRec['bid_submission_due_date_time'] ||
      stepRec['eoi_closing_date_time'] ||
      stepRec['bid_submission_date'];
    let closingStr = '';
    if (rawClosing) {
      const dt = parseLocalDateTime(rawClosing as string | Date) || parseLocalDate(rawClosing as string | Date);
      const formattedD = dt ? formatDisplayDate(dt, 'dd-MM-yyyy') : '';
      const hasTime = rawClosing.toString().includes('T') || rawClosing.toString().includes(':');
      const timePart = dt && hasTime ? ` ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '';
      closingStr = formattedD ? `${formattedD}${timePart}` : String(rawClosing);
    }

    // 4. Extract Opening Date & Time
    const rawOpening =
      stepData['opening_date_time'] ||
      stepData['pqb_opening_date_time'] ||
      stepData['bid_opening_date_time'] ||
      stepData['eoi_opening_date_time'] ||
      stepRec['opening_date_time'] ||
      stepRec['pqb_opening_date_time'] ||
      stepRec['bid_opening_date_time'] ||
      stepRec['eoi_opening_date_time'];
    let openingStr = '';
    if (rawOpening) {
      const dt = parseLocalDateTime(rawOpening as string | Date) || parseLocalDate(rawOpening as string | Date);
      const formattedD = dt ? formatDisplayDate(dt, 'dd-MM-yyyy') : '';
      const hasTime = rawOpening.toString().includes('T') || rawOpening.toString().includes(':');
      const timePart = dt && hasTime ? ` ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '';
      openingStr = formattedD ? `${formattedD}${timePart}` : String(rawOpening);
    }

    // 5. Extract Quantity / Table
    const rawItems = (stepData['items'] || stepData['requirements'] || stepData['table_items'] || stepData['materials'] || stepRec['items'] || stepRec['requirements'] || []) as Array<Record<string, unknown>>;
    let qtySummary = '';
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      const lines = rawItems.map((it, idx) => {
        const desc = it['description'] || it['material_name'] || it['item_name'] || it['name'] || `Item ${idx + 1}`;
        const qty = it['quantity'] !== undefined && it['quantity'] !== null ? it['quantity'] : '';
        const unit = it['unit'] ? ` ${it['unit']}` : '';
        return qty !== '' ? `${idx + 1}. ${desc} - Qty: ${qty}${unit}` : `${idx + 1}. ${desc}`;
      });
      qtySummary = ' ' + lines.join(', ');
    }

    // 6. Extract Payment Terms
    const payTerms = String(
      stepData['payment_terms'] ||
        stepData['payment_term'] ||
        stepRec['payment_terms'] ||
        stepRec['payment_term'] ||
        '',
    ).trim();

    // 7. Extract EMD
    const rawEmd =
      stepData['emd'] ??
      stepData['emd_amount'] ??
      stepData['earnest_money_deposit'] ??
      stepRec['emd'] ??
      stepRec['emd_amount'];
    let emdStr = '';
    if (rawEmd !== undefined && rawEmd !== null && rawEmd !== '') {
      const numEmd = Number(rawEmd);
      emdStr = !isNaN(numEmd) ? `₹ ${numEmd.toLocaleString('en-IN')}` : String(rawEmd);
    }

    // 8. Extract Delivery Schedule
    const delScheduleRaw = String(stepData['delivery_schedule'] || stepRec['delivery_schedule'] || '').trim();
    const delPeriod = String(stepData['delivery_period'] || stepRec['delivery_period'] || '').trim();
    const delTerms = String(stepData['delivery_terms'] || stepRec['delivery_terms'] || '').trim();
    let delSchedule = delScheduleRaw;
    if (!delSchedule) {
      if (delPeriod && delTerms) {
        delSchedule = `${delPeriod} (${delTerms})`;
      } else {
        delSchedule = delPeriod || delTerms;
      }
    }

    // 9. Extract Tender Fee
    const rawFee = stepData['tender_fee'] ?? stepRec['tender_fee'];
    let feeStr = '';
    if (rawFee !== undefined && rawFee !== null && rawFee !== '') {
      const numFee = Number(rawFee);
      feeStr = !isNaN(numFee) ? `₹ ${numFee.toLocaleString('en-IN')}` : String(rawFee);
    }

    // 10. Extract Technical Specification
    const techSpec = String(
      stepData['technical_specifications'] ||
        stepData['technical_specification'] ||
        stepData['specification'] ||
        stepData['specifications'] ||
        stepRec['technical_specifications'] ||
        stepRec['technical_specification'] ||
        '',
    ).trim();

    // Patch form header controls
    const fg = this.formGroup();
    if (fg) {
      const patchObj: Record<string, unknown> = {};
      if (title && fg.get('ref_title')) {
        patchObj['ref_title'] = title;
      }
      if (refNo && fg.get('against_ref_no')) {
        patchObj['against_ref_no'] = refNo;
      }
      fg.patchValue(patchObj);
      fg.markAsDirty();
    }

    // Build the 8 template rows as shown in photo
    const templateSpecs = [
      {
        sr_no: 1,
        header: 'CLOSING DATE & TIME:',
        val: closingStr,
      },
      {
        sr_no: 2,
        header: 'OPENING DATE & TIME:',
        val: openingStr,
      },
      {
        sr_no: 3,
        header: 'QUANTITY: (TABLE)',
        val: qtySummary,
      },
      {
        sr_no: 4,
        header: 'PAYMENT TERMS:',
        val: payTerms,
      },
      {
        sr_no: 5,
        header: 'EMD:',
        val: emdStr,
      },
      {
        sr_no: 6,
        header: 'DELIVERY SCHEDULE:',
        val: delSchedule,
      },
      {
        sr_no: 7,
        header: 'TENDER FEE',
        val: feeStr,
      },
      {
        sr_no: 8,
        header: 'TECHNICAL SPECIFICATION:',
        val: techSpec,
      },
    ];

    const def = typeof this.resolvedDef === 'function' ? this.resolvedDef() : null;
    if (!def || !def.tableConfig) return;

    const existingRows = (this.tableFormArray().value || []) as Array<Record<string, unknown>>;
    const rowsArray = new FormArray<FormGroup>([]);

    for (const spec of templateSpecs) {
      const existingMatch = existingRows.find((r) => Number(r['sr_no']) === spec.sr_no) || existingRows[spec.sr_no - 1];

      // AS PER EOI/PQB/TENDER DOCUMENT column data
      const docData = spec.val ? `${spec.header} ${spec.val}`.trim() : spec.header;

      // AS PER CORRIGENDUM column data (preserve user edits if they entered anything beyond the header, or initialize with header)
      let corrData = spec.header;
      if (existingMatch && existingMatch['as_per_corrigendum']) {
        const existingVal = String(existingMatch['as_per_corrigendum']).trim();
        if (existingVal && existingVal !== spec.header) {
          corrData = existingVal;
        }
      }

      rowsArray.push(
        this.createTableRowGroup(def, {
          sr_no: spec.sr_no,
          as_per_tender_doc: docData,
          as_per_corrigendum: corrData,
        }),
      );
    }

    // If there were any extra rows beyond 8 added by user, preserve them
    if (existingRows.length > 8) {
      for (let i = 8; i < existingRows.length; i++) {
        rowsArray.push(this.createTableRowGroup(def, existingRows[i]));
      }
    }

    this.linkedTenderStep?.set?.(targetStep);
    if (typeof this.tableFormArray?.set === 'function') {
      this.tableFormArray.set(rowsArray);
    }
    this.tableVersion?.update?.((v) => v + 1);
    this.formVersion?.update?.((v) => v + 1);
    this.cdr?.markForCheck?.();

    if (showNotification) {
      const defName = targetStep.form_code ? getFormDefinition(targetStep.form_code)?.name : null;
      const stepName = (targetStep.step_name && !targetStep.step_name.toLowerCase().includes('previous tender') && !targetStep.step_name.toLowerCase().includes('preceding tender'))
        ? targetStep.step_name
        : (defName || 'National Pre-Qualification Bid (PQB)');
      this.messageService.add({
        severity: 'success',
        summary: `Linked from ${stepName}`,
        detail: `Corrigendum linked to ${stepName}${refNo ? ' (' + refNo + ')' : ''}. Patched Title, Tender No, and comparison parameters.`,
      });
    }
  }

  private resolveLinkedTenderStepForCorrigendum(): void {
    if (this.isResolvingCorrigendum) return;
    const pId = typeof this.projectId === 'function' ? this.projectId() : (this.projectId as unknown as number);
    if (!pId) return;

    const inMemory = typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
    const currentStep = typeof this.step === 'function' ? this.step() : null;
    const candidateInMemory = (inMemory && inMemory.length > 0)
      ? this.findPrecedingTenderStep(inMemory, currentStep)
      : undefined;

    if (candidateInMemory) {
      this.linkedTenderStep.set(candidateInMemory);
      this.cdr.markForCheck();
      return;
    }

    if (!this.projectStepService) return;

    this.isResolvingCorrigendum = true;
    this.projectStepService.getSteps(pId).pipe(
      catchError(() => of([] as ProjectStep[])),
      finalize(() => {
        this.isResolvingCorrigendum = false;
      }),
    ).subscribe({
      next: (allSteps) => {
        const candidate = this.findPrecedingTenderStep(allSteps || [], currentStep);
        if (candidate) {
          this.linkedTenderStep.set(candidate);
          this.cdr.markForCheck();
        }
      },
    });
  }

  private matchAndSetLinkedTenderStep(allSteps: ProjectStep[]): void {
    const currentStep = typeof this.step === 'function' ? this.step() : null;
    const targetStep = this.findPrecedingTenderStep(allSteps || [], currentStep);
    if (targetStep) {
      this.linkedTenderStep.set(targetStep);
      this.cdr.markForCheck();
    }
  }

  private ensureCorrigendumDefaultRows(): void {
    const def = typeof this.resolvedDef === 'function' ? this.resolvedDef() : null;
    if (!def || def.formCode !== 'FORM_03_CORRIGENDUM' || !def.tableConfig) return;
    if (this.tableFormArray().length > 0) return;

    const templateHeaders = [
      { sr_no: 1, header: 'CLOSING DATE & TIME:' },
      { sr_no: 2, header: 'OPENING DATE & TIME:' },
      { sr_no: 3, header: 'QUANTITY: (TABLE)' },
      { sr_no: 4, header: 'PAYMENT TERMS:' },
      { sr_no: 5, header: 'EMD:' },
      { sr_no: 6, header: 'DELIVERY SCHEDULE:' },
      { sr_no: 7, header: 'TENDER FEE' },
      { sr_no: 8, header: 'TECHNICAL SPECIFICATION:' },
    ];

    const rowsArray = new FormArray<FormGroup>([]);
    for (const item of templateHeaders) {
      rowsArray.push(
        this.createTableRowGroup(def, {
          sr_no: item.sr_no,
          as_per_tender_doc: item.header,
          as_per_corrigendum: item.header,
        }),
      );
    }
    if (typeof this.tableFormArray?.set === 'function') {
      this.tableFormArray.set(rowsArray);
    }
    this.tableVersion?.update?.((v) => v + 1);
    this.cdr?.markForCheck?.();
  }

  constructor() {
    this.destroyRef?.onDestroy(() => {
      this.formStatusSub?.unsubscribe();
    });

    // Synchronize form when dialog becomes visible or step/definition changes
    effect(() => {
      const isVis = this.visible();
      const currentStep = this.step();
      const defInput = this.formDefinition();

      if (isVis) {
        untracked(() => {
          this.initializeModal(currentStep, defInput);
        });
      } else {
        untracked(() => {
          this.deleteConfirmVisible.set(false);
        });
      }
    });

    // Reactive auto-prefill for Customer, Supplier, and Project Title
    effect(() => {
      const pTitle = this.effectiveProjectTitle ? this.effectiveProjectTitle() : '';
      const cName = this.effectiveCustomerName ? this.effectiveCustomerName() : '';
      const sName = this.effectiveSupplierName ? this.effectiveSupplierName() : '';
      const fg = this.formGroup ? this.formGroup() : null;
      if (!fg) return;

      untracked(() => {
        if (pTitle) {
          for (const [key, ctrl] of Object.entries(fg.controls)) {
            if (isProjectTitleField(key) && (!ctrl.value || !String(ctrl.value).trim())) {
              ctrl.setValue(pTitle, { emitEvent: false });
            }
          }
        }

        if (cName) {
          for (const [key, ctrl] of Object.entries(fg.controls)) {
            if (isCustomerField(key) && (!ctrl.value || !String(ctrl.value).trim())) {
              ctrl.setValue(cName, { emitEvent: false });
            }
          }
        }

        if (sName) {
          for (const [key, ctrl] of Object.entries(fg.controls)) {
            if (isSupplierField(key) && (!ctrl.value || !String(ctrl.value).trim())) {
              ctrl.setValue(sName, { emitEvent: false });
            }
          }
        }
      });
    });
  }

  private initializeModal(step: ProjectStep | null, defInput: FormDefinition | null): void {
    this.activeTab.set('fields');
    this.newRemarkInput.set('');

    const pId = this.projectId();
    this.ensureProjectMetadata(pId);

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

      // GET operation to fetch freshest step state via individual form API (with /latest fallback)
      this.loading.set(true);
      const fetch$ = def?.apiEndpoint
        ? this.formApiService.getEntryById(def, stepId, pId).pipe(
            catchError(() => (pId ? this.formApiService.getLatestEntry(def, pId) : of(null))),
            map((res) => res || step),
            catchError(() => of(step)),
          )
        : of(step);

      fetch$.subscribe({
        next: (freshStep) => {
          this.loading.set(false);
          const activeStep = freshStep || step;
          let savedData: Record<string, unknown> = {};
          if (typeof activeStep.data === 'string') {
            try {
              savedData = JSON.parse(activeStep.data);
            } catch {
              savedData = {};
            }
          } else if (activeStep.data && typeof activeStep.data === 'object') {
            savedData = { ...(activeStep.data as Record<string, unknown>) };
          }
          const activeRec = activeStep as unknown as Record<string, unknown>;
          if (!savedData['items'] && Array.isArray(activeRec['items'])) {
            savedData['items'] = activeRec['items'];
          }
          this.populateForm(def!, savedData, activeStep.remarks || []);

          if (
            def!.formCode === 'FORM_10_COST_SHEET' &&
            (!savedData['items'] || (Array.isArray(savedData['items']) && savedData['items'].length === 0))
          ) {
            this.loadFromSupplierQuotation(false);
          }

          if (
            def!.formCode === 'FORM_02_PQB_BID_DOCUMENT' &&
            (!savedData['pqb_title'] || !savedData['pqb_no'])
          ) {
            this.loadFromNationalPreQualificationBid(false);
          }

          if (def!.formCode === 'FORM_03_CORRIGENDUM') {
            if (!savedData['items'] || (Array.isArray(savedData['items']) && savedData['items'].length === 0) || !savedData['against_ref_no'] || !savedData['ref_title']) {
              this.loadFromPreviousTenderStep(false);
            } else {
              this.resolveLinkedTenderStepForCorrigendum();
            }
          }
        },
        error: () => {
          this.loading.set(false);
          let savedData: Record<string, unknown> = {};
          if (typeof step.data === 'string') {
            try {
              savedData = JSON.parse(step.data);
            } catch {
              savedData = {};
            }
          } else if (step.data && typeof step.data === 'object') {
            savedData = { ...(step.data as Record<string, unknown>) };
          }
          const stepRec = step as unknown as Record<string, unknown>;
          if (!savedData['items'] && Array.isArray(stepRec['items'])) {
            savedData['items'] = stepRec['items'];
          }
          this.populateForm(def!, savedData, step.remarks || []);

          if (
            def!.formCode === 'FORM_10_COST_SHEET' &&
            (!savedData['items'] || (Array.isArray(savedData['items']) && savedData['items'].length === 0))
          ) {
            this.loadFromSupplierQuotation(false);
          }

          if (
            def!.formCode === 'FORM_02_PQB_BID_DOCUMENT' &&
            (!savedData['pqb_title'] || !savedData['pqb_no'])
          ) {
            this.loadFromNationalPreQualificationBid(false);
          }

          if (def!.formCode === 'FORM_03_CORRIGENDUM') {
            if (!savedData['items'] || (Array.isArray(savedData['items']) && savedData['items'].length === 0) || !savedData['against_ref_no'] || !savedData['ref_title']) {
              this.loadFromPreviousTenderStep(false);
            } else {
              this.resolveLinkedTenderStepForCorrigendum();
            }
          }
        },
      });
    } else if (defInput) {
      // ── ADD MODE (POST new step from catalog) ──────────────────────
      this.resolvedDef.set(defInput);
      this.populateForm(defInput, {}, []);
      if (defInput.formCode === 'FORM_10_COST_SHEET') {
        this.loadFromSupplierQuotation(false);
      }
      if (defInput.formCode === 'FORM_02_PQB_BID_DOCUMENT') {
        this.loadFromNationalPreQualificationBid(false);
      }
      if (defInput.formCode === 'FORM_03_CORRIGENDUM') {
        this.ensureCorrigendumDefaultRows();
        this.loadFromPreviousTenderStep(false);
      }
    } else {
      const fallback = FORM_CATALOG[0];
      this.resolvedDef.set(fallback);
      this.populateForm(fallback, {}, []);
    }
  }

  private ensureProjectMetadata(pId: number): void {
    if (!pId || !this.projectService) return;
    const hasProjTitle = Boolean(this.projectTitle && this.projectTitle());
    const hasCustName = Boolean(this.customerName && this.customerName());
    const hasSuppName = Boolean(this.supplierName && this.supplierName());
    if (hasProjTitle && hasCustName && hasSuppName) return;

    this.projectService.getProjectById(pId).subscribe({
      next: (p) => {
        this.fallbackProject.set(p);
        if (p.customer_id && !hasCustName && this.customerService) {
          this.customerService.getCustomerById(p.customer_id).subscribe({
            next: (c) => this.fallbackCustomer.set(c),
            error: () => {},
          });
        }
        if (p.supplier_id && !hasSuppName && this.supplierService) {
          this.supplierService.getSupplierById(p.supplier_id).subscribe({
            next: (s) => this.fallbackSupplier.set(s),
            error: () => {},
          });
        }
      },
      error: () => {
        // Fallback gracefully without loading entire project list
      },
    });
  }

  private populateForm(
    def: FormDefinition,
    savedData: Record<string, unknown>,
    existingRemarks: ProjectStepRemark[],
  ): void {
    // 1. Dynamic Catalog Form Controls
    const controls: Record<string, FormControl> = {};
    const hasCurrencySelectField = def.fields.some((f) => this.isCurrencyWithSelect(f));
    let detectedCurrency = 'INR';

    if (hasCurrencySelectField) {
      const rawUnit = savedData['currency_unit'] || savedData['currency'];
      const rawVal = savedData['quotation_value'];
      if (typeof rawUnit === 'string' && rawUnit.trim()) {
        detectedCurrency = rawUnit.trim().toUpperCase();
      } else if (typeof rawVal === 'string' && rawVal.trim()) {
        const parsed = parseCurrencyAmount(rawVal, 'INR');
        if (parsed.currency) detectedCurrency = parsed.currency;
      } else if (savedData['currency_symbol']) {
        const sym = String(savedData['currency_symbol']).trim();
        const found = Object.keys(CURRENCY_SYMBOLS).find((k) => CURRENCY_SYMBOLS[k] === sym);
        if (found) detectedCurrency = found;
      }
      this.selectedCurrency.set(detectedCurrency);
    }

    for (const field of def.fields) {
      let initialVal = savedData[field.key];
      if (
        initialVal === undefined ||
        initialVal === null ||
        (typeof initialVal === 'string' && !initialVal.trim())
      ) {
        initialVal = this.getDefaultFieldValue(field);
      }
      if (this.isCurrencyWithSelect(field) && typeof initialVal === 'string' && initialVal.trim()) {
        const parsed = parseCurrencyAmount(initialVal, detectedCurrency);
        initialVal = parsed.amount !== '' && !isNaN(Number(parsed.amount)) ? Number(parsed.amount) : parsed.amount;
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
      } else if (field.type === 'date') {
        initialVal = initialVal ? parseLocalDate(initialVal as string | Date) : null;
      } else if (field.type === 'datetime') {
        initialVal = initialVal ? parseLocalDateTime(initialVal as string | Date) : null;
      }
      const validators = field.required ? [Validators.required] : [];
      controls[field.key] = new FormControl(initialVal, validators);
    }

    if (hasCurrencySelectField) {
      controls['currency_unit'] = new FormControl(detectedCurrency);
      controls['currency_symbol'] = new FormControl(getCurrencySymbol(detectedCurrency));
    }

    const fg = new FormGroup(controls);
    this.formGroup.set(fg);
    validateDateSequence(fg, def.fields);
    this.isFormInvalid?.set?.(fg.invalid);
    this.formStatusSub?.unsubscribe();
    this.formStatusSub = fg.valueChanges?.subscribe?.(() => {
      validateDateSequence(fg, def.fields);
      this.isFormInvalid?.set?.(fg.invalid);
      this.formVersion.update((v) => v + 1);
      this.cdr.markForCheck();
    });

    if (hasCurrencySelectField) {
      fg.get('currency_unit')?.valueChanges?.subscribe((val) => {
        if (val && typeof val === 'string' && val.trim().toUpperCase() !== this.selectedCurrency()) {
          const code = val.trim().toUpperCase();
          this.selectedCurrency.set(code);
          fg.get('currency_symbol')?.setValue(getCurrencySymbol(code), { emitEvent: false });
          this.formVersion.update((v) => v + 1);
        }
      });
    }

    // 2. Line-Item Table Rows
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
    if (isCustomerField(field.key)) {
      const cust = this.effectiveCustomerName
        ? this.effectiveCustomerName()
        : this.customerName
          ? this.customerName()
          : '';
      if (cust) return cust;
    }
    if (isSupplierField(field.key)) {
      const supp = this.effectiveSupplierName
        ? this.effectiveSupplierName()
        : this.supplierName
          ? this.supplierName()
          : '';
      if (supp) return supp;
    }
    if (isProjectTitleField(field.key)) {
      const proj = this.effectiveProjectTitle
        ? this.effectiveProjectTitle()
        : this.projectTitle
          ? this.projectTitle()
          : '';
      if (proj) return proj;
    }
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

    if (def.tableConfig.totalKey && !rowControls[def.tableConfig.totalKey]) {
      const qVal = Number(initialData[def.tableConfig.quantityKey || 'quantity']) || 0;
      const pVal = Number(initialData[def.tableConfig.unitPriceKey || 'unit_price']) || 0;
      const initTot =
        initialData[def.tableConfig.totalKey] !== undefined ? initialData[def.tableConfig.totalKey] : qVal * pVal;
      rowControls[def.tableConfig.totalKey] = new FormControl(initTot);
    }

    return new FormGroup(rowControls);
  }

  // ── Table Column Layout Helpers ─────────────────────────────────────
  getColumnWidth(key: string, defaultWidth?: string): string {
    if (key === 'sr_no') return '56px';
    if (key === 'as_per_tender_doc' || key === 'as_per_corrigendum') return '440px';
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
    if (key === 'as_per_tender_doc' || key === 'as_per_corrigendum') return '280px';
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
    const def = typeof this.resolvedDef === 'function' ? this.resolvedDef() : null;
    if (!def || !def.tableConfig) return;
    const nextSr = this.tableFormArray().length + 1;
    this.tableFormArray().push(this.createTableRowGroup(def, { sr_no: nextSr }));
    this.tableVersion?.update?.((v) => v + 1);
  }

  removeTableRow(index: number): void {
    if (this.tableFormArray().length > 0) {
      this.tableFormArray().removeAt(index);
      // Re-sequence remaining row sr_no
      this.tableFormArray().controls.forEach((group, idx) => {
        group.get('sr_no')?.setValue(idx + 1);
      });
      this.tableVersion?.update?.((v) => v + 1);

      if (this.resolvedDef?.()?.formCode === 'FORM_10_COST_SHEET') {
        const totalEurCtrl = this.formGroup()?.get('total_amount_eur');
        if (totalEurCtrl) {
          const totalEur = (this.tableFormArray()?.value || []).reduce(
            (sum: number, r: Record<string, unknown>) =>
              sum + (Number(r['price_per_unit_eur']) * Number(r['quantity']) || 0),
            0,
          );
          totalEurCtrl.setValue(Number(totalEur.toFixed(2)), { emitEvent: false });
        }
      }
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
      if (!row.contains(tKey)) {
        row.addControl(tKey, new FormControl(total));
      } else {
        row.patchValue({ [tKey]: total }, { emitEvent: false });
      }
    }
    this.tableVersion.update((v) => v + 1);

    if (def.formCode === 'FORM_10_COST_SHEET') {
      const totalEurCtrl = this.formGroup()?.get('total_amount_eur');
      if (totalEurCtrl) {
        const totalEur = (this.tableFormArray()?.value || []).reduce(
          (sum: number, r: Record<string, unknown>) =>
            sum + (Number(r['price_per_unit_eur']) * Number(r['quantity']) || 0),
          0,
        );
        if (totalEur > 0) {
          totalEurCtrl.setValue(Number(totalEur.toFixed(2)), { emitEvent: false });
        }
      }
    }

    if (this.hasTableGst() && this.formGroup()?.get('gst_amount')) {
      this.formGroup().patchValue({ gst_amount: this.tableGstAmount() }, { emitEvent: false });
    }

    const qvCtrl = this.formGroup()?.get('quotation_value');
    if (qvCtrl && (!qvCtrl.value || qvCtrl.pristine)) {
      const totalAmt = this.hasTableGst() ? this.tableGrossTotalSum() : this.tableNetAmount();
      if (totalAmt > 0) {
        qvCtrl.setValue(totalAmt, { emitEvent: false });
      }
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
  saveStep(): void {
    const pId = this.projectId();
    const def = this.resolvedDef();
    if (!pId || !def) return;

    if (this.formGroup()?.invalid) {
      this.formGroup()?.markAllAsTouched?.();
      this.isFormInvalid.set(true);

      const hasDateError = def.fields.some((f) => this.formGroup()?.get?.(f.key)?.hasError?.('dateBeforeClosing'));
      if (hasDateError) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Invalid Date Sequence',
          detail: 'Opening Date & Time must be after Closing Date & Time.',
        });
        return;
      }

      this.messageService.add({
        severity: 'warn',
        summary: 'Required Fields Missing',
        detail: 'Please fill in all required fields before saving.',
      });
      return;
    }

    this.saving.set(true);

    const rawFormData: Record<string, unknown> = { ...this.formGroup().value };
    // Format multilocation fields to comma-separated string for backend compatibility
    for (const field of def.fields) {
      if (field.type === 'multilocation') {
        const val = rawFormData[field.key];
        if (Array.isArray(val)) {
          rawFormData[field.key] = val.join(', ');
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
      def.fields,
      def.tableConfig?.columns,
    );

    const { items: sanitizedItems, ...sanitizedFormData } = sanitizedPayload;

    const combinedData: Record<string, unknown> = {
      ...sanitizedFormData,
      items: (sanitizedItems ?? cleanedTableData) as unknown[],
      attachments_count: this.uploadedFiles().length,
      form_code: def.formCode,
      remarks: this.stepRemarks().map((r) => r.remark),
      status: 'completed',
    };

    if (def.fields.some((f) => this.isCurrencyWithSelect(f))) {
      const cur = this.selectedCurrency();
      combinedData['currency_unit'] = cur;
      combinedData['currency_symbol'] = getCurrencySymbol(cur);
      combinedData['currency'] = cur;
    }

    if (def.tableConfig?.autoCalculateTotal) {
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
        if (def.formCode === 'FORM_10_COST_SHEET') {
          combinedData['total_amount_eur'] = net;
        } else {
          combinedData['total_gross_amount'] = net;
          combinedData['total_amount'] = net;
        }
      }
    }

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
            const stepToCache: ProjectStep = {
              ...existingStep,
              ...updatedStep,
              id: updatedStep.id || existingStep.id,
              project_id: pId,
              form_code: def.formCode,
              step_name: def.name,
              data: {
                ...((existingStep.data as Record<string, unknown>) || {}),
                ...((updatedStep.data as Record<string, unknown>) || {}),
                ...combinedData,
              },
            };
            if (this.projectStepService) {
              this.projectStepService.addStepToLocalCache(pId, stepToCache);
            }
            this.messageService?.add({
              severity: 'success',
              summary: 'Changes Saved',
              detail: `${updatedStep.step_name || def.name} has been updated successfully.`,
            });
            this.stepSaved.emit(stepToCache);
            this.close();
          },
          error: () => {
            this.saving.set(false);
            this.messageService?.add({
              severity: 'error',
              summary: 'Save Failed',
              detail: 'Could not update step data. Please try again.',
            });
          },
        });
    } else {
      // ── POST OPERATION: Create new entry via FormApiService & attach to Project Steps ──
      this.formApiService
        .createEntry(def, pId, combinedData, rawFiles)
        .subscribe({
          next: (newStep) => {
            if (this.projectStepService) {
              this.projectStepService.addStep(pId, def.formCode, def.name, combinedData, 'completed', 100).subscribe({
                next: (addedStep) => {
                  this.saving.set(false);
                  const stepWithMeta: ProjectStep = {
                    ...newStep,
                    ...addedStep,
                    id: addedStep.id || newStep.id,
                    project_id: pId,
                    form_code: def.formCode,
                    step_name: def.name,
                    step_number: addedStep.step_number || addedStep.step_order || newStep.step_number,
                    step_order: addedStep.step_order || addedStep.step_number || newStep.step_order,
                    data: {
                      ...((newStep.data as Record<string, unknown>) || {}),
                      ...combinedData,
                    },
                  };
                  this.projectStepService?.addStepToLocalCache(pId, stepWithMeta);
                  this.messageService?.add({
                    severity: 'success',
                    summary: 'Form Attached!',
                    detail: `${def.name} has been added to the project pipeline.`,
                  });
                  this.stepSaved.emit(stepWithMeta);
                  this.close();
                },
                error: () => {
                  this.saving.set(false);
                  const fallbackStep: ProjectStep = {
                    ...newStep,
                    id: newStep.id || Date.now(),
                    project_id: pId,
                    form_code: def.formCode,
                    step_name: def.name,
                    step_number: this.step()?.step_number || newStep.step_number,
                    step_order: this.step()?.step_order || newStep.step_order,
                    data: combinedData,
                  };
                  this.projectStepService?.addStepToLocalCache(pId, fallbackStep);
                  this.messageService?.add({
                    severity: 'success',
                    summary: 'Form Attached!',
                    detail: `${def.name} has been added to the project pipeline.`,
                  });
                  this.stepSaved.emit(fallbackStep);
                  this.close();
                },
              });
            } else {
              this.saving.set(false);
              this.messageService?.add({
                severity: 'success',
                summary: 'Form Attached!',
                detail: `${def.name} has been added to the project pipeline.`,
              });
              this.stepSaved.emit(newStep);
              this.close();
            }
          },
          error: () => {
            if (this.projectStepService) {
              this.projectStepService.addStep(pId, def.formCode, def.name, combinedData, 'completed', 100).subscribe({
                next: (addedStep) => {
                  this.saving.set(false);
                  this.messageService?.add({
                    severity: 'success',
                    summary: 'Form Attached!',
                    detail: `${def.name} has been added to the project pipeline.`,
                  });
                  this.stepSaved.emit(addedStep);
                  this.close();
                },
                error: () => {
                  this.saving.set(false);
                  this.messageService?.add({
                    severity: 'error',
                    summary: 'Creation Failed',
                    detail: 'Could not attach step. Please try again.',
                  });
                },
              });
            } else {
              this.saving.set(false);
              this.messageService?.add({
                severity: 'error',
                summary: 'Creation Failed',
                detail: 'Could not attach step. Please try again.',
              });
            }
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
