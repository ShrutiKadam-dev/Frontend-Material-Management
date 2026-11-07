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

import { ProjectStep, ProjectStepRemark, StepStatus } from '../../../../../core/models/project-step.model';
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
import { PreQualificationBid } from '../../../../../core/models/pre-qualification-bid.model';
import { PreQualificationBidService } from '../../../../../core/services/pre-qualification-bid';
import { ProjectStepService } from '../../../../../core/services/project-step';

export interface CorrigendumQuantityItem {
  id?: number | string;
  sr_no: number;
  original_description: string;
  original_quantity: number | null;
  original_unit: string;
  corrigendum_description: string;
  corrigendum_quantity: number | null;
  corrigendum_unit: string;
  is_new?: boolean;
}

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
  private readonly projectStepService = inject(ProjectStepService);
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
  readonly isLimitedTenderEnquiry = computed(() => this.resolvedDef()?.formCode === 'FORM_04_LTE');
  readonly isSingleTenderEnquiry = computed(() => {
    const code = this.resolvedDef()?.formCode;
    return code === 'FORM_33_STE' || code === 'FORM_30_STE' || code === 'FORM_STE';
  });
  readonly isBidDocumentLte = computed(() => {
    const code = this.resolvedDef()?.formCode;
    if (code === 'FORM_31_BID_DOC_LTE') return true;
    const name = (this.resolvedDef()?.name || '').toLowerCase();
    return name.includes('bid doc') && (name.includes('lte') || name.includes('limited tender'));
  });
  readonly bidDocLteLinkedStep = signal<ProjectStep | null>(null);
  readonly fetchingBidDocLte = signal<boolean>(false);
  readonly bidDocLteSourceStepName = computed(() => {
    const linked = this.bidDocLteLinkedStep();
    if (linked) {
      return (
        linked.step_name ||
        (linked.form_code ? getFormDefinition(linked.form_code)?.name : null) ||
        'latest Enquiry'
      );
    }
    if (this.isSingleTenderEnquiryAvailable()) {
      return 'latest Single Tender Enquiry (STE)';
    }
    return 'latest Limited Tender Enquiry (LTE)';
  });
  readonly bidDocLteFetchButtonLabel = computed(() => {
    const linked = this.bidDocLteLinkedStep();
    if (linked) {
      const code = (linked.form_code || '').toUpperCase();
      const name = (linked.step_name || '').toLowerCase();
      if (
        code === 'FORM_33_STE' ||
        code === 'FORM_30_STE' ||
        code === 'FORM_STE' ||
        name.includes('single')
      ) {
        return 'Fetch from STE';
      }
      return 'Fetch from LTE';
    }
    if (this.isSingleTenderEnquiryAvailable()) {
      return 'Fetch from STE';
    }
    return 'Fetch from LTE';
  });
  readonly isPurchaseOrder = computed(() => {
    const code = this.resolvedDef()?.formCode;
    if (code === 'FORM_14_PURCHASE_ORDER') return true;
    const name = (this.resolvedDef()?.name || '').toLowerCase();
    return name.includes('purchase order') || name.startsWith('po ');
  });
  readonly poLinkedStep = signal<ProjectStep | null>(null);
  readonly fetchingPoData = signal<boolean>(false);
  readonly poSourceStepName = computed(() => {
    const linked = this.poLinkedStep();
    if (linked) {
      return (
        linked.step_name ||
        (linked.form_code ? getFormDefinition(linked.form_code)?.name : null) ||
        'latest Bid Document'
      );
    }
    const isSte =
      this.isBidDocSteAvailable() ||
      (!this.isBidDocLteAvailable() && this.isSingleTenderEnquiryAvailable());
    if (isSte) {
      return 'latest Bid Document - Single Tender Enquiry (STE)';
    }
    return 'latest Bid Document - Limited Tender Enquiry (LTE)';
  });
  readonly poFetchButtonLabel = computed(() => {
    const linked = this.poLinkedStep();
    if (linked) {
      if (this.isBidDocSteStep(linked)) {
        return 'Fetch from Bid Doc STE';
      }
      return 'Fetch from Bid Doc LTE';
    }
    const isSte =
      this.isBidDocSteAvailable() ||
      (!this.isBidDocLteAvailable() && this.isSingleTenderEnquiryAvailable());
    if (isSte) {
      return 'Fetch from Bid Doc STE';
    }
    return 'Fetch from Bid Doc LTE';
  });
  readonly isCorrigendum = computed(() => this.resolvedDef()?.formCode === 'FORM_03_CORRIGENDUM');
  readonly linkedTenderStep = signal<ProjectStep | null>(null);
  readonly corrigendumQuantityItems = signal<CorrigendumQuantityItem[]>([]);
  readonly corrigendumModifiedItemCount = computed(() =>
    this.corrigendumQuantityItems().filter((it) => this.isCorrigendumItemModified(it)).length,
  );
  readonly corrigendumTotalAmendedCount = computed(() => this.computeCorrigendumTotalAmendedCount());
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
  readonly linkedTenderRefNo = computed(() => this.corrigendumLinkedInfo()?.refNo || '');

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

  readonly hasCorrigendumStep = computed(() => {
    const steps = typeof this.existingSteps === 'function' ? this.existingSteps() : null;
    if (steps && steps.length > 0) {
      return steps.some(
        (s) =>
          s.form_code === 'FORM_03_CORRIGENDUM' ||
          (s.step_name && s.step_name.toLowerCase().includes('corrigendum')),
      );
    }
    return false;
  });

  getPqbSourceStepName(): string {
    const isLte = typeof this.isLimitedTenderEnquiry === 'function'
      ? this.isLimitedTenderEnquiry()
      : this.resolvedDef()?.formCode === 'FORM_04_LTE';
    const isSte = typeof this.isSingleTenderEnquiry === 'function'
      ? this.isSingleTenderEnquiry()
      : (this.resolvedDef()?.formCode === 'FORM_33_STE' || this.resolvedDef()?.formCode === 'FORM_30_STE' || this.resolvedDef()?.formCode === 'FORM_STE');
    if (isLte || isSte) {
      return 'latest National Pre-Qualification Bid (PQB)';
    }
    return this.hasCorrigendumStep()
      ? 'latest Corrigendum'
      : 'latest National Pre-Qualification Bid (PQB)';
  }

  getPqbFetchButtonLabel(): string {
    const isLte = typeof this.isLimitedTenderEnquiry === 'function'
      ? this.isLimitedTenderEnquiry()
      : this.resolvedDef()?.formCode === 'FORM_04_LTE';
    const isSte = typeof this.isSingleTenderEnquiry === 'function'
      ? this.isSingleTenderEnquiry()
      : (this.resolvedDef()?.formCode === 'FORM_33_STE' || this.resolvedDef()?.formCode === 'FORM_30_STE' || this.resolvedDef()?.formCode === 'FORM_STE');
    if (isLte || isSte) {
      return 'Fetch from National PQB';
    }
    return this.hasCorrigendumStep()
      ? 'Fetch from Corrigendum'
      : 'Fetch from National PQB';
  }

  readonly pqbSourceStepName = computed(() => this.getPqbSourceStepName());
  readonly pqbFetchButtonLabel = computed(() => this.getPqbFetchButtonLabel());

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
    const isCorr = typeof this.isCorrigendum === 'function'
      ? this.isCorrigendum()
      : (typeof this.resolvedDef === 'function' ? this.resolvedDef()?.formCode === 'FORM_03_CORRIGENDUM' : false);
    if (isCorr) {
      if (col.key === 'as_per_tender_doc') return 'AS PER TENDER DOCUMENT (BASELINE)';
      if (col.key === 'as_per_corrigendum') return 'AS PER CORRIGENDUM (UPDATES)';
    }
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

  extractCorrigendumItems(
    corr: Record<string, unknown> | null,
  ): Array<{ description: string; quantity: number | null; unit?: string; hsn_sac?: string }> {
    if (!corr) return [];

    const rawQItems = (corr['corrigendum_quantity_items'] || corr['quantity_items']) as
      | Array<Record<string, unknown>>
      | undefined;
    if (Array.isArray(rawQItems) && rawQItems.length > 0) {
      return rawQItems.map((q) => ({
        description: String(
          q['corrigendum_description'] || q['description'] || q['original_description'] || '',
        ).trim(),
        quantity:
          q['corrigendum_quantity'] !== null && q['corrigendum_quantity'] !== undefined
            ? Number(q['corrigendum_quantity'])
            : q['quantity'] !== null && q['quantity'] !== undefined
              ? Number(q['quantity'])
              : q['original_quantity'] !== null && q['original_quantity'] !== undefined
                ? Number(q['original_quantity'])
                : null,
        unit: String(q['corrigendum_unit'] || q['unit'] || q['original_unit'] || '').trim(),
        hsn_sac: String(q['hsn_sac'] || '').trim(),
      }));
    }

    if (Array.isArray(corr['items'])) {
      const rawCorrItems = corr['items'] as Array<Record<string, unknown>>;
      const row3 = rawCorrItems.find((r) => Number(r['sr_no']) === 3);
      if (row3) {
        const parsed = this.parseQuantityItemsFromRow(row3);
        if (parsed.length > 0) {
          return parsed.map((p) => ({
            description: p.corrigendum_description || p.original_description,
            quantity: p.corrigendum_quantity !== null ? p.corrigendum_quantity : p.original_quantity,
            unit: p.corrigendum_unit || p.original_unit,
            hsn_sac: '',
          }));
        }
      } else if (rawCorrItems.some((it) => it['description'] && it['quantity'] !== undefined)) {
        return rawCorrItems.map((it) => ({
          description: String(it['description'] || '').trim(),
          quantity:
            it['quantity'] !== null && it['quantity'] !== undefined ? Number(it['quantity']) : null,
          unit: String(it['unit'] || '').trim(),
          hsn_sac: String(it['hsn_sac'] || '').trim(),
        }));
      }
    }

    return [];
  }

  populatePqbPricingTable(items: Array<Record<string, unknown>>): void {
    const def = typeof this.resolvedDef === 'function' ? this.resolvedDef() : null;
    if (!def || !def.tableConfig) return;

    const rowsArray = new FormArray<FormGroup>([]);
    items.forEach((item, idx) => {
      const desc = String(
        item['corrigendum_description'] ||
        item['description'] ||
        item['original_description'] ||
        item['material_name'] ||
        `Item ${idx + 1}`,
      ).trim();
      const qty =
        item['corrigendum_quantity'] !== null && item['corrigendum_quantity'] !== undefined
          ? Number(item['corrigendum_quantity'])
          : item['quantity'] !== null && item['quantity'] !== undefined
            ? Number(item['quantity'])
            : item['original_quantity'] !== null && item['original_quantity'] !== undefined
              ? Number(item['original_quantity'])
              : null;
      const unit = String(
        item['corrigendum_unit'] ||
        item['unit'] ||
        item['original_unit'] ||
        item['uom'] ||
        '',
      ).trim();
      const hsn = String(item['hsn_sac'] || item['hsn_code'] || '').trim();
      const unitPrice =
        item['unit_price'] !== null && item['unit_price'] !== undefined ? Number(item['unit_price']) : null;
      const totalAmt = qty !== null && unitPrice !== null ? qty * unitPrice : null;

      rowsArray.push(
        this.createTableRowGroup(def, {
          sr_no: idx + 1,
          description: desc,
          unit: unit,
          hsn_sac: hsn,
          quantity: qty,
          unit_price: unitPrice,
          total_amount: totalAmt,
          ...item,
        }),
      );
    });

    if (rowsArray.length > 0) {
      this.tableFormArray.set(rowsArray);
      this.tableVersion.update((v) => v + 1);
      this.cdr.markForCheck();
    }
  }

  isCorrigendumAvailable(): boolean {
    if (typeof this.hasCorrigendumStep === 'function') {
      try {
        if (this.hasCorrigendumStep()) return true;
      } catch {
        // Outside reactive context in unit test
      }
    }
    const inMemory = typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
    if (Array.isArray(inMemory) && inMemory.length > 0) {
      return inMemory.some(
        (s) =>
          s.form_code === 'FORM_03_CORRIGENDUM' ||
          (s.step_name && s.step_name.toLowerCase().includes('corrigendum')),
      );
    }
    return false;
  }

  loadFromNationalPreQualificationBid(showNotification = true): void {
    const pId = this.projectId();
    if (!pId) return;

    const isLte = typeof this.isLimitedTenderEnquiry === 'function'
      ? this.isLimitedTenderEnquiry()
      : (typeof this.resolvedDef === 'function' ? this.resolvedDef()?.formCode === 'FORM_04_LTE' : false);
    const isSte = typeof this.isSingleTenderEnquiry === 'function'
      ? this.isSingleTenderEnquiry()
      : (typeof this.resolvedDef === 'function'
        ? (this.resolvedDef()?.formCode === 'FORM_33_STE' || this.resolvedDef()?.formCode === 'FORM_30_STE' || this.resolvedDef()?.formCode === 'FORM_STE')
        : false);
    if (isLte || isSte) {
      this.fetchFromNationalPqb(pId, showNotification);
      return;
    }

    if (this.isCorrigendumAvailable()) {
      this.fetchFromCorrigendum(pId, showNotification);
    } else {
      this.fetchFromNationalPqb(pId, showNotification);
    }
  }

  private fetchFromCorrigendum(pId: number, showNotification: boolean): void {
    if (!this.formApiService) {
      this.fetchingNationalPqb.set(false);
      return;
    }

    this.fetchingNationalPqb.set(true);

    this.formApiService
      .getLatestCorrigendum(pId)
      .pipe(finalize(() => this.fetchingNationalPqb.set(false)))
      .subscribe({
        next: (corr) => {
          if (corr) {
            const corrItems = this.extractCorrigendumItems(corr);
            if (corrItems.length > 0) {
              this.populatePqbPricingTable(corrItems);
            }

            const fg = this.formGroup();
            if (fg) {
              const patchPayload: Record<string, unknown> = {};
              const refTitle = String(corr['tender_title'] || corr['ref_title'] || '').trim();
              const refNo = String(corr['against_tender_no'] || corr['against_ref_no'] || '').trim();
              if (refTitle && fg.get('pqb_title')) {
                patchPayload['pqb_title'] = refTitle;
              }
              if (refNo && fg.get('pqb_no')) {
                patchPayload['pqb_no'] = refNo;
              }

              const rawIssueDate =
                corr['tender_issue_date'] || corr['ref_issue_date'] || corr['issue_date'];
              if (rawIssueDate && fg.get('pqb_issue_date') && !fg.get('pqb_issue_date')?.value) {
                patchPayload['pqb_issue_date'] = parseLocalDate(rawIssueDate as string | Date);
              }

              const directClosing = corr['closing_date_time'] || corr['pqb_closing_date_time'];
              if (
                directClosing &&
                fg.get('pqb_closing_date_time') &&
                !fg.get('pqb_closing_date_time')?.value
              ) {
                patchPayload['pqb_closing_date_time'] = parseLocalDateTime(
                  directClosing as string | Date,
                );
              }

              const directOpening = corr['opening_date_time'] || corr['pqb_opening_date_time'];
              if (
                directOpening &&
                fg.get('pqb_opening_date_time') &&
                !fg.get('pqb_opening_date_time')?.value
              ) {
                patchPayload['pqb_opening_date_time'] = parseLocalDateTime(
                  directOpening as string | Date,
                );
              }

              if (Array.isArray(corr['items'])) {
                const rawCorrItems = corr['items'] as Array<Record<string, unknown>>;
                const row1 = rawCorrItems.find((r) => Number(r['sr_no']) === 1);
                if (
                  row1 &&
                  fg.get('pqb_closing_date_time') &&
                  !fg.get('pqb_closing_date_time')?.value
                ) {
                  const closeStr = this.extractDateFromSpecRow(
                    row1,
                    /^CLOSING\s*DATE\s*(&|AND)?\s*TIME:\s*/i,
                  );
                  if (closeStr) {
                    const dt = parseLocalDateTime(closeStr);
                    if (dt) patchPayload['pqb_closing_date_time'] = dt;
                  }
                }

                const row2 = rawCorrItems.find((r) => Number(r['sr_no']) === 2);
                if (
                  row2 &&
                  fg.get('pqb_opening_date_time') &&
                  !fg.get('pqb_opening_date_time')?.value
                ) {
                  const openStr = this.extractDateFromSpecRow(
                    row2,
                    /^OPENING\s*DATE\s*(&|AND)?\s*TIME:\s*/i,
                  );
                  if (openStr) {
                    const dt = parseLocalDateTime(openStr);
                    if (dt) patchPayload['pqb_opening_date_time'] = dt;
                  }
                }
              }

              if (fg.get('total_no_corrigendum_issued')) {
                const inMemory =
                  typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
                const count = Array.isArray(inMemory)
                  ? inMemory.filter(
                    (s) =>
                      s.form_code === 'FORM_03_CORRIGENDUM' ||
                      (s.step_name && s.step_name.toLowerCase().includes('corrigendum')),
                  ).length
                  : 0;
                patchPayload['total_no_corrigendum_issued'] = count > 0 ? count : 1;
              }

              fg.patchValue(patchPayload);
              fg.markAsDirty();
              this.formVersion.update((v) => v + 1);
              this.cdr.markForCheck();
            }

            if (showNotification) {
              this.messageService.add({
                severity: 'success',
                summary: 'Pricing Loaded from Corrigendum',
                detail: `Loaded ${corrItems.length} line items from latest Corrigendum.`,
              });
            }
          } else if (showNotification) {
            this.messageService.add({
              severity: 'warn',
              summary: 'Corrigendum Not Found',
              detail: 'No latest Corrigendum found for this project to patch.',
            });
          }
        },
        error: () => {
          if (showNotification) {
            this.messageService.add({
              severity: 'info',
              summary: 'Corrigendum Unavailable',
              detail: 'Could not fetch latest Corrigendum for this project.',
            });
          }
        },
      });
  }

  private extractDateFromSpecRow(
    row: Record<string, unknown> | undefined,
    prefixRegex: RegExp,
  ): string {
    if (!row) return '';
    const corrVal = String(row['as_per_corrigendum'] || '').replace(prefixRegex, '').trim();
    if (corrVal && !corrVal.toLowerCase().startsWith('as per')) {
      return corrVal;
    }
    const docVal = String(row['as_per_tender_doc'] || '').replace(prefixRegex, '').trim();
    if (docVal && !docVal.toLowerCase().startsWith('as per')) {
      return docVal;
    }
    return '';
  }

  private fetchFromNationalPqb(pId: number, showNotification: boolean): void {
    const pqbDef = getFormDefinition('FORM_01_PQB');
    if (!this.preQualificationBidService && (!pqbDef || !this.formApiService)) {
      this.fetchingNationalPqb.set(false);
      return;
    }

    this.fetchingNationalPqb.set(true);

    const fetchLatestPqb$: Observable<PreQualificationBid | ProjectStep | null> =
      this.preQualificationBidService && typeof this.preQualificationBidService.getLatest === 'function'
        ? this.preQualificationBidService.getLatest(pId)
        : pqbDef && this.formApiService && typeof this.formApiService.getLatestEntry === 'function'
          ? this.formApiService.getLatestEntry(pqbDef, pId)
          : of(null);

    fetchLatestPqb$
      .pipe(finalize(() => this.fetchingNationalPqb.set(false)))
      .subscribe({
        next: (pqb) => {
          const raw = (pqb || {}) as Record<string, unknown>;
          let innerData: Record<string, unknown> = {};
          if (typeof raw['data'] === 'string') {
            try {
              innerData = JSON.parse(raw['data']);
            } catch {
              innerData = {};
            }
          } else if (raw['data'] && typeof raw['data'] === 'object') {
            innerData = { ...(raw['data'] as Record<string, unknown>) };
          }
          const data = { ...innerData, ...raw };

          const title = String(
            data['pqb_title'] ||
            data['pqbTitle'] ||
            data['title'] ||
            data['tender_title'] ||
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

          const fg = this.formGroup();
          if (fg) {
            const patchPayload: Record<string, unknown> = {};
            if (title && fg.get('pqb_title')) {
              patchPayload['pqb_title'] = title;
            }
            if (no && fg.get('pqb_no')) {
              patchPayload['pqb_no'] = no;
            }
            if (title && fg.get('tender_title')) {
              patchPayload['tender_title'] = title;
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

            if (fg.get('total_no_corrigendum_issued')) {
              const curVal = fg.get('total_no_corrigendum_issued')?.value;
              if (curVal === null || curVal === undefined || curVal === '' || curVal === 0) {
                patchPayload['total_no_corrigendum_issued'] = 0;
              }
            }

            fg.patchValue(patchPayload);
            fg.markAsDirty();
            this.formVersion.update((v) => v + 1);
            this.cdr.markForCheck();
          }

          const pqbItems =
            ((data['items'] || data['table_items'] || data['requirements'] || []) as Array<
              Record<string, unknown>
            >) || [];
          if (pqbItems.length > 0) {
            this.populatePqbPricingTable(pqbItems);
            if (showNotification) {
              const isLte = (typeof this.isLimitedTenderEnquiry === 'function' && this.isLimitedTenderEnquiry()) ||
                (typeof this.resolvedDef === 'function' ? this.resolvedDef()?.formCode === 'FORM_04_LTE' : false);
              const isSte = (typeof this.isSingleTenderEnquiry === 'function' && this.isSingleTenderEnquiry()) ||
                (typeof this.resolvedDef === 'function'
                  ? (this.resolvedDef()?.formCode === 'FORM_33_STE' || this.resolvedDef()?.formCode === 'FORM_30_STE' || this.resolvedDef()?.formCode === 'FORM_STE')
                  : false);
              this.messageService.add({
                severity: 'success',
                summary: (isLte || isSte) ? 'Requirements Loaded from National PQB' : 'Pricing Loaded from National PQB',
                detail: isSte
                  ? `Loaded PQB No. "${no}", Title "${title}", and ${pqbItems.length} requirement items from latest National Pre-Qualification Bid.`
                  : isLte
                    ? `Loaded PQB No. "${no}" and ${pqbItems.length} requirement items from latest National Pre-Qualification Bid.`
                    : `Loaded ${pqbItems.length} items from latest National Pre-Qualification Bid.`,
              });
            }
          } else if (showNotification && (title || no)) {
            const isSte = (typeof this.isSingleTenderEnquiry === 'function' && this.isSingleTenderEnquiry()) ||
              (typeof this.resolvedDef === 'function'
                ? (this.resolvedDef()?.formCode === 'FORM_33_STE' || this.resolvedDef()?.formCode === 'FORM_30_STE' || this.resolvedDef()?.formCode === 'FORM_STE')
                : false);
            this.messageService.add({
              severity: 'success',
              summary: isSte ? 'STE Details Patched' : 'PQB Details Patched',
              detail: isSte
                ? `Patched Tender Title "${title}" and PQB No. "${no}" from latest National PQB.`
                : `Patched PQB Title "${title}" and PQB No. "${no}" from latest National PQB.`,
            });
          } else if (showNotification) {
            this.messageService.add({
              severity: 'warn',
              summary: 'National PQB Not Found',
              detail: 'No latest National Pre-Qualification Bid found for this project to patch.',
            });
          }
        },
        error: () => {
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

  // ── Form 31: Bid Document - Limited Tender Enquiry (LTE) ─────────────
  isLteStep(s: ProjectStep | null | undefined): boolean {
    if (!s) return false;
    const fcode = (s.form_code || '').toUpperCase().trim();
    const name = (s.step_name || '').toLowerCase().trim();
    if (name.includes('bid doc') || name.includes('bid document') || fcode.includes('BID_DOC')) return false;
    if (fcode === 'FORM_04_LTE') return true;
    const resolved = s.form_code ? getFormDefinition(s.form_code) : undefined;
    if (resolved?.formCode === 'FORM_04_LTE') return true;
    return name.includes('limited tender') || name.startsWith('lte');
  }

  isSteStep(s: ProjectStep | null | undefined): boolean {
    if (!s) return false;
    const fcode = (s.form_code || '').toUpperCase().trim();
    const name = (s.step_name || '').toLowerCase().trim();
    if (name.includes('bid doc') || name.includes('bid document') || fcode.includes('BID_DOC')) return false;
    if (fcode === 'FORM_33_STE' || fcode === 'FORM_30_STE' || fcode === 'FORM_STE') return true;
    const resolved = s.form_code ? getFormDefinition(s.form_code) : undefined;
    if (resolved?.formCode === 'FORM_33_STE') return true;
    return name.includes('single tender') || name.startsWith('ste');
  }

  isLteOrSteStep(s: ProjectStep | null | undefined): boolean {
    return this.isLteStep(s) || this.isSteStep(s);
  }

  isSingleTenderEnquiryAvailable(): boolean {
    const inMemory = typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
    if (Array.isArray(inMemory) && inMemory.length > 0) {
      return inMemory.some((s) => this.isSteStep(s));
    }
    return false;
  }

  isLimitedTenderEnquiryAvailable(): boolean {
    const inMemory = typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
    if (Array.isArray(inMemory) && inMemory.length > 0) {
      return inMemory.some((s) => this.isLteStep(s));
    }
    return false;
  }

  getAvailableEnquiryStep(): ProjectStep | null {
    const inMemory = typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
    const steps: ProjectStep[] = Array.isArray(inMemory) ? inMemory : [];

    const candidates = steps.filter((s) => this.isLteOrSteStep(s));
    if (candidates.length === 0) return null;

    return this.pickLatestLteOrSteCandidate(candidates) || candidates[0];
  }

  extractCandidateTenderTitle(s: ProjectStep | null | undefined): string {
    if (!s) return '';
    const d = (s.data as Record<string, unknown>) || {};
    const rec = s as unknown as Record<string, unknown>;
    return String(
      d['tender_title'] ||
      rec['tender_title'] ||
      d['title'] ||
      rec['title'] ||
      d['name'] ||
      rec['name'] ||
      '',
    ).trim();
  }

  hasTenderTitle(s: ProjectStep | null | undefined): boolean {
    return Boolean(this.extractCandidateTenderTitle(s));
  }

  extractCandidateTenderNo(s: ProjectStep | null | undefined): string {
    if (!s) return '';
    const d = (s.data as Record<string, unknown>) || {};
    const rec = s as unknown as Record<string, unknown>;
    return String(
      d['tender_no'] ||
      d['tender_enquiry_no'] ||
      rec['tender_no'] ||
      rec['tender_enquiry_no'] ||
      d['ste_no'] ||
      d['lte_no'] ||
      '',
    ).trim();
  }

  pickLatestLteOrSteCandidate(candidates: ProjectStep[]): ProjectStep | undefined {
    if (!candidates || candidates.length === 0) return undefined;

    const validCandidates = candidates.filter((s) => this.hasTenderTitle(s));
    const pool = validCandidates.length > 0 ? validCandidates : candidates;

    const getStepTimestamp = (s: ProjectStep): number => {
      const dtStr = s.updated_at || s.created_at || s.completed_at;
      if (dtStr) {
        const t = new Date(dtStr).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      return 0;
    };

    const getStepOrderNum = (s: ProjectStep): number => {
      return s.step_number ?? s.step_order ?? 0;
    };

    const sorted = [...pool].sort((a, b) => {
      const hasTitleA = this.hasTenderTitle(a) ? 1 : 0;
      const hasTitleB = this.hasTenderTitle(b) ? 1 : 0;
      if (hasTitleA !== hasTitleB) return hasTitleB - hasTitleA;

      const timeDiff = getStepTimestamp(b) - getStepTimestamp(a);
      if (timeDiff !== 0) return timeDiff;

      if (a.status === 'completed' && b.status !== 'completed') return -1;
      if (b.status === 'completed' && a.status !== 'completed') return 1;

      const idDiff = (Number(b.id) || 0) - (Number(a.id) || 0);
      if (idDiff !== 0) return idDiff;

      return getStepOrderNum(b) - getStepOrderNum(a);
    });

    return sorted[0];
  }

  loadForBidDocumentLte(showNotification = true): void {
    if (typeof this.fetchingBidDocLte === 'function' && this.fetchingBidDocLte()) return;
    const pId = typeof this.projectId === 'function' ? this.projectId() : (this.projectId as unknown as number);
    if (!pId) return;

    // Determine the available enquiry step in the project.
    // Call ONLY the available one (STE or LTE) - no need to call both!
    const availableStep = this.getAvailableEnquiryStep();
    const isSte = availableStep ? this.isSteStep(availableStep) : this.isSingleTenderEnquiryAvailable();

    if (isSte) {
      this.fetchFromSingleTenderEnquiry(pId, availableStep, showNotification);
    } else {
      this.fetchFromLimitedTenderEnquiry(pId, availableStep, showNotification);
    }
  }

  private fetchFromSingleTenderEnquiry(
    pId: number,
    availableStep: ProjectStep | null,
    showNotification: boolean,
  ): void {
    const steDef = getFormDefinition('FORM_33_STE');
    if (!steDef || !this.formApiService) {
      if (availableStep && this.hasTenderTitle(availableStep)) {
        this.applyEnquiryStepToBidDocLte(availableStep, showNotification);
      }
      this.fetchingBidDocLte.set(false);
      return;
    }

    this.fetchingBidDocLte.set(true);

    this.formApiService
      .getLatestEntry(steDef, pId)
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.fetchingBidDocLte.set(false)),
      )
      .subscribe({
        next: (latestSte) => {
          const candidate =
            latestSte && this.hasTenderTitle(latestSte)
              ? latestSte
              : availableStep && this.hasTenderTitle(availableStep)
                ? availableStep
                : latestSte;

          if (candidate && this.hasTenderTitle(candidate)) {
            this.applyEnquiryStepToBidDocLte(candidate, showNotification);
          } else if (showNotification) {
            this.messageService?.add({
              severity: 'warn',
              summary: 'Single Tender Enquiry Not Found',
              detail: 'No latest Single Tender Enquiry found for this project to patch Tender Title.',
            });
          }
        },
        error: () => {
          if (availableStep && this.hasTenderTitle(availableStep)) {
            this.applyEnquiryStepToBidDocLte(availableStep, showNotification);
          } else if (showNotification) {
            this.messageService?.add({
              severity: 'info',
              summary: 'Single Tender Enquiry Unavailable',
              detail: 'Could not fetch latest Single Tender Enquiry for this project.',
            });
          }
        },
      });
  }

  private fetchFromLimitedTenderEnquiry(
    pId: number,
    availableStep: ProjectStep | null,
    showNotification: boolean,
  ): void {
    const lteDef = getFormDefinition('FORM_04_LTE');
    if (!lteDef || !this.formApiService) {
      if (availableStep && this.hasTenderTitle(availableStep)) {
        this.applyEnquiryStepToBidDocLte(availableStep, showNotification);
      }
      this.fetchingBidDocLte.set(false);
      return;
    }

    this.fetchingBidDocLte.set(true);

    this.formApiService
      .getLatestEntry(lteDef, pId)
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.fetchingBidDocLte.set(false)),
      )
      .subscribe({
        next: (latestLte) => {
          const candidate =
            latestLte && this.hasTenderTitle(latestLte)
              ? latestLte
              : availableStep && this.hasTenderTitle(availableStep)
                ? availableStep
                : latestLte;

          if (candidate && this.hasTenderTitle(candidate)) {
            this.applyEnquiryStepToBidDocLte(candidate, showNotification);
          } else if (showNotification) {
            this.messageService?.add({
              severity: 'warn',
              summary: 'Limited Tender Enquiry Not Found',
              detail: 'No latest Limited Tender Enquiry found for this project to patch Tender Title.',
            });
          }
        },
        error: () => {
          if (availableStep && this.hasTenderTitle(availableStep)) {
            this.applyEnquiryStepToBidDocLte(availableStep, showNotification);
          } else if (showNotification) {
            this.messageService?.add({
              severity: 'info',
              summary: 'Limited Tender Enquiry Unavailable',
              detail: 'Could not fetch latest Limited Tender Enquiry for this project.',
            });
          }
        },
      });
  }

  private applyEnquiryStepToBidDocLte(
    step: ProjectStep,
    showNotification: boolean,
  ): void {
    const title = this.extractCandidateTenderTitle(step);
    const tenderNo = this.extractCandidateTenderNo(step);
    this.bidDocLteLinkedStep.set(step);

    const fg = this.formGroup();
    if (fg) {
      const patchPayload: Record<string, unknown> = {};
      if (title && fg.get('tender_title')) {
        patchPayload['tender_title'] = title;
      }
      if (tenderNo && fg.get('tender_no') && !fg.get('tender_no')?.value) {
        patchPayload['tender_no'] = tenderNo;
      }
      fg.patchValue(patchPayload);
      if (title) fg.get('tender_title')?.markAsDirty();
      this.formVersion.update((v) => v + 1);
      this.cdr?.markForCheck?.();
    }

    if (showNotification) {
      const sourceName =
        step.step_name ||
        (step.form_code ? getFormDefinition(step.form_code)?.name : null) ||
        'latest Enquiry';
      this.messageService?.add({
        severity: 'success',
        summary: 'Tender Title Patched',
        detail: `Tender Title "${title}" loaded from ${sourceName}.`,
      });
    }
  }

  resolveLinkedStepForBidDocLte(): void {
    if (this.bidDocLteLinkedStep()) return;
    const step = this.getAvailableEnquiryStep();
    if (step) {
      this.bidDocLteLinkedStep.set(step);
    }
  }

  // ── Purchase Order Auto-Patching (Bid Doc LTE / STE) ─────────────────
  isBidDocSteStep(s: ProjectStep | null | undefined): boolean {
    if (!s) return false;
    const fcode = (s.form_code || '').toUpperCase().trim();
    const name = (s.step_name || '').toLowerCase().trim();
    if (
      fcode === 'FORM_34_BID_DOC_STE' ||
      fcode === 'FORM_34' ||
      fcode === 'FORM_BID_DOC_STE' ||
      fcode === 'FORM_31_BID_DOC_STE' ||
      fcode === 'FORM_34_BID_DOCUMENT_STE' ||
      fcode === 'FORM_BID_DOCUMENT_STE' ||
      fcode === 'BID_DOCUMENT_STE' ||
      fcode === 'BID_DOC_STE'
    ) {
      return true;
    }
    const resolved = s.form_code ? getFormDefinition(s.form_code) : undefined;
    if (resolved?.formCode === 'FORM_34_BID_DOC_STE') return true;
    return name.includes('bid doc') && (name.includes('ste') || name.includes('single tender'));
  }

  isBidDocLteStep(s: ProjectStep | null | undefined): boolean {
    if (!s) return false;
    const fcode = (s.form_code || '').toUpperCase().trim();
    const name = (s.step_name || '').toLowerCase().trim();
    if (
      fcode === 'FORM_31_BID_DOC_LTE' ||
      fcode === 'FORM_31' ||
      fcode === 'FORM_BID_DOC_LTE' ||
      fcode === 'FORM_BID_DOCUMENT_LTE' ||
      fcode === 'BID_DOCUMENT_LTE' ||
      fcode === 'BID_DOC_LTE'
    ) {
      return true;
    }
    const resolved = s.form_code ? getFormDefinition(s.form_code) : undefined;
    if (resolved?.formCode === 'FORM_31_BID_DOC_LTE') return true;
    return name.includes('bid doc') && (name.includes('lte') || name.includes('limited tender'));
  }

  isBidDocSteAvailable(): boolean {
    const inMemory = typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
    if (Array.isArray(inMemory) && inMemory.length > 0) {
      return inMemory.some((s) => this.isBidDocSteStep(s));
    }
    return false;
  }

  isBidDocLteAvailable(): boolean {
    const inMemory = typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
    if (Array.isArray(inMemory) && inMemory.length > 0) {
      return inMemory.some((s) => this.isBidDocLteStep(s));
    }
    return false;
  }

  getAvailableBidDocStep(): ProjectStep | null {
    const inMemory = typeof this.existingSteps === 'function' ? this.existingSteps() : this.existingSteps;
    const steps: ProjectStep[] = Array.isArray(inMemory) ? inMemory : [];

    const candidates = steps.filter((s) => this.isBidDocSteStep(s) || this.isBidDocLteStep(s));
    if (candidates.length === 0) return null;

    return this.pickLatestBidDocCandidate(candidates) || candidates[0];
  }

  pickLatestBidDocCandidate(candidates: ProjectStep[]): ProjectStep | undefined {
    if (!candidates || candidates.length === 0) return undefined;

    const validCandidates = candidates.filter((s) => this.hasBidDocData(s));
    const pool = validCandidates.length > 0 ? validCandidates : candidates;

    const getStepTimestamp = (s: ProjectStep): number => {
      const dtStr = s.updated_at || s.created_at || s.completed_at;
      if (dtStr) {
        const t = new Date(dtStr).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      return 0;
    };

    const getStepOrderNum = (s: ProjectStep): number => {
      return s.step_number ?? s.step_order ?? 0;
    };

    const sorted = [...pool].sort((a, b) => {
      const hasDataA = this.hasBidDocData(a) ? 1 : 0;
      const hasDataB = this.hasBidDocData(b) ? 1 : 0;
      if (hasDataA !== hasDataB) return hasDataB - hasDataA;

      const timeDiff = getStepTimestamp(b) - getStepTimestamp(a);
      if (timeDiff !== 0) return timeDiff;

      if (a.status === 'completed' && b.status !== 'completed') return -1;
      if (b.status === 'completed' && a.status !== 'completed') return 1;

      const idDiff = (Number(b.id) || 0) - (Number(a.id) || 0);
      if (idDiff !== 0) return idDiff;

      return getStepOrderNum(b) - getStepOrderNum(a);
    });

    return sorted[0];
  }

  hasBidDocData(s: ProjectStep | null | undefined): boolean {
    if (!s) return false;
    const d = ((s.data as Record<string, unknown>) || s || {}) as Record<string, unknown>;
    const hasTerms = Boolean(
      d['delivery_terms'] ||
      d['incoterms'] ||
      d['payment_terms'] ||
      d['warranty_period'] ||
      (d['gst_pct'] !== undefined && d['gst_pct'] !== null && d['gst_pct'] !== '') ||
      (d['gst_rate_pct'] !== undefined && d['gst_rate_pct'] !== null && d['gst_rate_pct'] !== '') ||
      d['tender_title']
    );
    const items = (d['items'] || d['table_items'] || d['table_data'] || (s as unknown as Record<string, unknown>)['items']) as unknown[];
    const hasItems = Array.isArray(items) && items.length > 0;
    return hasTerms || hasItems;
  }

  populatePoItemsTable(items: Array<Record<string, unknown>>): void {
    const def = typeof this.resolvedDef === 'function' ? this.resolvedDef() : null;
    if (!def || !def.tableConfig) return;

    const rowsArray = new FormArray<FormGroup>([]);
    items.forEach((item, idx) => {
      const desc = String(
        item['description'] ||
        item['material_name'] ||
        item['item_name'] ||
        item['original_description'] ||
        item['corrigendum_description'] ||
        `Item ${idx + 1}`,
      ).trim();

      const hsn = String(item['hsn_sac'] || item['hsn_code'] || '').trim();

      const unit = String(
        item['unit'] ||
        item['uom'] ||
        item['unit_of_measurement'] ||
        item['original_unit'] ||
        item['corrigendum_unit'] ||
        'Nos',
      ).trim();

      const qty =
        item['quantity'] !== null && item['quantity'] !== undefined
          ? Number(item['quantity'])
          : item['corrigendum_quantity'] !== null && item['corrigendum_quantity'] !== undefined
            ? Number(item['corrigendum_quantity'])
            : null;

      const unitPrice =
        item['unit_price'] !== null && item['unit_price'] !== undefined
          ? Number(item['unit_price'])
          : item['price_per_unit'] !== null && item['price_per_unit'] !== undefined
            ? Number(item['price_per_unit'])
            : null;

      const totalCalculated =
        qty !== null && unitPrice !== null ? Number((qty * unitPrice).toFixed(2)) : null;

      const totalPrice =
        item['total_price'] !== null && item['total_price'] !== undefined
          ? Number(item['total_price'])
          : item['total_amount'] !== null && item['total_amount'] !== undefined
            ? Number(item['total_amount'])
            : totalCalculated;

      const deliveryDate = item['delivery_date'] ? formatLocalDate(item['delivery_date'] as Date | string) : null;

      rowsArray.push(
        this.createTableRowGroup(def, {
          sr_no: idx + 1,
          description: desc,
          hsn_sac: hsn,
          unit: unit,
          quantity: qty,
          unit_price: unitPrice,
          total_price: totalPrice,
          delivery_date: deliveryDate,
          ...item,
        }),
      );
    });

    if (rowsArray.length > 0) {
      this.tableFormArray.set(rowsArray);
      this.tableVersion.update((v) => v + 1);
      this.cdr?.markForCheck?.();
    }
  }

  loadForPurchaseOrder(showNotification = true): void {
    if (typeof this.fetchingPoData === 'function' && this.fetchingPoData()) return;
    const pId = typeof this.projectId === 'function' ? this.projectId() : (this.projectId as unknown as number);
    if (!pId) return;

    // Determine the available Bid Document step in the project.
    // Call ONLY the available one (Bid Doc STE or Bid Doc LTE) - never call both!
    const availableBidDoc = this.getAvailableBidDocStep();
    const isSte = availableBidDoc
      ? this.isBidDocSteStep(availableBidDoc)
      : this.isBidDocSteAvailable() || (!this.isBidDocLteAvailable() && this.isSingleTenderEnquiryAvailable());

    if (isSte) {
      this.fetchFromBidDocSte(pId, availableBidDoc, showNotification);
    } else {
      this.fetchFromBidDocLte(pId, availableBidDoc, showNotification);
    }
  }

  private fetchFromBidDocSte(
    pId: number,
    availableStep: ProjectStep | null,
    showNotification: boolean,
  ): void {
    const steDef = getFormDefinition('FORM_34_BID_DOC_STE');
    if (!steDef || !this.formApiService) {
      if (availableStep && this.hasBidDocData(availableStep)) {
        this.applyBidDocStepToPurchaseOrder(availableStep, showNotification);
      }
      this.fetchingPoData.set(false);
      return;
    }

    this.fetchingPoData.set(true);

    this.formApiService
      .getLatestEntry(steDef, pId)
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.fetchingPoData.set(false)),
      )
      .subscribe({
        next: (latestSte) => {
          const candidate =
            latestSte && this.hasBidDocData(latestSte)
              ? latestSte
              : availableStep && this.hasBidDocData(availableStep)
                ? availableStep
                : latestSte;

          if (candidate && this.hasBidDocData(candidate)) {
            this.applyBidDocStepToPurchaseOrder(candidate, showNotification);
          } else if (showNotification) {
            this.messageService?.add({
              severity: 'warn',
              summary: 'Bid Document (STE) Not Found',
              detail: 'No latest Bid Document - Single Tender Enquiry found for this project to patch Purchase Order.',
            });
          }
        },
        error: () => {
          if (availableStep && this.hasBidDocData(availableStep)) {
            this.applyBidDocStepToPurchaseOrder(availableStep, showNotification);
          } else if (showNotification) {
            this.messageService?.add({
              severity: 'info',
              summary: 'Bid Document (STE) Unavailable',
              detail: 'Could not fetch latest Bid Document - Single Tender Enquiry for this project.',
            });
          }
        },
      });
  }

  private fetchFromBidDocLte(
    pId: number,
    availableStep: ProjectStep | null,
    showNotification: boolean,
  ): void {
    const lteDef = getFormDefinition('FORM_31_BID_DOC_LTE');
    if (!lteDef || !this.formApiService) {
      if (availableStep && this.hasBidDocData(availableStep)) {
        this.applyBidDocStepToPurchaseOrder(availableStep, showNotification);
      }
      this.fetchingPoData.set(false);
      return;
    }

    this.fetchingPoData.set(true);

    this.formApiService
      .getLatestEntry(lteDef, pId)
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.fetchingPoData.set(false)),
      )
      .subscribe({
        next: (latestLte) => {
          const candidate =
            latestLte && this.hasBidDocData(latestLte)
              ? latestLte
              : availableStep && this.hasBidDocData(availableStep)
                ? availableStep
                : latestLte;

          if (candidate && this.hasBidDocData(candidate)) {
            this.applyBidDocStepToPurchaseOrder(candidate, showNotification);
          } else if (showNotification) {
            this.messageService?.add({
              severity: 'warn',
              summary: 'Bid Document (LTE) Not Found',
              detail: 'No latest Bid Document - Limited Tender Enquiry found for this project to patch Purchase Order.',
            });
          }
        },
        error: () => {
          if (availableStep && this.hasBidDocData(availableStep)) {
            this.applyBidDocStepToPurchaseOrder(availableStep, showNotification);
          } else if (showNotification) {
            this.messageService?.add({
              severity: 'info',
              summary: 'Bid Document (LTE) Unavailable',
              detail: 'Could not fetch latest Bid Document - Limited Tender Enquiry for this project.',
            });
          }
        },
      });
  }

  private applyBidDocStepToPurchaseOrder(
    step: ProjectStep,
    showNotification: boolean,
  ): void {
    this.poLinkedStep.set(step);
    const data = ((step.data as Record<string, unknown>) || step || {}) as Record<string, unknown>;

    const fg = this.formGroup();
    if (fg) {
      const patchPayload: Record<string, unknown> = {};

      // 1. Incoterms -> delivery_terms
      const deliveryTerms =
        data['delivery_terms'] ??
        data['incoterms'] ??
        data['delivery_term'] ??
        null;
      if (deliveryTerms !== null && deliveryTerms !== undefined && fg.get('delivery_terms')) {
        patchPayload['delivery_terms'] = deliveryTerms;
      }

      // 2. GST -> gst_rate_pct
      const gstVal =
        data['gst_rate_pct'] ??
        data['gst_pct'] ??
        data['gst'] ??
        null;
      if (gstVal !== null && gstVal !== undefined && fg.get('gst_rate_pct')) {
        patchPayload['gst_rate_pct'] = Number(gstVal);
      }

      // 3. Payment Terms -> payment_terms
      const paymentTerms =
        data['payment_terms'] ??
        data['payment_term'] ??
        null;
      if (paymentTerms && fg.get('payment_terms')) {
        patchPayload['payment_terms'] = paymentTerms;
      }

      // 4. Warranty -> warranty_period
      const warranty =
        data['warranty_period'] ??
        data['warranty'] ??
        null;
      if (warranty && fg.get('warranty_period')) {
        patchPayload['warranty_period'] = warranty;
      }

      // Optional: Customer Name and PO Title if present and blank in form
      if (data['customer_name'] && fg.get('customer_name') && !fg.get('customer_name')?.value) {
        patchPayload['customer_name'] = String(data['customer_name']).trim();
      }
      const tenderTitle = data['tender_title'] || data['po_title'];
      if (tenderTitle && fg.get('po_title') && !fg.get('po_title')?.value) {
        patchPayload['po_title'] = String(tenderTitle).trim();
      }

      if (Object.keys(patchPayload).length > 0) {
        fg.patchValue(patchPayload);
        Object.keys(patchPayload).forEach((k) => fg.get(k)?.markAsDirty());
        this.formVersion.update((v) => v + 1);
        this.cdr?.markForCheck?.();
      }
    }

    // 5. Ordered Materials/Services & Pricing TABLE DATA
    const rawItems = (
      data['items'] ||
      data['table_items'] ||
      data['table_data'] ||
      (step as unknown as Record<string, unknown>)['items'] ||
      []
    ) as Array<Record<string, unknown>>;

    if (Array.isArray(rawItems) && rawItems.length > 0) {
      this.populatePoItemsTable(rawItems);
    }

    if (showNotification) {
      const sourceName =
        step.step_name ||
        (step.form_code ? getFormDefinition(step.form_code)?.name : null) ||
        'latest Bid Document';
      const detail =
        rawItems.length > 0
          ? `Incoterms, GST, Payment Terms, Warranty, and ${rawItems.length} line items loaded from ${sourceName}.`
          : `Incoterms, GST, Payment Terms, and Warranty loaded from ${sourceName}.`;
      this.messageService?.add({
        severity: 'success',
        summary: 'Purchase Order Details Patched',
        detail,
      });
    }
  }

  resolveLinkedStepForPurchaseOrder(): void {
    if (this.poLinkedStep()) return;
    const step = this.getAvailableBidDocStep();
    if (step) {
      this.poLinkedStep.set(step);
    }
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

    // Whitelist allowed Bid Documents for Corrigendum (ICB, Techno Commercial, LTE, and STE)
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
        (currentStep.data as Record<string, unknown>)?.['against_ref_no'] ||
        (currentStep.data as Record<string, unknown>)?.['against_tender_no'] ||
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
      if (this.isNationalPqbStep(candidateInMemory)) {
        this.fetchAndApplyLatestPqbToCorrigendum(pId, candidateInMemory, showNotification);
        return;
      }
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
            if (this.isNationalPqbStep(candidateFromSteps)) {
              this.fetchAndApplyLatestPqbToCorrigendum(pId, candidateFromSteps, showNotification);
              return;
            }
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

  isNationalPqbStep(s: ProjectStep | null | undefined): boolean {
    if (!s) return false;
    const fcode = (s.form_code || '').toUpperCase().trim();
    if (fcode === 'FORM_01_PQB') return true;
    if (fcode === 'FORM_02_PQB_BID_DOCUMENT') return false;

    const resolved = s.form_code
      ? getFormDefinition(s.form_code)
      : s.step_name
        ? getFormDefinition(s.step_name)
        : undefined;

    if (resolved?.formCode === 'FORM_01_PQB') return true;
    if (resolved?.formCode === 'FORM_02_PQB_BID_DOCUMENT') return false;

    const name = (s.step_name || '').toLowerCase().trim();
    if (name.includes('bid doc') || name.includes('bid document')) return false;

    return (
      name.includes('national pre-qualification') ||
      name.includes('national pre qualification') ||
      name.includes('national pqb') ||
      name.includes('pre-qualification bid') ||
      name.includes('pre qualification bid') ||
      name === 'pqb' ||
      name.startsWith('pqb ')
    );
  }

  convertPqbToProjectStep(
    pqb: PreQualificationBid | ProjectStep | Record<string, unknown>,
    fallbackStep?: ProjectStep,
    projectId?: number,
  ): ProjectStep {
    const raw = (pqb || {}) as Record<string, unknown>;
    let innerData: Record<string, unknown> = {};
    if (typeof raw['data'] === 'string') {
      try {
        innerData = JSON.parse(raw['data']);
      } catch {
        innerData = {};
      }
    } else if (raw['data'] && typeof raw['data'] === 'object') {
      innerData = { ...(raw['data'] as Record<string, unknown>) };
    }

    const merged = { ...innerData, ...raw };
    const items = (merged['items'] ||
      merged['requirements'] ||
      merged['table_items'] ||
      innerData['items'] ||
      innerData['requirements'] ||
      innerData['table_items'] ||
      (fallbackStep?.data as Record<string, unknown>)?.['items'] ||
      []) as Array<Record<string, unknown>>;

    const dataObj: Record<string, unknown> = {
      ...((fallbackStep?.data as Record<string, unknown>) || {}),
      ...innerData,
      ...raw,
      pqb_title: String(
        merged['pqb_title'] ||
        merged['title'] ||
        merged['pqbTitle'] ||
        merged['tender_title'] ||
        (fallbackStep?.data as Record<string, unknown>)?.['pqb_title'] ||
        '',
      ).trim(),
      pqb_no: String(
        merged['pqb_no'] ||
        merged['no'] ||
        merged['pqbNo'] ||
        merged['tender_no'] ||
        merged['pqb_number'] ||
        (fallbackStep?.data as Record<string, unknown>)?.['pqb_no'] ||
        '',
      ).trim(),
      pqb_issuing_date:
        merged['pqb_issuing_date'] ||
        merged['pqb_issue_date'] ||
        merged['issue_date'] ||
        (fallbackStep?.data as Record<string, unknown>)?.['pqb_issuing_date'] ||
        '',
      pqb_closing_date_time:
        merged['pqb_closing_date_time'] ||
        merged['closing_date_time'] ||
        (fallbackStep?.data as Record<string, unknown>)?.['pqb_closing_date_time'] ||
        '',
      pqb_opening_date_time:
        merged['pqb_opening_date_time'] ||
        merged['opening_date_time'] ||
        (fallbackStep?.data as Record<string, unknown>)?.['pqb_opening_date_time'] ||
        '',
      mode_of_bid_submission: merged['mode_of_bid_submission'] || '',
      supply_location: merged['supply_location'] || '',
      items: Array.isArray(items) ? items : [],
    };

    const rawStatus = String(fallbackStep?.status || raw['status'] || 'completed').toLowerCase();
    const status: StepStatus =
      rawStatus === 'in_progress' || rawStatus === 'pending' || rawStatus === 'skipped'
        ? (rawStatus as StepStatus)
        : rawStatus === 'draft'
          ? 'in_progress'
          : 'completed';

    return {
      id: fallbackStep?.id ?? (typeof raw['id'] === 'number' ? raw['id'] : 1),
      project_id:
        projectId ??
        fallbackStep?.project_id ??
        (typeof raw['project_id'] === 'number' ? raw['project_id'] : 0),
      form_code: 'FORM_01_PQB',
      step_name: fallbackStep?.step_name || 'National Pre-Qualification Bid (PQB)',
      description: String(
        fallbackStep?.description ||
        raw['description'] ||
        'Pre-qualification bid terms, submission schedule, and requirements',
      ),
      step_number: fallbackStep?.step_number ?? 1,
      step_order: fallbackStep?.step_order ?? 1,
      status,
      progress_percentage: Number(
        fallbackStep?.progress_percentage ??
        raw['progress_percentage'] ??
        (status === 'completed' ? 100 : 50),
      ),
      completed_at:
        fallbackStep?.completed_at !== undefined
          ? fallbackStep.completed_at
          : raw['completed_at']
            ? String(raw['completed_at'])
            : status === 'completed'
              ? (raw['updated_at'] ? String(raw['updated_at']) : raw['created_at'] ? String(raw['created_at']) : null)
              : null,
      category: fallbackStep?.category || 'Pre-Bidding & Tenders',
      phase: fallbackStep?.phase || 'phase-1',
      data: dataObj,
      remarks: fallbackStep?.remarks || [],
      created_at: (raw['created_at'] as string) || fallbackStep?.created_at,
      updated_at: (raw['updated_at'] as string) || fallbackStep?.updated_at,
    };
  }

  private fetchAndApplyLatestPqbToCorrigendum(
    pId: number,
    candidateStep: ProjectStep | undefined,
    showNotification: boolean,
  ): void {
    if (typeof this.fetchingPreviousStep === 'function' && this.fetchingPreviousStep()) return;
    this.fetchingPreviousStep?.set?.(true);

    const pqbDef = getFormDefinition('FORM_01_PQB');
    const fetchLatestPqb$: Observable<PreQualificationBid | ProjectStep | null> =
      this.preQualificationBidService && typeof this.preQualificationBidService.getLatest === 'function'
        ? this.preQualificationBidService.getLatest(pId)
        : pqbDef && this.formApiService && typeof this.formApiService.getLatestEntry === 'function'
          ? this.formApiService.getLatestEntry(pqbDef, pId)
          : of(null);

    fetchLatestPqb$
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.fetchingPreviousStep?.set?.(false)),
      )
      .subscribe({
        next: (latestPqb) => {
          if (latestPqb) {
            const stepToApply = this.convertPqbToProjectStep(
              latestPqb as PreQualificationBid | Record<string, unknown>,
              candidateStep,
              pId,
            );
            if (this.hasTenderData(stepToApply)) {
              this.applyPreviousStepToCorrigendum(stepToApply, showNotification);
              return;
            }
          }

          if (candidateStep && this.hasTenderData(candidateStep)) {
            this.applyPreviousStepToCorrigendum(candidateStep, showNotification);
            return;
          }

          this.ensureCorrigendumDefaultRows();
          if (showNotification) {
            this.messageService?.add({
              severity: 'info',
              summary: 'National PQB Not Found',
              detail:
                'No latest National Pre-Qualification Bid (PQB) found for this project. Initialized default comparison rows.',
            });
          }
        },
        error: () => {
          if (candidateStep && this.hasTenderData(candidateStep)) {
            this.applyPreviousStepToCorrigendum(candidateStep, showNotification);
            return;
          }
          this.ensureCorrigendumDefaultRows();
          if (showNotification) {
            this.messageService?.add({
              severity: 'info',
              summary: 'National PQB Not Found',
              detail:
                'No latest National Pre-Qualification Bid (PQB) found for this project. Initialized default comparison rows.',
            });
          }
        },
      });
  }

  private fetchAndApplyTenderStep(
    pId: number,
    targetStep: ProjectStep,
    showNotification: boolean,
  ): void {
    if (this.isNationalPqbStep(targetStep)) {
      this.fetchAndApplyLatestPqbToCorrigendum(pId, targetStep, showNotification);
      return;
    }
    const targetDef = targetStep.form_code
      ? getFormDefinition(targetStep.form_code)
      : targetStep.step_name
        ? getFormDefinition(targetStep.step_name)
        : undefined;
    const selectedStep = targetStep;

    this.fetchingPreviousStep?.set?.(true);
    const fetchTarget$: Observable<ProjectStep> = (targetDef?.apiEndpoint && this.formApiService)
      ? (targetStep.id && typeof this.formApiService.getEntryById === 'function'
        ? this.formApiService.getEntryById(targetDef, targetStep.id, pId).pipe(
          catchError(() => this.formApiService.getLatestEntry(targetDef, pId)),
        )
        : this.formApiService.getLatestEntry(targetDef, pId)
      ).pipe(
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

    // Try dedicated /api/v1/corrigendums/latest-tender endpoint first
    if (typeof this.formApiService.getLatestTenderForCorrigendum === 'function') {
      this.formApiService.getLatestTenderForCorrigendum(pId).pipe(
        catchError(() => of(null)),
      ).subscribe({
        next: (directTender) => {
          if (directTender && this.hasTenderData(directTender)) {
            this.fetchingPreviousStep?.set?.(false);
            this.applyPreviousStepToCorrigendum(directTender, showNotification);
            return;
          }
          this.fetchLatestTenderViaForkJoin(pId, showNotification);
        },
        error: () => {
          this.fetchLatestTenderViaForkJoin(pId, showNotification);
        },
      });
      return;
    }

    this.fetchLatestTenderViaForkJoin(pId, showNotification);
  }

  private fetchLatestTenderViaForkJoin(pId: number, showNotification: boolean): void {
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
              summary: 'No Preceding Tender Data',
              detail: 'No preceding tender step found to import for this project.',
            });
          }
        }
      },
      error: () => {
        this.ensureCorrigendumDefaultRows();
        if (showNotification) {
          this.messageService?.add({
            severity: 'info',
            summary: 'No Preceding Tender Data',
            detail: 'No preceding tender step found to import for this project.',
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
    const rawItems = (stepData['items'] ||
      stepData['requirements'] ||
      stepData['table_items'] ||
      stepData['materials'] ||
      stepRec['items'] ||
      stepRec['requirements'] ||
      []) as Array<Record<string, unknown>>;

    const mappedQuantityItems: CorrigendumQuantityItem[] = (Array.isArray(rawItems) ? rawItems : [])
      .filter((it) => it && typeof it === 'object' && (it['description'] || it['material_name'] || it['item_name'] || it['name'] || it['quantity'] !== undefined))
      .map((it, idx) => {
        const desc = String(it['description'] || it['material_name'] || it['item_name'] || it['name'] || `Item ${idx + 1}`).trim();
        const rawQty = it['quantity'];
        const qtyNum = rawQty !== undefined && rawQty !== null && rawQty !== '' && !isNaN(Number(rawQty)) ? Number(rawQty) : null;
        const unit = String(it['unit'] || '').trim();
        return {
          id: it['id'] ? `corr-item-${it['id']}` : `corr-item-${idx + 1}`,
          sr_no: idx + 1,
          original_description: desc,
          original_quantity: qtyNum,
          original_unit: unit,
          corrigendum_description: desc,
          corrigendum_quantity: qtyNum,
          corrigendum_unit: unit,
          is_new: false,
        };
      });

    if (!this.corrigendumQuantityItems || typeof this.corrigendumQuantityItems.set !== 'function') {
      (this as any).corrigendumQuantityItems = signal<CorrigendumQuantityItem[]>(mappedQuantityItems);
    } else {
      this.corrigendumQuantityItems.set(mappedQuantityItems);
    }

    let qtySummary = '';
    if (mappedQuantityItems.length > 0) {
      const lines = mappedQuantityItems.map((it, idx) => {
        const desc = it.original_description;
        const qty = it.original_quantity !== null && it.original_quantity !== undefined ? it.original_quantity : '';
        const unit = it.original_unit ? ` ${it.original_unit}` : '';
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
    this.syncCorrigendumQuantityToTableFormArray();

    if (showNotification) {
      const defName = targetStep.form_code ? getFormDefinition(targetStep.form_code)?.name : null;
      const stepName = (targetStep.step_name && !targetStep.step_name.toLowerCase().includes('previous tender') && !targetStep.step_name.toLowerCase().includes('preceding tender'))
        ? targetStep.step_name
        : (defName || 'National Pre-Qualification Bid (PQB)');
      this.messageService.add({
        severity: 'success',
        summary: 'Tender Data Loaded',
        detail: `Imported specifications and line items from latest ${stepName}.`,
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

  syncCorrigendumQuantityToTableFormArray(): void {
    const tableArr = typeof this.tableFormArray === 'function' ? this.tableFormArray() : null;
    if (!tableArr) return;
    const row = tableArr.controls.find((r) => Number(r.get('sr_no')?.value) === 3) || tableArr.at(2);
    if (!row) return;

    const items = (typeof this.corrigendumQuantityItems === 'function' ? this.corrigendumQuantityItems() : []) || [];
    if (items.length === 0 && row.get('as_per_tender_doc')?.value && row.get('as_per_tender_doc')?.value !== 'QUANTITY: (TABLE)') {
      return;
    }

    const origLines = items
      .filter((it) => !it.is_new)
      .map((it, idx) => {
        const q = it.original_quantity !== null && it.original_quantity !== undefined ? it.original_quantity : '';
        const u = it.original_unit ? ` ${it.original_unit}` : '';
        return q !== '' ? `${idx + 1}. ${it.original_description} - Qty: ${q}${u}` : `${idx + 1}. ${it.original_description}`;
      });
    const docData = origLines.length > 0 ? `QUANTITY: (TABLE) ${origLines.join(', ')}` : 'QUANTITY: (TABLE)';

    const corrLines = items.map((it, idx) => {
      const q = it.corrigendum_quantity !== null && it.corrigendum_quantity !== undefined ? it.corrigendum_quantity : '';
      const u = it.corrigendum_unit ? ` ${it.corrigendum_unit}` : '';
      const mod = this.isCorrigendumItemModified(it) ? ' [MODIFIED]' : '';
      return q !== '' ? `${idx + 1}. ${it.corrigendum_description} - Qty: ${q}${u}${mod}` : `${idx + 1}. ${it.corrigendum_description}${mod}`;
    });
    const corrData = corrLines.length > 0 ? `QUANTITY: (TABLE) ${corrLines.join(', ')}` : 'QUANTITY: (TABLE)';

    row.get('as_per_tender_doc')?.setValue(docData, { emitEvent: false });
    row.get('as_per_corrigendum')?.setValue(corrData, { emitEvent: false });
    this.tableVersion?.update?.((v) => v + 1);
  }

  updateCorrigendumItem(index: number, patch: Partial<CorrigendumQuantityItem>): void {
    if (typeof this.corrigendumQuantityItems?.update !== 'function' && typeof this.corrigendumQuantityItems?.set !== 'function') return;
    const items = [...(typeof this.corrigendumQuantityItems === 'function' ? this.corrigendumQuantityItems() : [])];
    if (items[index]) {
      items[index] = { ...items[index], ...patch };
      this.corrigendumQuantityItems.set(items);
      this.syncCorrigendumQuantityToTableFormArray();
      this.formGroup()?.markAsDirty();
    }
  }

  addCorrigendumItem(): void {
    if (typeof this.corrigendumQuantityItems?.update !== 'function' && typeof this.corrigendumQuantityItems?.set !== 'function') return;
    const items = [...(typeof this.corrigendumQuantityItems === 'function' ? this.corrigendumQuantityItems() : [])];
    const nextSr = items.length + 1;
    items.push({
      id: `new-corr-${Date.now()}-${nextSr}`,
      sr_no: nextSr,
      original_description: '—',
      original_quantity: null,
      original_unit: '',
      corrigendum_description: '',
      corrigendum_quantity: 1,
      corrigendum_unit: 'Nos',
      is_new: true,
    });
    this.corrigendumQuantityItems.set(items);
    this.syncCorrigendumQuantityToTableFormArray();
    this.formGroup()?.markAsDirty();
  }

  removeCorrigendumItem(index: number): void {
    if (typeof this.corrigendumQuantityItems?.update !== 'function' && typeof this.corrigendumQuantityItems?.set !== 'function') return;
    const items = (typeof this.corrigendumQuantityItems === 'function' ? this.corrigendumQuantityItems() : []).filter((_, i) => i !== index);
    const reindexed = items.map((it, idx) => ({ ...it, sr_no: idx + 1 }));
    this.corrigendumQuantityItems.set(reindexed);
    this.syncCorrigendumQuantityToTableFormArray();
    this.formGroup()?.markAsDirty();
  }

  resetCorrigendumItem(index: number): void {
    if (typeof this.corrigendumQuantityItems?.update !== 'function' && typeof this.corrigendumQuantityItems?.set !== 'function') return;
    const items = [...(typeof this.corrigendumQuantityItems === 'function' ? this.corrigendumQuantityItems() : [])];
    const target = items[index];
    if (!target) return;
    if (target.is_new) {
      this.removeCorrigendumItem(index);
      return;
    }
    items[index] = {
      ...target,
      corrigendum_description: target.original_description,
      corrigendum_quantity: target.original_quantity,
      corrigendum_unit: target.original_unit,
    };
    this.corrigendumQuantityItems.set(items);
    this.syncCorrigendumQuantityToTableFormArray();
    this.formGroup()?.markAsDirty();
  }

  resetAllCorrigendumItems(): void {
    if (typeof this.corrigendumQuantityItems?.update !== 'function' && typeof this.corrigendumQuantityItems?.set !== 'function') return;
    const rawList = typeof this.corrigendumQuantityItems === 'function' ? this.corrigendumQuantityItems() : [];
    const resetList = rawList
      .filter((it) => !it.is_new)
      .map((it) => ({
        ...it,
        corrigendum_description: it.original_description,
        corrigendum_quantity: it.original_quantity,
        corrigendum_unit: it.original_unit,
      }));
    this.corrigendumQuantityItems.set(resetList);
    this.syncCorrigendumQuantityToTableFormArray();
    this.formGroup()?.markAsDirty();
  }

  isCorrigendumItemModified(item: CorrigendumQuantityItem): boolean {
    if (item.is_new) return true;
    const origDesc = (item.original_description || '').trim();
    const corrDesc = (item.corrigendum_description || '').trim();
    const origQty = item.original_quantity !== null && item.original_quantity !== undefined ? Number(item.original_quantity) : null;
    const corrQty = item.corrigendum_quantity !== null && item.corrigendum_quantity !== undefined ? Number(item.corrigendum_quantity) : null;
    const origUnit = (item.original_unit || '').trim().toLowerCase();
    const corrUnit = (item.corrigendum_unit || '').trim().toLowerCase();
    return origDesc !== corrDesc || origQty !== corrQty || origUnit !== corrUnit;
  }

  getCorrigendumItemChangeLabel(item: CorrigendumQuantityItem): string {
    if (item.is_new) return 'New Item';
    const descChanged = (item.original_description || '').trim() !== (item.corrigendum_description || '').trim();
    const origQty = item.original_quantity !== null && item.original_quantity !== undefined ? Number(item.original_quantity) : null;
    const corrQty = item.corrigendum_quantity !== null && item.corrigendum_quantity !== undefined ? Number(item.corrigendum_quantity) : null;
    const qtyChanged = origQty !== corrQty;

    if (descChanged && qtyChanged) {
      return `Qty: ${origQty ?? 0} → ${corrQty ?? 0} & Desc Changed`;
    }
    if (qtyChanged) {
      return `Qty: ${origQty ?? 0} → ${corrQty ?? 0}`;
    }
    if (descChanged) {
      return 'Description Changed';
    }
    return 'Unchanged';
  }

  isCorrigendumRowModified(rowIdx: number): boolean {
    const tableArr = typeof this.tableFormArray === 'function' ? this.tableFormArray() : null;
    if (!tableArr) return false;
    const row = tableArr.at(rowIdx);
    if (!row) return false;
    const srNo = Number(row.get('sr_no')?.value);
    if (srNo === 3 || rowIdx === 2) {
      return this.corrigendumQuantityItems().some((it) => this.isCorrigendumItemModified(it));
    }
    const docVal = String(row.get('as_per_tender_doc')?.value || '').trim();
    const corrVal = String(row.get('as_per_corrigendum')?.value || '').trim();
    if (!corrVal) return false;

    const headerPrefixes = [
      'CLOSING DATE & TIME:',
      'OPENING DATE & TIME:',
      'PAYMENT TERMS:',
      'EMD:',
      'DELIVERY SCHEDULE:',
      'TENDER FEE',
      'TECHNICAL SPECIFICATION:',
    ];

    const isJustHeader = headerPrefixes.some((p) => corrVal.toLowerCase() === p.toLowerCase() || corrVal.toLowerCase() === (p + ':').toLowerCase());
    if (isJustHeader) return false;

    return corrVal !== docVal;
  }

  copyOriginalToCorrigendum(rowIdx: number): void {
    const tableArr = typeof this.tableFormArray === 'function' ? this.tableFormArray() : null;
    if (!tableArr) return;
    const row = tableArr.at(rowIdx);
    if (!row) return;
    const srNo = Number(row.get('sr_no')?.value);
    if (srNo === 3 || rowIdx === 2) {
      this.resetAllCorrigendumItems();
      return;
    }
    const docVal = row.get('as_per_tender_doc')?.value || '';
    row.get('as_per_corrigendum')?.setValue(docVal);
    row.get('as_per_corrigendum')?.markAsDirty();
    this.tableVersion?.update?.((v) => v + 1);
  }

  onCorrigendumRowChange(rowIdx: number): void {
    this.tableVersion?.update?.((v) => v + 1);
  }

  private isSyncingScroll = false;

  syncScroll(source: HTMLElement, target: HTMLElement): void {
    if (!source || !target || this.isSyncingScroll) return;
    this.isSyncingScroll = true;
    target.scrollTop = source.scrollTop;
    requestAnimationFrame(() => {
      this.isSyncingScroll = false;
    });
  }

  getCorrigendumParameterMeta(rIdx: number, rowGroup?: FormGroup): { title: string; icon: string } {
    const srNo = Number(rowGroup?.get('sr_no')?.value ?? (rIdx + 1));
    switch (srNo) {
      case 1:
        return { title: 'Closing Date & Time', icon: 'pi pi-calendar-times' };
      case 2:
        return { title: 'Opening Date & Time', icon: 'pi pi-calendar-plus' };
      case 3:
        return { title: 'Quantity / Material Items', icon: 'pi pi-box' };
      case 4:
        return { title: 'Payment Terms', icon: 'pi pi-credit-card' };
      case 5:
        return { title: 'Earnest Money Deposit (EMD)', icon: 'pi pi-shield' };
      case 6:
        return { title: 'Delivery Schedule', icon: 'pi pi-truck' };
      case 7:
        return { title: 'Tender Fee', icon: 'pi pi-dollar' };
      case 8:
        return { title: 'Technical Specification', icon: 'pi pi-file' };
      default:
        return { title: `Specification Parameter #${srNo}`, icon: 'pi pi-info-circle' };
    }
  }

  computeCorrigendumTotalAmendedCount(): number {
    const isCorr = typeof this.isCorrigendum === 'function' ? this.isCorrigendum() : false;
    if (!isCorr) return 0;
    if (typeof this.tableVersion === 'function') {
      this.tableVersion();
    }
    const arr = typeof this.tableFormArray === 'function' ? this.tableFormArray() : null;
    if (!arr) return 0;
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
      if (this.isCorrigendumRowModified(i)) {
        count++;
      }
    }
    return count;
  }

  parseQuantityItemsFromRow(row: Record<string, unknown>): CorrigendumQuantityItem[] {
    const docText = String(row['as_per_tender_doc'] || '').replace(/^QUANTITY:\s*\(TABLE\)\s*/i, '').trim();
    const corrText = String(row['as_per_corrigendum'] || '').replace(/^QUANTITY:\s*\(TABLE\)\s*/i, '').trim();

    if (!docText && !corrText) return [];

    const parseTextToItems = (text: string): Array<{ desc: string; qty: number | null; unit: string }> => {
      if (!text) return [];
      const parts = text.includes('\n') ? text.split('\n') : text.split(/(?:,\s*(?=\d+\.))/);
      return parts.map((part) => {
        const clean = part.replace(/^\d+\.\s*/, '').trim();
        const match = clean.match(/^(.*?)(?:\s*-\s*Qty:\s*(\d+(?:\.\d+)?)\s*(.*))?$/i);
        if (match) {
          const desc = match[1]?.trim() || clean;
          const qty = match[2] ? Number(match[2]) : null;
          const unit = match[3]?.replace(/\[MODIFIED\]/gi, '').trim() || '';
          return { desc, qty, unit };
        }
        return { desc: clean, qty: null, unit: '' };
      });
    };

    const docItems = parseTextToItems(docText);
    const corrItems = parseTextToItems(corrText);

    const maxLen = Math.max(docItems.length, corrItems.length);
    const result: CorrigendumQuantityItem[] = [];

    for (let i = 0; i < maxLen; i++) {
      const d = docItems[i] || { desc: '', qty: null, unit: '' };
      const c = corrItems[i] || d;
      result.push({
        id: `parsed-corr-${i + 1}`,
        sr_no: i + 1,
        original_description: d.desc,
        original_quantity: d.qty,
        original_unit: d.unit,
        corrigendum_description: c.desc || d.desc,
        corrigendum_quantity: c.qty !== null ? c.qty : d.qty,
        corrigendum_unit: c.unit || d.unit,
        is_new: !docItems[i] && Boolean(corrItems[i]),
      });
    }

    return result;
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

    let lastInitializedKey = '';

    // Synchronize form when dialog becomes visible or step/definition changes
    effect(() => {
      const isVis = this.visible();
      const currentStep = this.step();
      const defInput = this.formDefinition();
      const pId = this.projectId();

      if (isVis) {
        const stepKey = currentStep ? `step_${currentStep.id ?? currentStep.step_number}` : 'new';
        const defKey = defInput?.formCode ?? currentStep?.form_code ?? '';
        const initKey = `${pId}_${stepKey}_${defKey}`;

        if (initKey !== lastInitializedKey) {
          lastInitializedKey = initKey;
          untracked(() => {
            this.initializeModal(currentStep, defInput);
          });
        }
      } else {
        lastInitializedKey = '';
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
      const activeRec = step as unknown as Record<string, unknown>;
      if (!savedData['items'] && Array.isArray(activeRec['items'])) {
        savedData['items'] = activeRec['items'];
      }

      if (def?.formCode === 'FORM_09_RFQ') {
        const rDate =
          formatLocalDate(savedData['request_date'] as string | Date) ||
          formatLocalDate(savedData['quotation_requested_date'] as string | Date);
        if (rDate) {
          savedData['request_date'] = rDate;
        }
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
        (!savedData['pqb_title'] ||
          !savedData['pqb_no'] ||
          !savedData['items'] ||
          (Array.isArray(savedData['items']) && savedData['items'].length === 0))
      ) {
        this.loadFromNationalPreQualificationBid(false);
      }

      if (
        def!.formCode === 'FORM_04_LTE' &&
        (!savedData['pqb_no'] ||
          !savedData['items'] ||
          (Array.isArray(savedData['items']) && savedData['items'].length === 0))
      ) {
        this.loadFromNationalPreQualificationBid(false);
      }

      if (
        (def!.formCode === 'FORM_33_STE' || def!.formCode === 'FORM_30_STE' || def!.formCode === 'FORM_STE') &&
        (!savedData['pqb_no'] ||
          !savedData['tender_title'] ||
          !savedData['items'] ||
          (Array.isArray(savedData['items']) && savedData['items'].length === 0))
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

      if (
        def!.formCode === 'FORM_31_BID_DOC_LTE' ||
        (def!.name.toLowerCase().includes('bid doc') && (def!.name.toLowerCase().includes('lte') || def!.name.toLowerCase().includes('limited tender')))
      ) {
        if (!savedData['tender_title'] || !String(savedData['tender_title']).trim()) {
          this.loadForBidDocumentLte(false);
        } else {
          this.resolveLinkedStepForBidDocLte();
        }
      }

      if (
        def!.formCode === 'FORM_14_PURCHASE_ORDER' ||
        (def!.name.toLowerCase().includes('purchase order') || def!.name.toLowerCase().startsWith('po '))
      ) {
        const hasItems = Array.isArray(savedData['items']) && savedData['items'].length > 0;
        const hasDeliveryTerms = Boolean(savedData['delivery_terms']);
        const hasPaymentTerms = Boolean(savedData['payment_terms']);
        const hasWarranty = Boolean(savedData['warranty_period']);
        const hasGst =
          savedData['gst_rate_pct'] !== undefined &&
          savedData['gst_rate_pct'] !== null &&
          savedData['gst_rate_pct'] !== '';
        if (!hasItems || !hasDeliveryTerms || !hasPaymentTerms || !hasWarranty || !hasGst) {
          this.loadForPurchaseOrder(false);
        } else {
          this.resolveLinkedStepForPurchaseOrder();
        }
      }
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
      if (defInput.formCode === 'FORM_04_LTE') {
        this.loadFromNationalPreQualificationBid(false);
      }
      if (
        defInput.formCode === 'FORM_33_STE' ||
        defInput.formCode === 'FORM_30_STE' ||
        defInput.formCode === 'FORM_STE'
      ) {
        this.loadFromNationalPreQualificationBid(false);
      }
      if (defInput.formCode === 'FORM_03_CORRIGENDUM') {
        this.ensureCorrigendumDefaultRows();
        this.loadFromPreviousTenderStep(false);
      }
      if (
        defInput.formCode === 'FORM_31_BID_DOC_LTE' ||
        (defInput.name.toLowerCase().includes('bid doc') && (defInput.name.toLowerCase().includes('lte') || defInput.name.toLowerCase().includes('limited tender')))
      ) {
        this.loadForBidDocumentLte(false);
      }
      if (
        defInput.formCode === 'FORM_14_PURCHASE_ORDER' ||
        (defInput.name.toLowerCase().includes('purchase order') || defInput.name.toLowerCase().startsWith('po '))
      ) {
        this.loadForPurchaseOrder(false);
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
            error: () => { },
          });
        }
        if (p.supplier_id && !hasSuppName && this.supplierService) {
          this.supplierService.getSupplierById(p.supplier_id).subscribe({
            next: (s) => this.fallbackSupplier.set(s),
            error: () => { },
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

      if (def.formCode === 'FORM_03_CORRIGENDUM') {
        const savedQItems = (savedData['corrigendum_quantity_items'] || savedData['quantity_items']) as CorrigendumQuantityItem[] | undefined;
        if (Array.isArray(savedQItems) && savedQItems.length > 0) {
          this.corrigendumQuantityItems.set(savedQItems);
        } else {
          const row3 = savedRows.find((r) => Number(r['sr_no']) === 3) || savedRows[2];
          if (row3) {
            const parsed = this.parseQuantityItemsFromRow(row3);
            this.corrigendumQuantityItems.set(parsed);
          } else {
            this.corrigendumQuantityItems.set([]);
          }
        }
      }
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

    if (def.formCode === 'FORM_03_CORRIGENDUM') {
      this.syncCorrigendumQuantityToTableFormArray();
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

    if (def.formCode === 'FORM_03_CORRIGENDUM') {
      combinedData['corrigendum_quantity_items'] = this.corrigendumQuantityItems();
      combinedData['quantity_items'] = this.corrigendumQuantityItems();
    }

    if (def.fields.some((f) => this.isCurrencyWithSelect(f))) {
      const cur = this.selectedCurrency();
      combinedData['currency_unit'] = cur;
      combinedData['currency_symbol'] = getCurrencySymbol(cur);
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

    if (def.formCode === 'FORM_09_RFQ') {
      delete combinedData['quotation_requested_date'];
      delete combinedData['rfq_date'];
    }

    const existingStep = this.step();
    const rawFiles = this.uploadedFiles()
      .map((f) => f.fileRef)
      .filter((f): f is File => !!f);

    if (existingStep) {
      // ── UPDATE OPERATION: Update existing step via dedicated endpoint (PATCH) ─
      const stepId = existingStep.id || existingStep.step_number;

      if (def.apiEndpoint) {
        // Dedicated endpoint uses PATCH only (no PUT)
        this.formApiService
          .updateEntry(def, pId, stepId, combinedData, rawFiles)
          .subscribe({
            next: (updatedStep) => {
              this.saving.set(false);
              const stepResult: ProjectStep = {
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

              this.messageService?.add({
                severity: 'success',
                summary: 'Changes Saved',
                detail: `${updatedStep.step_name || def.name} has been updated successfully.`,
              });
              this.stepSaved.emit(stepResult);
              this.close();
            },
            error: () => {
              this.saving.set(false);
              this.messageService?.add({
                severity: 'error',
                summary: 'Save Failed',
                detail: 'Could not update step data on the server. Please try again.',
              });
            },
          });
      } else {
        // Fallback for steps without dedicated endpoint
        this.projectStepService
          .updateStep(pId, stepId, combinedData, 'completed', 100)
          .subscribe({
            next: (updatedStep) => {
              this.saving.set(false);
              const stepResult: ProjectStep = {
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

              this.messageService?.add({
                severity: 'success',
                summary: 'Changes Saved',
                detail: `${updatedStep.step_name || def.name} has been updated successfully.`,
              });
              this.stepSaved.emit(stepResult);
              this.close();
            },
            error: () => {
              this.saving.set(false);
              this.messageService?.add({
                severity: 'error',
                summary: 'Save Failed',
                detail: 'Could not update step data on the server. Please try again.',
              });
            },
          });
      }
    } else {
      // ── CREATE OPERATION: Create new step directly via dedicated endpoint or projectStepService ──
      if (def.apiEndpoint) {
        this.formApiService
          .createEntry(def, pId, combinedData, rawFiles)
          .subscribe({
            next: (newStep) => {
              this.saving.set(false);
              const stepWithMeta: ProjectStep = {
                ...newStep,
                id: newStep.id,
                project_id: pId,
                form_code: def.formCode,
                step_name: def.name,
                step_number: newStep.step_number || newStep.step_order || 1,
                step_order: newStep.step_order || newStep.step_number || 1,
                data: {
                  ...((newStep.data as Record<string, unknown>) || {}),
                  ...combinedData,
                },
              };
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
              this.messageService?.add({
                severity: 'error',
                summary: 'Creation Failed',
                detail: 'Could not attach step to the project on the server.',
              });
            },
          });
      } else {
        this.projectStepService
          .addStep(pId, def.formCode, def.name, combinedData, 'completed', 100)
          .subscribe({
            next: (addedStep) => {
              this.saving.set(false);
              const stepWithMeta: ProjectStep = {
                ...addedStep,
                id: addedStep.id,
                project_id: pId,
                form_code: def.formCode,
                step_name: def.name,
                step_number: addedStep.step_number || addedStep.step_order || 1,
                step_order: addedStep.step_order || addedStep.step_number || 1,
                data: {
                  ...((addedStep.data as Record<string, unknown>) || {}),
                  ...combinedData,
                },
              };
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
              this.messageService?.add({
                severity: 'error',
                summary: 'Creation Failed',
                detail: 'Could not attach step to the project on the server.',
              });
            },
          });
      }
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
