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
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';

import { CostSheetService } from '../../../../core/services/cost-sheet';
import { SupplierQuotationService } from '../../../../core/services/supplier-quotation';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import {
  CostSheet,
  CostSheetCreateInput,
  CostSheetGlobalParams,
  CostSheetItem,
  CostSheetItemInput,
} from '../../../../core/models/cost-sheet.model';
import { SupplierQuotation } from '../../../../core/models/supplier-quotation.model';
import { Project } from '../../../../core/models/project.model';
import { Customer } from '../../../../core/models/customer.model';

@Component({
  selector: 'app-step-04-cost-sheet',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TooltipModule,
    TableModule,
    SelectModule,
    DatePipe,
    DecimalPipe,
  ],
  templateUrl: './step-04-cost-sheet.html',
  styleUrl: './step-04-cost-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step04CostSheet implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly costSheetService = inject(CostSheetService);
  private readonly supplierQuotationService = inject(SupplierQuotationService);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly messageService = inject(MessageService);

  /* ── Core State Signals ──────────────────────────────── */
  protected readonly projectId = signal(0);
  protected readonly project = signal<Project | null>(null);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly costSheets = signal<CostSheet[]>([]);
  protected readonly supplierQuotations = signal<SupplierQuotation[]>([]);
  protected readonly loadingCostSheets = signal(true);
  protected readonly submitting = signal(false);
  protected readonly exportingId = signal<number | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  /* ── Create / Edit Dialog State ──────────────────────── */
  protected readonly dialogVisible = signal(false);
  protected readonly editingCostSheet = signal<CostSheet | null>(null);
  protected readonly items = signal<CostSheetItem[]>([]);
  protected readonly editingItemIndex = signal<number | null>(null);

  /* ── Supplier Quotations Import Dialog State ─────────── */
  protected readonly importDialogVisible = signal(false);
  protected readonly selectedImportItems = signal<CostSheetItemInput[]>([]);

  /* ── Expandable State for Version History ────────────── */
  protected readonly expandedSheets = signal<Record<number, boolean>>({});

  /* ── Reactive Forms ──────────────────────────────────── */
  protected readonly headerForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
  });

  protected readonly globalParamsForm = this.fb.group({
    eurToInr: [null as number | null, [Validators.required, Validators.min(0.01)]],
    insuranceFreightRate: [null as number | null, [Validators.required, Validators.min(0)]],
    defaultCustomsDutyRate: [null as number | null, [Validators.required, Validators.min(0)]],
    igstRate: [null as number | null, [Validators.required, Validators.min(0)]],
    transportationRate: [null as number | null, [Validators.required, Validators.min(0)]],
    financeChargesRate: [null as number | null, [Validators.required, Validators.min(0)]],
    marginRate: [null as number | null, [Validators.required, Validators.min(0)]],
    gstRate: [null as number | null, [Validators.required, Validators.min(0)]],
  });

  protected readonly itemForm = this.fb.group({
    quotationNumber: [''],
    quotationIndex: ['1'],
    itemDescription: ['', [Validators.required]],
    itemCode: [''],
    pricePerUnitEur: [null as number | null, [Validators.required, Validators.min(0)]],
    quantity: [null as number | null, [Validators.required, Validators.min(0.001)]],
    customsDutyRate: [null as number | null, [Validators.min(0)]],
  });

  /* ── Reactive Parameter Signal ───────────────────────── */
  private readonly globalParamsSignal = toSignal(
    this.globalParamsForm.valueChanges,
    { initialValue: this.globalParamsForm.getRawValue() }
  );

  /** Active global parameters combining form values and fallbacks */
  protected readonly activeGlobalParams = computed<CostSheetGlobalParams>(() => {
    const p = this.globalParamsSignal() || this.globalParamsForm.getRawValue();
    return {
      eurToInr: p.eurToInr !== null && p.eurToInr !== undefined && !isNaN(Number(p.eurToInr)) ? Number(p.eurToInr) : 0,
      insuranceFreightRate: p.insuranceFreightRate !== null && p.insuranceFreightRate !== undefined && !isNaN(Number(p.insuranceFreightRate)) ? Number(p.insuranceFreightRate) : 0,
      defaultCustomsDutyRate: p.defaultCustomsDutyRate !== null && p.defaultCustomsDutyRate !== undefined && !isNaN(Number(p.defaultCustomsDutyRate)) ? Number(p.defaultCustomsDutyRate) : 0,
      igstRate: p.igstRate !== null && p.igstRate !== undefined && !isNaN(Number(p.igstRate)) ? Number(p.igstRate) : 0,
      transportationRate: p.transportationRate !== null && p.transportationRate !== undefined && !isNaN(Number(p.transportationRate)) ? Number(p.transportationRate) : 0,
      financeChargesRate: p.financeChargesRate !== null && p.financeChargesRate !== undefined && !isNaN(Number(p.financeChargesRate)) ? Number(p.financeChargesRate) : 0,
      marginRate: p.marginRate !== null && p.marginRate !== undefined && !isNaN(Number(p.marginRate)) ? Number(p.marginRate) : 0,
      gstRate: p.gstRate !== null && p.gstRate !== undefined && !isNaN(Number(p.gstRate)) ? Number(p.gstRate) : 0,
    };
  });

  /** Items with live calculated landed costs and selling rates */
  protected readonly calculatedItems = computed<CostSheetItem[]>(() => {
    const rawItems = this.items();
    const params = this.activeGlobalParams();
    return rawItems.map((item) => this.computeItemCalculations(item, params));
  });

  /* ── Derived Live Summary Totals ─────────────────────── */
  protected readonly totalItemCount = computed(() => this.calculatedItems().length);

  protected readonly totalEurValue = computed(() =>
    this.calculatedItems().reduce((acc, it) => acc + (it.totalLineEur || 0), 0)
  );

  protected readonly totalLandedCostInr = computed(() =>
    this.calculatedItems().reduce(
      (acc, it) => acc + ((it.landedCostInr || 0) * (it.quantity || 0)),
      0
    )
  );

  protected readonly totalMarginInr = computed(() =>
    this.calculatedItems().reduce(
      (acc, it) => acc + ((it.marginInr || 0) * (it.quantity || 0)),
      0
    )
  );

  protected readonly cumulativeProjectCostInr = computed(() =>
    this.calculatedItems().reduce((acc, it) => acc + (it.totalLineInr || 0), 0)
  );

  protected readonly latestCostSheet = computed(() => this.costSheets()[0] || null);

  protected readonly latestTotalItems = computed(() => {
    const list = this.costSheets();
    return list.reduce((sum, cs) => sum + (cs.items?.length || 0), 0);
  });

  /* ── Interactive Version Tab State ─────────────────────── */
  protected readonly selectedVersionIndex = signal<number>(0);

  protected readonly selectedCostSheet = computed<CostSheet | null>(() => {
    const sheets = this.costSheets();
    if (sheets.length === 0) {
      return null;
    }
    const idx = this.selectedVersionIndex();
    return sheets[idx] || sheets[0] || null;
  });

  protected selectVersion(index: number): void {
    this.selectedVersionIndex.set(index);
  }

  /* ── Lifecycle ───────────────────────────────────────── */
  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!id) {
      this.errorMessage.set('Invalid project ID.');
      this.loadingCostSheets.set(false);
      return;
    }
    this.projectId.set(id);
    this.loadProjectContext(id);
    this.loadCostSheets(id);
    this.loadSupplierQuotations(id);
  }

  /* ── Data Loaders ────────────────────────────────────── */
  private loadProjectContext(projectId: number): void {
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

  protected loadCostSheets(projectId: number): void {
    this.loadingCostSheets.set(true);
    this.costSheetService.getByProject(projectId).subscribe({
      next: (data) => {
        // Compute landed costs for each cost sheet's items
        const computedData = (data || []).map((sheet) => ({
          ...sheet,
          items: (sheet.items || []).map((item) =>
            this.computeItemCalculations(item, sheet.globalParams || this.activeGlobalParams())
          ),
        }));
        this.costSheets.set(computedData);
        // Expand the most recent sheet by default
        if (computedData.length > 0) {
          this.expandedSheets.set({ [computedData[0].id]: true });
        }
        this.loadingCostSheets.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load cost sheets.');
        this.loadingCostSheets.set(false);
      },
    });
  }

  protected loadSupplierQuotations(projectId: number): void {
    this.supplierQuotationService.getByProject(projectId).subscribe({
      next: (quotes) => this.supplierQuotations.set(quotes || []),
      error: () => {/* non-fatal */ },
    });
  }

  /* ── Landed Cost Calculation Engine ──────────────────── */
  public computeItemCalculations(
    item: CostSheetItemInput,
    params: CostSheetGlobalParams
  ): CostSheetItem {
    const qty = Number(item.quantity) || 0;
    const priceEur = Number(item.pricePerUnitEur) || 0;
    const dutyRate = item.customsDutyRate !== undefined && item.customsDutyRate !== null && !isNaN(Number(item.customsDutyRate))
      ? Number(item.customsDutyRate)
      : params.defaultCustomsDutyRate;

    const totalLineEur = qty * priceEur;

    // 1. CIF Base (INR) = Price per unit in EUR * EUR to INR Rate
    const cifBaseInr = priceEur * params.eurToInr;

    // 2. Insurance & Freight = CIF Base * (insuranceFreightRate / 100)
    const insuranceFreightInr = cifBaseInr * (params.insuranceFreightRate / 100);

    // 3. Assessable Value (AV) = CIF Base + Insurance & Freight
    const assessableValueInr = cifBaseInr + insuranceFreightInr;

    // 4. Basic Customs Duty (BCD) = AV * (customsDutyRate / 100)
    const customsDutyInr = assessableValueInr * (dutyRate / 100);

    // 5. IGST on Import = (AV + BCD) * (igstRate / 100)
    const igstInr = (assessableValueInr + customsDutyInr) * (params.igstRate / 100);

    // 6. Landed Cost = Assessable Value + Customs Duty
    const landedCostInr = assessableValueInr + customsDutyInr;

    // 7. Inland Transportation = Landed Cost * (transportationRate / 100)
    const transportationInr = landedCostInr * (params.transportationRate / 100);

    // 8. Finance Charges = Landed Cost * (financeChargesRate / 100)
    const financeChargesInr = landedCostInr * (params.financeChargesRate / 100);

    // 9. Total Cost per Unit (INR) = Landed Cost + Transportation + Finance Charges
    const totalCostPerUnitInr = landedCostInr + transportationInr + financeChargesInr;

    // 10. Margin (INR) = Total Cost * (marginRate / 100)
    const marginInr = totalCostPerUnitInr * (params.marginRate / 100);

    // 11. Selling Price per Unit (ex-GST) = Total Cost + Margin
    const sellingPricePerUnitInr = totalCostPerUnitInr + marginInr;

    // 12. Total Line (INR) = Selling Price per Unit * Quantity
    const totalLineInr = sellingPricePerUnitInr * qty;

    return {
      ...item,
      customsDutyRate: dutyRate,
      cifBaseInr: Number(cifBaseInr.toFixed(2)),
      insuranceFreightInr: Number(insuranceFreightInr.toFixed(2)),
      assessableValueInr: Number(assessableValueInr.toFixed(2)),
      customsDutyInr: Number(customsDutyInr.toFixed(2)),
      igstInr: Number(igstInr.toFixed(2)),
      landedCostInr: Number(landedCostInr.toFixed(2)),
      transportationInr: Number(transportationInr.toFixed(2)),
      financeChargesInr: Number(financeChargesInr.toFixed(2)),
      totalCostPerUnitInr: Number(totalCostPerUnitInr.toFixed(2)),
      marginInr: Number(marginInr.toFixed(2)),
      sellingPricePerUnitInr: Number(sellingPricePerUnitInr.toFixed(2)),
      totalLineEur: Number(totalLineEur.toFixed(2)),
      totalLineInr: Number(totalLineInr.toFixed(2)),
    };
  }

  /* ── Dialog Management ───────────────────────────────── */
  protected openCreateDialog(): void {
    const proj = this.project();
    const defaultTitle = proj ? `Cost Sheet - ${proj.project_title}` : 'Project Cost Sheet';

    this.headerForm.reset({
      title: defaultTitle,
    });

    this.globalParamsForm.reset({
      eurToInr: null,
      insuranceFreightRate: null,
      defaultCustomsDutyRate: null,
      igstRate: null,
      transportationRate: null,
      financeChargesRate: null,
      marginRate: null,
      gstRate: null,
    });

    this.items.set([]);
    this.editingCostSheet.set(null);
    this.editingItemIndex.set(null);
    this.resetItemForm();
    this.errorMessage.set(null);
    this.dialogVisible.set(true);
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingCostSheet.set(null);
  }

  protected toggleExpandSheet(id: number): void {
    this.expandedSheets.update((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  /* ── Item Management (Inside Create/Edit Dialog) ─────── */
  protected resetItemForm(): void {
    this.itemForm.reset({
      quotationNumber: '',
      quotationIndex: String(this.items().length + 1),
      itemDescription: '',
      itemCode: '',
      pricePerUnitEur: null,
      quantity: null,
      customsDutyRate: null,
    });
    this.editingItemIndex.set(null);
  }

  protected saveItem(): void {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }

    const raw = this.itemForm.getRawValue();
    const defaultDuty = this.globalParamsForm.controls.defaultCustomsDutyRate.value || 0;
    const dutyRate = raw.customsDutyRate !== null && raw.customsDutyRate !== undefined && !isNaN(Number(raw.customsDutyRate))
      ? Number(raw.customsDutyRate)
      : defaultDuty;

    const newItem: CostSheetItemInput = {
      quotationNumber: raw.quotationNumber.trim() || `QN-${this.items().length + 1}`,
      quotationIndex: raw.quotationIndex.trim() || String(this.items().length + 1),
      itemDescription: raw.itemDescription.trim(),
      itemCode: raw.itemCode.trim() || `ITEM-${this.items().length + 1}`,
      pricePerUnitEur: Number(raw.pricePerUnitEur) || 0,
      quantity: Number(raw.quantity) || 0,
      customsDutyRate: dutyRate,
    };

    const editIdx = this.editingItemIndex();
    if (editIdx !== null) {
      this.items.update((list) =>
        list.map((it, idx) => (idx === editIdx ? { ...it, ...newItem } : it))
      );
    } else {
      this.items.update((list) => [...list, newItem]);
    }

    this.resetItemForm();
  }

  protected editItem(index: number): void {
    const item = this.items()[index];
    this.itemForm.setValue({
      quotationNumber: item.quotationNumber || '',
      quotationIndex: item.quotationIndex || String(index + 1),
      itemDescription: item.itemDescription || '',
      itemCode: item.itemCode || '',
      pricePerUnitEur: item.pricePerUnitEur !== undefined && item.pricePerUnitEur !== null ? item.pricePerUnitEur : null,
      quantity: item.quantity !== undefined && item.quantity !== null ? item.quantity : null,
      customsDutyRate: item.customsDutyRate !== undefined && item.customsDutyRate !== null ? item.customsDutyRate : null,
    });
    this.editingItemIndex.set(index);
  }

  protected deleteItem(index: number): void {
    this.items.update((list) => list.filter((_, idx) => idx !== index));
    if (this.editingItemIndex() === index) {
      this.resetItemForm();
    }
  }

  /* ── Import from Step 03 Supplier Quotations ─────────── */
  protected openImportDialog(): void {
    this.selectedImportItems.set([]);
    this.importDialogVisible.set(true);
  }

  protected closeImportDialog(): void {
    this.importDialogVisible.set(false);
  }

  protected importAllQuotationItems(quotation: SupplierQuotation): void {
    if (!quotation.items || quotation.items.length === 0) return;

    const defaultDuty = this.globalParamsForm.controls.defaultCustomsDutyRate.value || 7.5;
    const newItems: CostSheetItemInput[] = quotation.items.map((it, idx) => ({
      quotationNumber: quotation.quotation_number || `SQ-${quotation.id}`,
      quotationIndex: String(idx + 1),
      itemDescription: it.material_name,
      itemCode: `MAT-${idx + 1}`,
      pricePerUnitEur: Number(it.unit_price) || 0,
      quantity: Number(it.quantity) || 1,
      customsDutyRate: defaultDuty,
    }));

    this.items.update((list) => [...list, ...newItems]);
    this.messageService.add({
      severity: 'success',
      summary: 'Imported',
      detail: `Imported ${newItems.length} items from quotation ${quotation.quotation_number || quotation.id}.`,
      life: 3000,
    });
    this.closeImportDialog();
  }

  /* ── Submit (POST /api/cost-sheet) ────────────────────── */
  protected submit(): void {
    if (this.headerForm.invalid || this.globalParamsForm.invalid) {
      this.headerForm.markAllAsTouched();
      this.globalParamsForm.markAllAsTouched();
      return;
    }

    if (this.items().length === 0) {
      this.errorMessage.set('Please add at least one line item to create the cost sheet.');
      return;
    }

    const projectId = this.projectId();
    const header = this.headerForm.getRawValue();
    const globalParams = this.activeGlobalParams();

    const payload: CostSheetCreateInput = {
      project_id: projectId,
      title: header.title.trim(),
      globalParams,
      items: this.items().map((it) => ({
        quotationNumber: it.quotationNumber,
        quotationIndex: it.quotationIndex,
        itemDescription: it.itemDescription,
        itemCode: it.itemCode,
        pricePerUnitEur: Number(it.pricePerUnitEur) || 0,
        quantity: Number(it.quantity) || 1,
        customsDutyRate: Number(it.customsDutyRate) || globalParams.defaultCustomsDutyRate,
      })),
    };

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.costSheetService
      .create(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.dialogVisible.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Cost sheet created successfully.',
            life: 3500,
          });
          this.loadCostSheets(projectId);
        },
        error: (err) => {
          this.errorMessage.set(
            err?.error?.message || 'Failed to save cost sheet. Please check your inputs.'
          );
        },
      });
  }

  /* ── Export Cost Sheet (GET /api/cost-sheet/{id}/export) ─ */
  protected exportCostSheet(costSheet: CostSheet, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.exportingId.set(costSheet.id);

    this.costSheetService
      .export(costSheet.id)
      .pipe(finalize(() => this.exportingId.set(null)))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          const cleanTitle = (costSheet.title || `Cost_Sheet_${costSheet.id}`).replace(/\s+/g, '_');
          anchor.download = `${cleanTitle}_v${costSheet.versionNumber || 1}.xlsx`;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          window.URL.revokeObjectURL(url);

          this.messageService.add({
            severity: 'success',
            summary: 'Export Complete',
            detail: `Exported ${costSheet.title || 'Cost Sheet'}.`,
            life: 3000,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Export Failed',
            detail: 'Could not export cost sheet. Please try again.',
            life: 4000,
          });
        },
      });
  }

  /* ── Navigation Helpers ──────────────────────────────── */
  protected goBack(): void {
    this.router.navigate(['/projects', this.projectId(), 'steps']);
  }
}
