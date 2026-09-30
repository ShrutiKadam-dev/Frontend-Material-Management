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
import { TableModule } from 'primeng/table';

import { ProjectStepService } from '../../../../core/services/project-step';
import { ProjectService } from '../../../../core/services/project';
import { CustomerService } from '../../../../core/services/customer';
import { SupplierService } from '../../../../core/services/supplier';
import { ProjectStep, ProjectStepRemark, StepStatus } from '../../../../core/models/project-step.model';
import { Project } from '../../../../core/models/project.model';
import { Customer } from '../../../../core/models/customer.model';
import { Supplier } from '../../../../core/models/supplier.model';
import { formatDisplayDate } from '../../../../core/utils/date.utils';
import { AppDatePipe } from '../../../../core/pipes/app-date.pipe';

export type PhaseFilter = 'all' | 'phase-1' | 'phase-2' | 'phase-3' | 'phase-4';
export type TimelineStatusFilter = 'all' | 'completed' | 'in_progress' | 'pending';
export type TimelineViewMode = 'grid' | 'board' | 'table';

export interface PhaseInfo {
  id: PhaseFilter;
  title: string;
  shortTitle: string;
  stepRange: string;
  description: string;
  badgeClass: string;
}

export interface FormattedStepRemark {
  remark: string;
  user?: string;
  date?: string;
}

export const PIPELINE_PHASES: PhaseInfo[] = [
  {
    id: 'phase-1',
    title: 'Inquiry & Sourcing',
    shortTitle: 'Phase 1: Sourcing',
    stepRange: 'Steps 1–5',
    description: 'Customer inquiry, supplier RFQ, quote, cost sheet & client quote',
    badgeClass: 'phase-pill--sourcing',
  },
  {
    id: 'phase-2',
    title: 'Tender & Purchase Orders',
    shortTitle: 'Phase 2: Orders',
    stepRange: 'Steps 6–9',
    description: 'Tender, bid docs, client PO & supplier confirmation',
    badgeClass: 'phase-pill--bidding',
  },
  {
    id: 'phase-3',
    title: 'Logistics & Customs',
    shortTitle: 'Phase 3: Logistics',
    stepRange: 'Steps 10–12',
    description: 'Supplier invoice, freight logistics & customs clearance',
    badgeClass: 'phase-pill--logistics',
  },
  {
    id: 'phase-4',
    title: 'Delivery & Settlement',
    shortTitle: 'Phase 4: Settlement',
    stepRange: 'Steps 13–15',
    description: 'Customer delivery, customer realization & supplier payment',
    badgeClass: 'phase-pill--settlement',
  },
];

@Component({
  selector: 'app-project-timeline',
  imports: [
    ButtonModule,
    DialogModule,
    TooltipModule,
    TableModule,
    AppDatePipe,
    DecimalPipe,
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

  // ── Step Remarks Dialog Signal ────────────────────────────────────
  protected readonly selectedStepForRemarks = signal<ProjectStep | null>(null);
  protected readonly remarksDialogVisible = signal<boolean>(false);

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
    if (phase === 'phase-1') {
      list = list.filter((s) => s.step_number >= 1 && s.step_number <= 5);
    } else if (phase === 'phase-2') {
      list = list.filter((s) => s.step_number >= 6 && s.step_number <= 9);
    } else if (phase === 'phase-3') {
      list = list.filter((s) => s.step_number >= 10 && s.step_number <= 12);
    } else if (phase === 'phase-4') {
      list = list.filter((s) => s.step_number >= 13 && s.step_number <= 15);
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
      let phaseSteps = this.steps();
      if (phase.id === 'phase-1') {
        phaseSteps = phaseSteps.filter((s) => s.step_number >= 1 && s.step_number <= 5);
      } else if (phase.id === 'phase-2') {
        phaseSteps = phaseSteps.filter((s) => s.step_number >= 6 && s.step_number <= 9);
      } else if (phase.id === 'phase-3') {
        phaseSteps = phaseSteps.filter((s) => s.step_number >= 10 && s.step_number <= 12);
      } else if (phase.id === 'phase-4') {
        phaseSteps = phaseSteps.filter((s) => s.step_number >= 13 && s.step_number <= 15);
      }

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
      },
      error: () => {
        // Non-fatal if project details cannot be retrieved
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
  }

  private loadCustomerAndSupplier(p: Project): void {
    if (p.customer_id) {
      this.customerService.getCustomerById(p.customer_id).subscribe({
        next: (cust) => this.customer.set(cust),
        error: () => {/* fallback gracefully */},
      });
    }
    if (p.supplier_id) {
      this.supplierService.getSupplierById(p.supplier_id).subscribe({
        next: (supp) => this.supplier.set(supp),
        error: () => {/* fallback gracefully */},
      });
    }
  }

  protected goBack(): void {
    this.router.navigate(['/projects']);
  }

  protected isStepClickable(stepNumber: number): boolean {
    return stepNumber >= 1 && stepNumber <= 15;
  }

  protected navigateToStep(stepNumber: number): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (this.isStepClickable(stepNumber)) {
      this.router.navigate(['/projects', projectId, 'steps', stepNumber]);
    }
  }

  protected continueActiveStep(): void {
    const active = this.activeStep();
    if (active) {
      this.navigateToStep(active.step_number);
    } else {
      this.navigateToStep(1);
    }
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
    if (step.remarks && Array.isArray(step.remarks)) {
      for (const r of step.remarks) {
        if (r && r.remark) {
          list.push({
            remark: r.remark,
            user: r.user || (r.user_id ? `User #${r.user_id}` : undefined),
            date: r.created_at ? formatDisplayDate(r.created_at, 'dd-MM-yyyy HH:mm') : undefined,
          });
        }
      }
    }

    if (step.data && typeof step.data === 'object' && Array.isArray((step.data as Record<string, unknown>)['remarks'])) {
      const dataRemarks = (step.data as Record<string, unknown>)['remarks'] as unknown[];
      for (const dr of dataRemarks) {
        if (typeof dr === 'string' && dr.trim()) {
          if (!list.some((item) => item.remark === dr)) {
            list.push({ remark: dr });
          }
        }
      }
    }
    return list;
  }

  protected getRemarksCount(step: ProjectStep): number {
    return this.getStepRemarks(step).length;
  }

  protected openRemarksDialog(step: ProjectStep, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedStepForRemarks.set(step);
    this.remarksDialogVisible.set(true);
  }

  protected getStepDataBadges(step: ProjectStep): { icon?: string; label: string }[] {
    const badges: { icon?: string; label: string }[] = [];
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

  protected getPhaseForStep(stepNumber: number): PhaseInfo {
    if (stepNumber <= 5) return PIPELINE_PHASES[0];
    if (stepNumber <= 9) return PIPELINE_PHASES[1];
    if (stepNumber <= 12) return PIPELINE_PHASES[2];
    return PIPELINE_PHASES[3];
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

