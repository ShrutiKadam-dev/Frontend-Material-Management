import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';

import { catchError, finalize, forkJoin, of } from 'rxjs';

import { ProjectStepService } from '../../../../core/services/project-step';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { SupplierService } from '../../../../core/services/supplier';
import { ProjectStep, ProjectStepRemark, StepStatus } from '../../../../core/models/project-step.model';
import { Project } from '../../../../core/models/project.model';
import { Customer } from '../../../../core/models/customer.model';
import { Supplier } from '../../../../core/models/supplier.model';
import { formatDisplayDate } from '../../../../core/utils/date.utils';
import { getCurrentUserFromStorage } from '../../../../core/utils/remark.utils';
import { AppDatePipe } from '../../../../core/pipes/app-date.pipe';
import {
  FORM_CATALOG,
  FormDefinition,
  getFormDefinition,
  LEGACY_STEP_TO_FORM_CODE,
} from '../../../../core/constants/form-catalog';
import { StepFormDialog } from './step-form-dialog/step-form-dialog';

import {
  CATEGORY_TO_PHASE_ID,
  PhaseFilter,
  PhaseInfo,
  PIPELINE_PHASES,
} from '../../../../core/constants/pipeline-phases.constant';

export type { PhaseFilter, PhaseInfo };
export { CATEGORY_TO_PHASE_ID, PIPELINE_PHASES };
export type TimelineStatusFilter = 'all' | 'completed' | 'in_progress' | 'pending';
export type TimelineViewMode = 'grid' | 'board' | 'table';

export interface StepDataBadge {
  icon?: string;
  label: string;
  type?: 'query' | 'tender' | 'order' | 'rfq' | 'finance' | 'logistics' | 'items' | 'neutral';
  tooltip?: string;
}

export interface FormattedStepRemark {
  id?: number;
  sequence: number;
  remark: string;
  user?: string;
  displayUser: string;
  userInitials: string;
  userId?: number;
  date?: string;
  source: 'audit' | 'data';
}

