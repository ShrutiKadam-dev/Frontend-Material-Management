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

import { ProjectStepService } from '../../../../core/services/project-step';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { SupplierService } from '../../../../core/services/supplier';
import { CustomerQueryService } from '../../../../core/services/customer-query';
import { CustomerQuery } from '../../../../core/models/customer-query.model';
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

export type PhaseFilter = 'all' | 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4' | 'phase-5';
export type TimelineStatusFilter = 'all' | 'completed' | 'in_progress' | 'pending';
export type TimelineViewMode = 'grid' | 'board' | 'table';

export interface PhaseInfo {
  id: PhaseFilter;
  title: string;
  shortTitle: string;
  stepRange: string;
  badgeClass: string;
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

export const PIPELINE_PHASES: PhaseInfo[] = [
  {
    id: 'phase-1',
    title: 'Pre-Bidding & Tenders',
    shortTitle: 'Phase 1: Pre-Bidding',
    stepRange: 'Phase 1',
    badgeClass: 'phase-pill--bidding',
  },
  {
    id: 'phase-2',
    title: 'Sourcing & Quotations',
    shortTitle: 'Phase 2: Sourcing',
    stepRange: 'Phase 2',
    badgeClass: 'phase-pill--sourcing',
  },
  {
    id: 'phase-3',
    title: 'Supplier Orders & Invoices',
    shortTitle: 'Phase 3: Orders',
    stepRange: 'Phase 3',
    badgeClass: 'phase-pill--orders',
  },
  {
    id: 'phase-4',
    title: 'Logistics & Customs',
    shortTitle: 'Phase 4: Logistics',
    stepRange: 'Phase 4',
    badgeClass: 'phase-pill--logistics',
  },
  {
    id: 'phase-5',
    title: 'Customer & Supplier Settlement',
    shortTitle: 'Phase 5: Settlement',
    stepRange: 'Phase 5',
    badgeClass: 'phase-pill--settlement',
  },
];

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
  private readonly customerQueryService = inject(CustomerQueryService);
  private readonly messageService = inject(MessageService, { optional: true });

  // ── Core Data Signals ──────────────────────────────────────────────
  protected readonly project = signal<Project | null>(null);
  protected readonly steps = signal<ProjectStep[]>([]);
  protected readonly customerQueries = signal<CustomerQuery[]>([]);
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