@Component({
  selector: 'app-project-timeline',
  imports: [
    ButtonModule,
    DialogModule,
    TooltipModule,
    InputTextModule,
    AppDatePipe,
    DecimalPipe,
    StepFormDialog,
  ],
  templateUrl: './project-timeline.html',
  styleUrl: './project-timeline.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectTimeline implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectStepService = inject(ProjectStepService);
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly supplierService = inject(SupplierService);
  private readonly messageService = inject(MessageService, { optional: true });

  // Guard flag to prevent duplicate in-flight requests
  private isFetchingData = false;

  // ── Core Data Signals ──────────────────────────────────────────────
  protected readonly project = signal<Project | null>(null);
  protected readonly steps = signal<ProjectStep[]>([]);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // ── Interactive Dashboard Controls ────────────────────────────────
  protected readonly activePhaseFilter = signal<PhaseFilter>('all');
  protected readonly activeStatusFilter = signal<TimelineStatusFilter>('all');
  protected readonly searchQuery = signal<string>('');
  protected readonly viewMode = signal<TimelineViewMode>('grid');

  // ── Dynamic Form Catalog & Dialog Signals ────────────────────────
  protected readonly addStepModalVisible = signal<boolean>(false);
  protected readonly catalogSearch = signal<string>('');
  protected readonly selectedCategory = signal<string>('All');
  protected readonly allCatalogForms = FORM_CATALOG;

  protected readonly catalogCategories = computed(() => {
    const list: Array<{ label: string; count: number }> = [
      { label: 'All', count: this.allCatalogForms.length },
    ];
    const catMap = new Map<string, number>();
    for (const f of this.allCatalogForms) {
      catMap.set(f.category, (catMap.get(f.category) || 0) + 1);
    }
    for (const [cat, count] of catMap.entries()) {
      list.push({ label: cat, count });
    }
    return list;
  });

  // ── Step Form Inputs Popup (GET, POST, PUT, DELETE) ───────────────
  protected readonly stepFormModalVisible = signal<boolean>(false);
  protected readonly selectedStepForForm = signal<ProjectStep | null>(null);
  protected readonly selectedDefForForm = signal<FormDefinition | null>(null);
  protected readonly projectIdNumber = computed(
    () => Number(this.route.snapshot.paramMap.get('projectId')) || 0,
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

  protected clearCatalogSearch(): void {
    this.catalogSearch.set('');
  }

  protected resetCatalogFilters(): void {
    this.catalogSearch.set('');
    this.selectedCategory.set('All');
  }

  protected getCatalogPhaseName(phaseId?: string): string {
    switch (phaseId) {
      case 'phase-1': return 'Phase 1: Pre-Bidding & Tenders';
      case 'phase-2': return 'Phase 2: Sourcing & Quotations';
      case 'phase-3': return 'Phase 3: Supplier Orders & Invoices';
      case 'phase-4': return 'Phase 4: Logistics & Customs';
      case 'phase-5': return 'Phase 5: Customer & Supplier Settlement';
      default: return 'Standard';
    }
  }

  // ── Step Remarks Dialog Signal ────────────────────────────────────
  protected readonly selectedStepForRemarks = signal<ProjectStep | null>(null);
  protected readonly remarksDialogVisible = signal<boolean>(false);
  protected readonly newTimelineRemark = signal<string>('');

  // ── Phases Definition ─────────────────────────────────────────────
  protected readonly phases: PhaseInfo[] = PIPELINE_PHASES;


  // ── KPI Derived Signals ────────────────────────────────────────────
  protected readonly completedCount = computed(
    () => this.steps().filter((s) => s.status === 'completed').length,
  );

  protected readonly inProgressCount = computed(
    () => this.steps().filter((s) => s.status === 'in_progress').length,
  );

  protected readonly pendingCount = computed(
    () => this.steps().filter((s) => s.status === 'pending' || s.status === 'skipped').length,
  );

  protected readonly progressPercent = computed(() =>
    this.steps().length ? Math.round((this.completedCount() / this.steps().length) * 100) : 0,
  );

  protected readonly activeStep = computed<ProjectStep | null>(() => {
    const list = this.steps();
    if (!list.length) return null;
    const inProg = list.find((s) => s.status === 'in_progress');
    if (inProg) return inProg;
    const firstPending = list.find((s) => s.status === 'pending');
    if (firstPending) return firstPending;
    return list[list.length - 1] ?? null;
  });

  protected readonly totalRemarksCount = computed(() => {
    return this.steps().reduce((sum, s) => sum + this.getRemarksCount(s), 0);
  });

  protected readonly projectCode = computed(() => {
    const p = this.project();
    if (!p) return 'PRJ';
    if (p.project_code) return p.project_code;
    return `PRJ-${p.id < 10 ? '0' + p.id : p.id}`;
  });

  // ── Authoritative Phase Resolution ──────────────────────────────
  protected resolveStepPhaseId(s: ProjectStep): string {
    const def = s.form_code
      ? getFormDefinition(s.form_code)
      : s.step_name
        ? getFormDefinition(s.step_name)
        : undefined;

    if (def?.phaseId) return def.phaseId;

    if (s.category && CATEGORY_TO_PHASE_ID[s.category]) {
      return CATEGORY_TO_PHASE_ID[s.category];
    }

    if (s.phase && s.phase.startsWith('phase-')) {
      return s.phase;
    }

    const rawPhaseId = (s as Record<string, unknown>)['phase_id'];
    if (typeof rawPhaseId === 'string' && rawPhaseId.startsWith('phase-')) {
      return rawPhaseId;
    }

    return 'phase-1';
  }

  // ── Filtered Steps for Dashboard ──────────────────────────────────
  protected readonly filteredSteps = computed(() => {
    let list = this.steps();
    const phase = this.activePhaseFilter();
    const status = this.activeStatusFilter();
    const query = this.searchQuery().toLowerCase().trim();

    // Phase Filter
    if (phase !== 'all') {
      list = list.filter((s) => this.resolveStepPhaseId(s) === phase);
    }

    // Status Filter
    if (status === 'completed') {
      list = list.filter((s) => s.status === 'completed');
    } else if (status === 'in_progress') {
      list = list.filter((s) => s.status === 'in_progress');
    } else if (status === 'pending') {
      list = list.filter((s) => s.status === 'pending' || s.status === 'skipped');
    }

    // Search Query Filter
    if (query) {
      list = list.filter(
        (s) =>
          s.step_name.toLowerCase().includes(query) ||
          (s.description && s.description.toLowerCase().includes(query)) ||
          `step ${s.step_number}`.includes(query) ||
          `${s.step_number}` === query,
      );
    }

    return list;
  });

  // ── Phase Groups for Vertical Timeline ─────────────────────────────
  protected readonly timelinePhases = computed(() => {
    return PIPELINE_PHASES.map((phase) => {
      const phaseSteps = this.steps().filter((s) => this.resolveStepPhaseId(s) === phase.id);

      const completedInPhase = phaseSteps.filter((s) => s.status === 'completed').length;
      return {
        ...phase,
        steps: phaseSteps,
        completedCount: completedInPhase,
        totalCount: phaseSteps.length,
        isCompleted: phaseSteps.length > 0 && completedInPhase === phaseSteps.length,
        hasActive: phaseSteps.some((s) => s.status === 'in_progress'),
      };
    });
  });

  // ── Phase Columns for Board View ─────────────────────────────────
  protected readonly boardPhases = computed(() => {
    return this.timelinePhases();
  });

  ngOnInit(): void {
    this.loadProjectAndSteps();
  }

  protected loadProjectAndSteps(): void {
    if (this.isFetchingData) {
      return;
    }

    const id = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!id) {
      this.error.set('Invalid project ID.');
      this.loading.set(false);
      return;
    }

    this.isFetchingData = true;
    this.loading.set(true);
    this.error.set(null);

    // Clean, production-ready architecture:
    // 1. Fetch only this specific project: GET /api/v1/projects/:id
    // 2. Fetch the project pipeline steps: GET /api/v1/projects/:id/steps
    // No redundant calls to GET /api/v1/projects (loading all projects)
    // No separate ad-hoc calls to GET /api/v1/customer-queries (all step info lives on step.data)
    forkJoin({
      project: this.projectService.getProjectById(id).pipe(
        catchError(() => of(null)),
      ),
      steps: this.projectStepService.getSteps(id).pipe(
        catchError(() => of([] as ProjectStep[])),
      ),
    })
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.isFetchingData = false;
        }),
      )
      .subscribe({
        next: ({ project, steps }) => {
          if (!project) {
            this.error.set('Failed to load project details.');
            return;
          }
          this.project.set(project);
          this.steps.set(steps || []);
          this.loadCustomerAndSupplier(project);
        },
        error: () => {
          this.error.set('Failed to load project pipeline. Please verify backend connection.');
        },
      });
  }

  private loadCustomerAndSupplier(p: Project): void {
    // If project already contains customer_name & supplier_name, don't make redundant API calls
    if (p.customer_id && !p.customer_name) {
      this.customerService.getCustomerById(p.customer_id).subscribe({
        next: (cust) => this.customer.set(cust),
        error: () => {/* fallback gracefully */ },
      });
    }
    if (p.supplier_id && !p.supplier_name) {
      this.supplierService.getSupplierById(p.supplier_id).subscribe({
        next: (supp) => this.supplier.set(supp),
        error: () => {/* fallback gracefully */ },
      });
    }
  }

  protected goBack(): void {
    this.router.navigate(['/projects']);
  }

  protected isStepClickable(stepOrNumber: ProjectStep | number): boolean {
    return true;
  }

  protected extractStepData(step: ProjectStep): Record<string, unknown> {
    const rootData: Record<string, unknown> = { ...(step as unknown as Record<string, unknown>) };
    let nestedData: Record<string, unknown> = {};
    if (step.data) {
      if (typeof step.data === 'object' && !Array.isArray(step.data)) {
        nestedData = step.data as Record<string, unknown>;
      } else if (typeof step.data === 'string') {
        try {
          const parsed = JSON.parse(step.data);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            nestedData = parsed as Record<string, unknown>;
          }
        } catch {
          nestedData = {};
        }
      }
    }
    return { ...rootData, ...nestedData };
  }

  protected isCustomerQueryStep(step: ProjectStep): boolean {
    const code = (step.form_code || '').toUpperCase();
    const name = (step.step_name || '').toLowerCase();

    // Explicitly exclude tender, bid, invoice, and other non-query steps
    if (
      code === 'FORM_01_PQB' ||
      code === 'FORM_03_CORRIGENDUM' ||
      code === 'FORM_04_LTE' ||
      code === 'FORM_06_CONSULTANCY_INVOICE' ||
      code === 'FORM_13_PAC_TENDER' ||
      code === 'FORM_15_BID_DOCUMENT' ||
      code === 'FORM_29_BID_DOC_TECHNO_COMMERCIAL' ||
      code === 'FORM_09_RFQ' ||
      code === 'FORM_11_SUPPLIER_QUOTATION' ||
      code === 'FORM_12_CUSTOMER_QUOTATION' ||
      code === 'FORM_14_PURCHASE_ORDER' ||
      code === 'FORM_16_ORDER_CONFIRMATION' ||
      name.includes('pre-qualification') ||
      name.includes('corrigendum') ||
      name.includes('tender') ||
      name.includes('bid document') ||
      name.includes('techno-commercial') ||
      name.includes('consultancy invoice') ||
      name.includes('purchase order')
    ) {
      return false;
    }

    return (
      code === 'FORM_08_CUSTOMER_QUERY' ||
      code.includes('CUSTOMER_QUERY') ||
      name === 'customer query' ||
      name === 'query from customer' ||
      name.includes('customer query') ||
      name.includes('customer enquiry') ||
      name.includes('client query') ||
      (name.includes('query') &&
        !name.includes('pre-bid') &&
        !name.includes('bid meeting') &&
        !name.includes('pre-qualification') &&
        !name.includes('tender enquiry'))
    );
  }

  protected navigateToStep(stepOrNumber: ProjectStep | number): void {
    const pId = this.projectIdNumber();
    if (!pId) return;

    const step =
      typeof stepOrNumber === 'number'
        ? this.steps().find((s) => s.step_number === stepOrNumber || s.id === stepOrNumber)
        : stepOrNumber;

    let formCode = step?.form_code;
    if (!formCode && step?.step_number) {
      formCode = getFormDefinition(step.step_number)?.formCode;
    } else if (!formCode && typeof stepOrNumber === 'number') {
      formCode = getFormDefinition(stepOrNumber)?.formCode;
    }

    if (formCode) {
      this.router.navigate(['/projects', pId, 'forms', formCode]);
    } else {
      const stepNum = typeof stepOrNumber === 'number' ? stepOrNumber : (step?.step_number || 1);
      this.router.navigate(['/projects', pId, 'step-entries', stepNum]);
    }
  }

  protected openStepFormPopup(step: ProjectStep): void {
    this.navigateToStep(step);
  }

  protected continueActiveStep(): void {
    const active = this.activeStep();
    if (active) {
      this.navigateToStep(active);
    } else if (this.steps().length > 0) {
      this.navigateToStep(this.steps()[0]);
    } else {
      this.openAddStepModal();
    }
  }

  protected openAddStepModal(categoryOrPhase?: string): void {
    if (categoryOrPhase) {
      const matched = this.allCatalogForms.find(
        (f) => f.category === categoryOrPhase || f.phaseId === categoryOrPhase,
      );
      if (matched) {
        this.selectedCategory.set(matched.category);
      }
    }
    this.addStepModalVisible.set(true);
  }

  protected onSelectCatalogForm(form: FormDefinition): void {
    // Close catalog modal
    this.addStepModalVisible.set(false);

    const pId = this.projectIdNumber();
    if (!pId) return;

    // Open Step Form Inputs Dialog directly to attach form to this project
    this.selectedStepForForm.set(null);
    this.selectedDefForForm.set(form);
    this.stepFormModalVisible.set(true);
  }

  protected onStepSaved(savedStep: ProjectStep): void {
    this.steps.update((cur) => {
      const idx = cur.findIndex(
        (s) => (s.id && s.id === savedStep.id) || s.step_number === savedStep.step_number,
      );
      if (idx >= 0) {
        const copy = [...cur];
        copy[idx] = savedStep;
        return copy;
      }
      return [...cur, savedStep];
    });
  }

  protected onStepDeleted(stepId: number): void {
    this.steps.update((cur) =>
      cur.filter((s) => s.id !== stepId && s.step_number !== stepId),
    );
  }

  protected removeStep(step: ProjectStep, event: Event): void {
    event.stopPropagation();
    const projectId = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!projectId) return;

    const stepId = step.id || step.step_number;
    this.projectStepService.removeStep(projectId, stepId).subscribe({
      next: () => {
        this.steps.update((cur) =>
          cur.filter((s) => s.id !== step.id && s.step_number !== step.step_number),
        );
      },
    });
  }

  protected setPhaseFilter(phase: PhaseFilter): void {
    this.activePhaseFilter.set(phase);
  }

  protected setStatusFilter(status: TimelineStatusFilter): void {
    this.activeStatusFilter.set(status);
  }

  protected setViewMode(mode: TimelineViewMode): void {
    this.viewMode.set(mode);
  }

  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  // ── Step Remarks Support ──────────────────────────────────────────
  protected getStepRemarks(step: ProjectStep): FormattedStepRemark[] {
    const list: FormattedStepRemark[] = [];
    let seq = 1;

    if (step.remarks && Array.isArray(step.remarks)) {
      for (const r of step.remarks) {
        if (r && r.remark && r.remark.trim()) {
          const rawUser = r.user || (r.user_id ? `User #${r.user_id}` : undefined);
          const isPlaceholder = !r.user || r.user === 'string string' || !r.user.trim();
          const displayUser = isPlaceholder
            ? (r.user_id ? `Admin (User #${r.user_id})` : 'Audit Member')
            : (r.user?.trim() || 'Audit Member');
          const initials = this.extractInitials(displayUser);

          list.push({
            id: r.id,
            sequence: seq++,
            remark: r.remark.trim(),
            user: rawUser,
            displayUser,
            userInitials: initials,
            userId: r.user_id,
            date: r.created_at ? formatDisplayDate(r.created_at, 'dd-MM-yyyy HH:mm') : undefined,
            source: 'audit',
          });
        }
      }
    }

    if (step.data && typeof step.data === 'object' && Array.isArray((step.data as Record<string, unknown>)['remarks'])) {
      const dataRemarks = (step.data as Record<string, unknown>)['remarks'] as unknown[];
      for (const dr of dataRemarks) {
        if (typeof dr === 'string' && dr.trim()) {
          const trimmed = dr.trim();
          if (!list.some((item) => item.remark === trimmed)) {
            list.push({
              sequence: seq++,
              remark: trimmed,
              user: 'Form Entry',
              displayUser: 'Step Data Log',
              userInitials: 'SD',
              source: 'data',
            });
          }
        }
      }
    }
    return list;
  }

  private extractInitials(name: string): string {
    if (!name) return 'ST';
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (name[0] || 'ST').toUpperCase();
  }

  protected getRemarksCount(step: ProjectStep): number {
    return this.getStepRemarks(step).length;
  }

  protected openRemarksDialog(step: ProjectStep, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedStepForRemarks.set(step);
    this.newTimelineRemark.set('');
    this.remarksDialogVisible.set(true);
  }

  protected addTimelineRemark(step: ProjectStep): void {
    const text = this.newTimelineRemark().trim();
    if (!text) return;

    const session = getCurrentUserFromStorage();
    const userName = session?.user || 'Audit Member';

    const newRemark: ProjectStepRemark = {
      remark: text,
      user: userName,
      created_at: new Date().toISOString(),
    };

    const currentRemarks = Array.isArray(step.remarks) ? [...step.remarks] : [];
    const updatedRemarks = [...currentRemarks, newRemark];
    const updatedStep: ProjectStep = {
      ...step,
      remarks: updatedRemarks,
    };

    this.selectedStepForRemarks.set(updatedStep);
    this.onStepSaved(updatedStep);
    this.newTimelineRemark.set('');

    const pid = this.projectIdNumber();
    if (pid && step.id) {
      this.projectStepService.updateStep(pid, step.id, step.data || {}, step.status, step.progress_percentage).subscribe({
        error: (e) => console.warn('Could not persist timeline remark to backend:', e),
      });
    }

    this.messageService?.add({
      severity: 'success',
      summary: 'Remark Recorded',
      detail: 'New remark saved to timeline.',
    });
  }

  protected getStepDataBadges(step: ProjectStep): StepDataBadge[] {
    const badges: StepDataBadge[] = [];
    const d = this.extractStepData(step);
    const isQuery = this.isCustomerQueryStep(step);

    // ── 1. ACTUAL CUSTOMER QUERY DETAILS (Standard Indigo Format for Managers) ──
    if (isQuery) {
      // Query Reference / Number
      const qRef = d['query_no'] || d['query_reference'] || d['ref_no'] || d['reference_no'];
      if (qRef) {
        badges.push({
          icon: 'pi pi-hashtag',
          label: `Query #${qRef}`,
          type: 'query',
          tooltip: `Customer Query Reference: ${qRef}`,
        });
      }

      // Customer / Client Name
      const custName = d['customer_name'] || d['client_name'] || d['organization_name'];
      if (custName) {
        const rawCust = String(custName).trim();
        const cleanCust = rawCust.length > 24 ? rawCust.slice(0, 22) + '…' : rawCust;
        badges.push({
          icon: 'pi pi-user',
          label: cleanCust,
          type: 'query',
          tooltip: `Customer: ${rawCust}`,
        });
      }

      // Material Requirements / Scope Items
      if (Array.isArray(d['items']) && d['items'].length > 0) {
        const items = d['items'] as Record<string, unknown>[];
        if (items.length === 1 && (items[0]['description'] || items[0]['material_name'])) {
          const rawDesc = String(items[0]['description'] || items[0]['material_name']).trim();
          const cleanDesc = rawDesc.length > 26 ? rawDesc.slice(0, 24) + '…' : rawDesc;
          badges.push({
            icon: 'pi pi-question-circle',
            label: `Req: ${cleanDesc}`,
            type: 'query',
            tooltip: `Customer Requirement: ${rawDesc}`,
          });
        } else {
          badges.push({
            icon: 'pi pi-question-circle',
            label: `${items.length} Requirements`,
            type: 'query',
            tooltip: `${items.length} requirements queried by customer`,
          });
        }
      } else if (d['material_name'] || d['material_requirements'] || d['subject'] || d['query_subject']) {
        const rawReq = String(d['material_name'] || d['material_requirements'] || d['subject'] || d['query_subject']).trim();
        const cleanReq = rawReq.length > 26 ? rawReq.slice(0, 24) + '…' : rawReq;
        badges.push({
          icon: 'pi pi-question-circle',
          label: `Req: ${cleanReq}`,
          type: 'query',
          tooltip: rawReq,
        });
      } else {
        badges.push({
          icon: 'pi pi-question-circle',
          label: 'Customer Query',
          type: 'query',
          tooltip: 'Customer query registered for project',
        });
      }
    }

    // ── 2. PRE-QUALIFICATION BID (PQB) & TENDER IDENTIFIERS (Standard Blue Format) ──
    const pqbNo = d['pqb_no'] || d['pqb_number'];
    if (pqbNo) {
      badges.push({
        icon: 'pi pi-file-check',
        label: `PQB #${pqbNo}`,
        type: 'tender',
        tooltip: `Pre-Qualification Bid No: ${pqbNo}`,
      });
    }

    const tenderNo = d['tender_enquiry_no'] || d['tender_no'] || d['tender_ref_no'];
    if (tenderNo) {
      badges.push({
        icon: 'pi pi-briefcase',
        label: `Tender #${tenderNo}`,
        type: 'tender',
        tooltip: `Tender Enquiry No: ${tenderNo}`,
      });
    }

    if (d['corrigendum_no']) {
      badges.push({
        icon: 'pi pi-sync',
        label: `Corrigendum #${d['corrigendum_no']}`,
        type: 'tender',
      });
    }

    if (d['total_no_corrigendum_issued'] !== undefined && d['total_no_corrigendum_issued'] !== null) {
      const c = Number(d['total_no_corrigendum_issued']);
      if (c > 0) {
        badges.push({
          icon: 'pi pi-sync',
          label: `${c} Corrigend${c === 1 ? 'um' : 'a'}`,
          type: 'tender',
          tooltip: `${c} corrigendum notices recorded`,
        });
      }
    }

    if (d['eoi_no']) {
      badges.push({
        icon: 'pi pi-compass',
        label: `EOI #${d['eoi_no']}`,
        type: 'tender',
      });
    }

    // ── 3. PURCHASE ORDERS (Corporate Purple Format) ──
    const poNum = d['po_number'] || d['po_no'];
    if (poNum) {
      badges.push({
        icon: 'pi pi-shopping-bag',
        label: `PO #${poNum}`,
        type: 'order',
        tooltip: `Purchase Order Number: ${poNum}`,
      });
    }

    // ── 4. RFQ & SOURCING (Warm Amber Format) ──
    if (d['supplier_contacted'] === true) {
      badges.push({
        icon: 'pi pi-check-circle',
        label: 'Supplier Contacted',
        type: 'rfq',
      });
    }

    if (d['quotation_requested_date']) {
      badges.push({
        icon: 'pi pi-send',
        label: `RFQ: ${formatDisplayDate(d['quotation_requested_date'] as string)}`,
        type: 'rfq',
      });
    }

    if (d['quotation_no'] || d['quote_no']) {
      badges.push({
        icon: 'pi pi-tag',
        label: `Quote #${d['quotation_no'] || d['quote_no']}`,
        type: 'rfq',
      });
    }

    // ── 5. INVOICES & FINANCE (Emerald Format) ──
    const invNum = d['invoice_number'] || d['invoice_no'];
    if (invNum) {
      badges.push({
        icon: 'pi pi-receipt',
        label: `Inv #${invNum}`,
        type: 'finance',
        tooltip: `Invoice Number: ${invNum}`,
      });
    }

    if (d['nac_no']) {
      badges.push({
        icon: 'pi pi-verified',
        label: `NAC #${d['nac_no']}`,
        type: 'finance',
        tooltip: `Notification of Award of Contract: ${d['nac_no']}`,
      });
    }

    // ── 6. LOGISTICS & CUSTOMS (Cyan Format) ──
    const boeNum = d['bill_of_entry_no'] || d['boe_no'];
    if (boeNum) {
      badges.push({
        icon: 'pi pi-shield',
        label: `BOE #${boeNum}`,
        type: 'logistics',
        tooltip: `Bill of Entry: ${boeNum}`,
      });
    }

    const dcNum = d['dc_number'] || d['delivery_challan_no'] || d['dc_no'];
    if (dcNum) {
      badges.push({
        icon: 'pi pi-truck',
        label: `DC #${dcNum}`,
        type: 'logistics',
        tooltip: `Delivery Challan: ${dcNum}`,
      });
    }

    // ── 7. SCOPE ITEMS (For Non-Query steps with line items) ──
    if (!isQuery && Array.isArray(d['items']) && d['items'].length > 0) {
      const items = d['items'] as Record<string, unknown>[];
      if (items.length === 1 && (items[0]['description'] || items[0]['material_name'])) {
        const rawDesc = String(items[0]['description'] || items[0]['material_name']).trim();
        const cleanDesc = rawDesc.length > 26 ? rawDesc.slice(0, 24) + '…' : rawDesc;
        badges.push({
          icon: 'pi pi-box',
          label: cleanDesc,
          type: 'items',
          tooltip: rawDesc,
        });
      } else {
        badges.push({
          icon: 'pi pi-box',
          label: `${items.length} ${items.length === 1 ? 'Item' : 'Items'}`,
          type: 'items',
          tooltip: `${items.length} scope items recorded`,
        });
      }
    }

    return badges;
  }

  protected getPhaseForStep(stepNumberOrStep: number | ProjectStep): PhaseInfo {
    if (typeof stepNumberOrStep === 'object' && stepNumberOrStep !== null) {
      const phaseId = this.resolveStepPhaseId(stepNumberOrStep);
      const found = PIPELINE_PHASES.find((p) => p.id === phaseId);
      if (found) return found;
      return PIPELINE_PHASES[0];
    }
    const stepNumber = stepNumberOrStep;
    const match = this.steps().find((s) => s.step_number === stepNumber);
    if (match) {
      return this.getPhaseForStep(match);
    }
    if (stepNumber <= 7) return PIPELINE_PHASES[0];
    if (stepNumber <= 11) return PIPELINE_PHASES[1];
    if (stepNumber <= 15) return PIPELINE_PHASES[2];
    if (stepNumber <= 19) return PIPELINE_PHASES[3];
    return PIPELINE_PHASES[4];
  }

  protected statusLabel(status: StepStatus): string {
    const map: Record<StepStatus, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      skipped: 'Skipped',
    };
    return map[status] ?? status;
  }

  protected statusIcon(status: StepStatus): string {
    const map: Record<StepStatus, string> = {
      pending: 'pi-clock',
      in_progress: 'pi-spin pi-spinner',
      completed: 'pi-check',
      skipped: 'pi-minus',
    };
    return map[status] ?? 'pi-clock';
  }

  // ── Step Date Label Resolution ──
  protected resolveStepDateLabel(step: ProjectStep, fallbackLabel = 'Date'): string {
    const code = (step.form_code || (step.step_number ? LEGACY_STEP_TO_FORM_CODE[step.step_number] : '') || '').toUpperCase();
    const name = (step.step_name || '').toLowerCase();

    if (code.includes('CORRIGENDUM') || name.includes('corrigendum')) return 'Issue Date';
    if (code.includes('PQB') || name.includes('pqb') || name.includes('pre-qualification')) return 'PQB Closed';
    if (code.includes('QUERY') || name.includes('query') || name.includes('requirement')) return 'Query Date';
    if (code.includes('RFQ') || name.includes('rfq') || name.includes('request supplier quotation') || name.includes('quotation request')) return 'RFQ Date';
    if (code.includes('CUSTOMER_QUOTATION') || name.includes('quotation to customer')) return 'Quotation Date';
    if (code.includes('QUOTATION') || name.includes('quotation') || name.includes('quote')) return 'Quotation Date';
    if (code.includes('COST_SHEET') || name.includes('cost sheet')) return 'Cost Sheet Date';
    if (code.includes('TENDER') || name.includes('tender')) return 'Closing Date';
    if (code.includes('BID') || name.includes('bid')) return 'Submission Date';
    if (code.includes('PURCHASE_ORDER') || name.includes('po') || name.includes('purchase order')) {
      return fallbackLabel === 'Delivery Date' ? 'Delivery Date' : 'PO Date';
    }
    if (code.includes('ORDER_CONFIRMATION') || name.includes('order confirmation') || name.includes('confirmation')) return 'Confirmation Date';
    if (code.includes('PROFORMA') || name.includes('proforma')) return 'PI Date';
    if (code.includes('INVOICE') || name.includes('invoice')) {
      return fallbackLabel === 'Due Date' ? 'Due Date' : 'Invoice Date';
    }
    if (code.includes('CHALLAN') || name.includes('challan')) return 'Challan Date';
    if (code.includes('PACKING') || name.includes('packing')) return 'Packing List Date';
    if (code.includes('PAYMENT') || name.includes('payment')) return 'Payment Date';
    if (code.includes('WARRANTY') || name.includes('warranty')) return 'Warranty Date';
    if (code.includes('EWAY') || name.includes('eway') || name.includes('e-way')) return 'E-Way Date';
    if (code.includes('FREIGHT') || code.includes('CHA') || name.includes('cha') || name.includes('freight')) return 'Duty Paid Date';
    if (code.includes('SHIPPING') || code.includes('CLEARANCE') || name.includes('clearance') || name.includes('boe')) return 'BOE Date';
    if (code.includes('TRANSPORT') || name.includes('transport') || name.includes('dispatch')) return 'Dispatch Date';
    if (code.includes('NAC') || name.includes('award') || name.includes('nac')) return 'Award Date';
    if (code.includes('LTE') || code.includes('EOI') || code.includes('STE') || name.includes('lte') || name.includes('eoi') || name.includes('ste')) return 'Closing Date';
    return fallbackLabel;
  }

  // ── Date Extraction Helper (Displays contextual business date label e.g. Query Date, RFQ Date, Cost Sheet Date) ──
  protected getStepDate(step: ProjectStep): { label: string; date: string } | null {
    const d = this.extractStepData(step);

    const priorityDatePairs: [string, string][] = [
        ['bid_submission_due_date_time', 'Due Date'],
        ['bid_opening_date_time', 'Opening Date'],
        ['pqb_closing_date_time', 'PQB Closed'],
        ['pqb_closing_date', 'PQB Closed'],
        ['closing_date_time', 'Closing Date'],
        ['closing_date', 'Closing Date'],
        ['submission_deadline', 'Due Date'],
        ['pqb_issuing_date', 'PQB Issue Date'],
        ['pqb_issue_date', 'PQB Issue Date'],
        ['due_date', 'Due Date'],
        ['qo_date', 'Query Date'],
        ['query_date', 'Query Date'],
        ['quotation_requested_date', 'RFQ Date'],
        ['rfq_date', 'RFQ Date'],
        ['request_date', 'RFQ Date'],
        ['quotation_date', 'Quotation Date'],
        ['quote_date', 'Quotation Date'],
        ['valid_till', 'Valid Till'],
        ['tender_date', 'Tender Date'],
        ['tender_issue_date', 'Tender Date'],
        ['bid_submission_date', 'Submission Date'],
        ['submission_date', 'Submission Date'],
        ['po_date', 'PO Date'],
        ['order_confirmation_date', 'Confirmation Date'],
        ['confirmation_date', 'Confirmation Date'],
        ['order_date', 'Order Date'],
        ['proforma_invoice_date', 'PI Date'],
        ['invoice_date', 'Invoice Date'],
        ['delivery_date', 'Delivery Date'],
        ['expected_delivery_date', 'Delivery Date'],
        ['target_delivery_date', 'Delivery Date'],
        ['delivery_challan_date', 'Challan Date'],
        ['challan_date', 'Challan Date'],
        ['packing_list_date', 'Packing List Date'],
        ['payment_date', 'Payment Date'],
        ['payment_received_date', 'Payment Date'],
        ['certificate_date', 'Warranty Date'],
        ['boe_date', 'BOE Date'],
        ['boe_filing_date', 'BOE Date'],
        ['bill_of_entry_date', 'BOE Date'],
        ['duty_paid_date', 'Duty Paid Date'],
        ['eway_bill_date', 'E-Way Date'],
        ['dispatch_date', 'Dispatch Date'],
        ['lr_date', 'LR Date'],
        ['lr_rr_awb_date', 'LR Date'],
        ['shipment_date', 'Shipment Date'],
        ['clearance_date', 'Clearance Date'],
        ['eoi_date', 'EOI Date'],
        ['nac_date', 'Award Date'],
        ['cost_sheet_date', 'Cost Sheet Date'],
        ['effective_date', 'Cost Sheet Date'],
        ['date', 'Date'],
      ];

      for (const [key, fallbackLabel] of priorityDatePairs) {
        const dateVal = d[key];
        if (dateVal && (typeof dateVal === 'string' || typeof dateVal === 'number' || dateVal instanceof Date)) {
          if (typeof dateVal === 'string' && /^\d{1,4}$/.test(dateVal.trim())) {
            continue;
          }
          const formatted = formatDisplayDate(dateVal);
          if (formatted && formatted !== '—') {
            const label = this.resolveStepDateLabel(step, fallbackLabel);
            return {
              label,
              date: formatted,
            };
          }
        }
      }

    if (step.completed_at) {
      const formatted = formatDisplayDate(step.completed_at);
      if (formatted && formatted !== '—') {
        const label = this.resolveStepDateLabel(step, 'Date');
        return {
          label,
          date: formatted,
        };
      }
    }

    return null;
  }
}