  // ── Filtered Steps for Dashboard ──────────────────────────────────
  protected readonly filteredSteps = computed(() => {
    let list = this.steps();
    const phase = this.activePhaseFilter();
    const status = this.activeStatusFilter();
    const query = this.searchQuery().toLowerCase().trim();

    // Phase Filter
    if (phase !== 'all') {
      list = list.filter((s) => {
        if (s.phase) return s.phase === phase;
        if (s.form_code) {
          const def = getFormDefinition(s.form_code);
          if (def?.phaseId) return def.phaseId === phase;
        }
        return false;
      });
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
      const phaseSteps = this.steps().filter((s) => {
        if (s.phase) return s.phase === phase.id;
        if (s.form_code) {
          const def = getFormDefinition(s.form_code);
          if (def?.phaseId) return def.phaseId === phase.id;
        }
        if (phase.id === 'phase-1') {
          return (s.step_number >= 1 && s.step_number <= 7) || s.step_number === 13 || s.step_number === 15;
        } else if (phase.id === 'phase-2') {
          return s.step_number >= 8 && s.step_number <= 12;
        } else if (phase.id === 'phase-3') {
          return s.step_number === 14 || (s.step_number >= 16 && s.step_number <= 20);
        } else if (phase.id === 'phase-4') {
          return s.step_number === 21 || s.step_number === 27 || s.step_number === 28;
        } else if (phase.id === 'phase-5') {
          return s.step_number >= 22 && s.step_number <= 26;
        }
        return false;
      });

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
    const id = Number(this.route.snapshot.paramMap.get('projectId'));
    if (!id) {
      this.error.set('Invalid project ID.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.projectService.getProjectById(id).subscribe({
      next: (p) => {
        this.project.set(p);
        this.loadCustomerAndSupplier(p);

        // Enrich total_value and metadata from /api/v1/projects
        this.projectService.getProjects().subscribe({
          next: (allProjects) => {
            const match = allProjects.find((item) => item.id === id);
            if (match) {
              this.project.update((cur) => {
                if (!cur) return match;
                return {
                  ...cur,
                  total_value: match.total_value !== undefined && match.total_value !== null ? Number(match.total_value) : cur.total_value,
                  total_margin: match.total_margin !== undefined && match.total_margin !== null ? Number(match.total_margin) : cur.total_margin,
                  currency: match.currency || cur.currency || 'INR',
                  created_at: cur.created_at || match.created_at,
                  updated_at: match.updated_at || cur.updated_at,
                  customer_name: match.customer_name || cur.customer_name,
                  supplier_name: match.supplier_name || cur.supplier_name,
                };
              });
            }
          },
          error: () => { },
        });
      },
      error: () => {
        // Fallback to fetch from list if direct by-id endpoint fails
        this.projectService.getProjects().subscribe({
          next: (allProjects) => {
            const match = allProjects.find((item) => item.id === id);
            if (match) {
              this.project.set(match);
              this.loadCustomerAndSupplier(match);
            }
          },
          error: () => { },
        });
      },
    });

    this.projectStepService.getSteps(id).subscribe({
      next: (data) => {
        this.steps.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load project steps. Please verify backend connection.');
        this.loading.set(false);
      },
    });

    this.customerQueryService.getByProject(id).subscribe({
      next: (data) => {
        this.customerQueries.set(data || []);
      },
      error: () => {
        // Fallback gracefully
      },
    });
  }

  private loadCustomerAndSupplier(p: Project): void {
    if (p.customer_id) {
      this.customerService.getCustomerById(p.customer_id).subscribe({
        next: (cust) => this.customer.set(cust),
        error: () => {/* fallback gracefully */ },
      });
    }
    if (p.supplier_id) {
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

  protected isCustomerQueryStep(step: ProjectStep): boolean {
    return (
      step.step_number === 1 ||
      step.form_code === 'FORM_08_CUSTOMER_QUERY' ||
      (step.step_name ? step.step_name.toLowerCase().includes('query') : false)
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

    this.router.navigate(['/projects', pId, 'forms', form.formCode]);
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

  protected getStepDataBadges(step: ProjectStep): { icon?: string; label: string }[] {
    const badges: { icon?: string; label: string }[] = [];

    if (
      this.customerQueries &&
      typeof this.customerQueries === 'function' &&
      this.isCustomerQueryStep(step) &&
      this.customerQueries().length > 0
    ) {
      const qCount = this.customerQueries().length;
      badges.push({
        icon: 'pi pi-file-edit',
        label: `${qCount} ${qCount === 1 ? 'Query' : 'Queries'}`,
      });
    }

    if (!step.data || typeof step.data !== 'object') return badges;
    const d = step.data as Record<string, unknown>;

    if (d['supplier_contacted'] === true) {
      badges.push({ icon: 'pi pi-check-circle', label: 'Supplier Contacted' });
    }
    if (d['quotation_requested_date']) {
      badges.push({ icon: 'pi pi-send', label: `RFQ: ${formatDisplayDate(d['quotation_requested_date'] as string)}` });
    }
    if (d['po_number'] || d['po_no']) {
      badges.push({ icon: 'pi pi-file', label: `PO #${d['po_number'] || d['po_no']}` });
    }
    if (d['invoice_number'] || d['invoice_no']) {
      badges.push({ icon: 'pi pi-receipt', label: `Inv #${d['invoice_number'] || d['invoice_no']}` });
    }
    if (d['bill_of_entry_no'] || d['boe_no']) {
      badges.push({ icon: 'pi pi-shield', label: `BOE #${d['bill_of_entry_no'] || d['boe_no']}` });
    }
    if (d['dc_number'] || d['delivery_challan_no']) {
      badges.push({ icon: 'pi pi-truck', label: `DC #${d['dc_number'] || d['delivery_challan_no']}` });
    }
    return badges;
  }

  protected getPhaseForStep(stepNumberOrStep: number | ProjectStep): PhaseInfo {
    if (typeof stepNumberOrStep === 'object' && stepNumberOrStep !== null) {
      if (stepNumberOrStep.phase) {
        const found = PIPELINE_PHASES.find((p) => p.id === stepNumberOrStep.phase);
        if (found) return found;
      }
      if (stepNumberOrStep.form_code) {
        const def = getFormDefinition(stepNumberOrStep.form_code);
        if (def?.phaseId) {
          const found = PIPELINE_PHASES.find((p) => p.id === def.phaseId);
          if (found) return found;
        }
      }
      return this.getPhaseForStep(stepNumberOrStep.step_number);
    }
    const stepNumber = stepNumberOrStep;
    if (stepNumber <= 7 || stepNumber === 13 || stepNumber === 15) return PIPELINE_PHASES[0];
    if (stepNumber <= 12) return PIPELINE_PHASES[1];
    if (stepNumber === 14 || (stepNumber >= 16 && stepNumber <= 20)) return PIPELINE_PHASES[2];
    if (stepNumber === 21 || stepNumber === 27 || stepNumber === 28) return PIPELINE_PHASES[3];
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

  // ── Existing Date Extraction Helper (Preserved for full unit-test compatibility) ──
  protected getStepDate(step: ProjectStep): { label: string; date: string } | null {
    if (step.completed_at) {
      const formatted = formatDisplayDate(step.completed_at);
      if (formatted && formatted !== '—') {
        return {
          label: 'Completed',
          date: formatted,
        };
      }
    }

    if (
      this.customerQueries &&
      typeof this.customerQueries === 'function' &&
      this.isCustomerQueryStep(step) &&
      this.customerQueries().length > 0
    ) {
      const first = this.customerQueries()[0];
      if (first?.qo_date) {
        const formatted = formatDisplayDate(first.qo_date);
        if (formatted && formatted !== '—') {
          return {
            label: step.status === 'completed' ? 'Completed' : 'Query Date',
            date: formatted,
          };
        }
      }
    }

    let d: Record<string, unknown> | null = null;
    if (step.data) {
      if (typeof step.data === 'object' && !Array.isArray(step.data)) {
        d = step.data as Record<string, unknown>;
      } else if (typeof step.data === 'string') {
        try {
          const parsed = JSON.parse(step.data);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            d = parsed as Record<string, unknown>;
          }
        } catch {
          d = null;
        }
      }
    }

    if (d) {
      const dateVal =
        d['quotation_date'] ||
        d['qo_date'] ||
        d['quotation_requested_date'] ||
        d['po_date'] ||
        d['order_confirmation_date'] ||
        d['confirmation_date'] ||
        d['order_date'] ||
        d['invoice_date'] ||
        d['proforma_invoice_date'] ||
        d['delivery_date'] ||
        d['delivery_challan_date'] ||
        d['payment_date'] ||
        d['boe_date'] ||
        d['clearance_date'] ||
        d['duty_paid_date'] ||
        d['tender_date'] ||
        d['submission_date'] ||
        d['submitted_date'] ||
        d['prepared_date'] ||
        d['packing_list_date'] ||
        d['certificate_date'] ||
        d['date'] ||
        d['created_at'] ||
        d['updated_at'];

      if (dateVal && (typeof dateVal === 'string' || typeof dateVal === 'number' || dateVal instanceof Date)) {
        const formatted = formatDisplayDate(dateVal);
        if (formatted && formatted !== '—') {
          return {
            label: step.status === 'completed' ? 'Completed' : 'Date',
            date: formatted,
          };
        }
      }
    }

    return null;
  }
}

