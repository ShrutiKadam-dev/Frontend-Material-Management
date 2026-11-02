import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { Customer } from '../../../core/models/customer.model';
import { Supplier } from '../../../core/models/supplier.model';
import {
  MatchedItem,
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
} from '../../../core/models/project.model';
import { CustomerService } from '../../../core/services/customer';
import { SupplierService } from '../../../core/services/supplier';
import { ProjectService } from '../../../core/services/project';
import { ProjectStepService } from '../../../core/services/project-step';
import { ProjectStep } from '../../../core/models/project-step.model';

import { AppDatePipe } from '../../../core/pipes/app-date.pipe';

export type HealthFilter = 'all' | 'in_progress' | 'pending' | 'completed';
export type ViewMode = 'grid' | 'table';

@Component({
  selector: 'app-projects',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    InputTextModule,
    DatePickerModule,
    TooltipModule,
    TableModule,
    AppDatePipe,
    DecimalPipe,
  ],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Projects implements OnInit {
  private readonly projectService = inject(ProjectService);
  private readonly customerService = inject(CustomerService);
  private readonly supplierService = inject(SupplierService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly projectStepService = inject(ProjectStepService);

  // ── State Signals ──────────────────────────────────────────────
  protected readonly masterProjects = signal<Project[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly isSearching = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expandedProjectItems = signal<Set<number>>(new Set());

  // ── Filter & Search States ────────────────────────────────────
  protected readonly searchQuery = signal<string>('');
  protected readonly selectedHealthFilter = signal<HealthFilter>('all');
  protected readonly viewMode = signal<ViewMode>('table');

  // ── Search Subject for Debounced Backend Query ────────────────
  private readonly searchSubject = new Subject<string>();

  // ── Dialog States ──────────────────────────────────────────────
  protected readonly dialogVisible = signal<boolean>(false);
  protected readonly selectedProject = signal<Project | null>(null);
  protected readonly isEditMode = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);

  // ── Form Definition ────────────────────────────────────────────
  protected readonly projectForm = this.fb.group({
    project_title: ['', [Validators.required]],
    project_code: [''],
    nickname: [''],
    customer_id: [null as number | null, [Validators.required]],
    supplier_id: [null as number | null, [Validators.required]],
    total_margin: [null as number | null],
  });

  // ── Status Helper & Filter Counts ───────────────────────────────
  protected getProjectStatus(p: Project): 'in_progress' | 'pending' | 'completed' | string {
    const s = p.status?.toLowerCase().trim().replace(/\s+/g, '_');
    if (s === 'completed' || s === 'pending' || s === 'in_progress' || s === 'on_hold' || s === 'cancelled') {
      return s;
    }
    const total = p.total_steps ?? 0;
    const completed = p.completed_steps_count ?? 0;
    if (total === 0) {
      return 'pending';
    }
    if (total > 0 && completed >= total && (p.customer_payment_status === 'completed' || p.progress_percentage === 100)) {
      return 'completed';
    }
    return 'in_progress';
  }

  protected readonly inProgressCount = computed(() => {
    return this.projects().filter((p) => this.getProjectStatus(p) === 'in_progress').length;
  });

  protected readonly pendingCount = computed(() => {
    return this.projects().filter((p) => this.getProjectStatus(p) === 'pending').length;
  });

  protected readonly completedCount = computed(() => {
    return this.projects().filter((p) => this.getProjectStatus(p) === 'completed').length;
  });

  // ── Filtered Projects List ─────────────────────────────────────
  protected readonly filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.selectedHealthFilter();
    let list = this.projects();

    // Status filter: 'all' | 'in_progress' | 'pending' | 'completed'
    if (filter === 'in_progress') {
      list = list.filter((p) => this.getProjectStatus(p) === 'in_progress');
    } else if (filter === 'pending') {
      list = list.filter((p) => this.getProjectStatus(p) === 'pending');
    } else if (filter === 'completed') {
      list = list.filter((p) => this.getProjectStatus(p) === 'completed');
    }

    // Search query filter (matches Project Title, Code, Nickname, Client, Supplier, Next Action, or Items)
    if (query) {
      list = list.filter((p) => {
        const titleMatch = p.project_title?.toLowerCase().includes(query);
        const codeMatch = p.project_code?.toLowerCase().includes(query);
        const nickMatch = (p.nickname || p.project_nickname || '').toLowerCase().includes(query);
        const custMatch = (p.customer_name || this.getCustomerName(p.customer_id))
          .toLowerCase()
          .includes(query);
        const suppMatch = (p.supplier_name || this.getSupplierName(p.supplier_id))
          .toLowerCase()
          .includes(query);
        const nextActionMatch = p.next_action?.toLowerCase().includes(query);
        const stepMatch = p.current_step_name?.toLowerCase().includes(query);

        // Check matched_items (from backend search) or items list
        const allItems = [...(p.matched_items || []), ...(p.items || [])];
        const itemMatch = allItems.some((item) => {
          const matName = (item.material_name || '').toLowerCase();
          const itCode = (item.item_code || '').toLowerCase();
          const step = (item.step_name || '').toLowerCase();
          return matName.includes(query) || itCode.includes(query) || step.includes(query);
        });

        return (
          titleMatch ||
          codeMatch ||
          nickMatch ||
          custMatch ||
          suppMatch ||
          nextActionMatch ||
          stepMatch ||
          itemMatch
        );
      });
    }

    return list;
  });

  ngOnInit(): void {
    this.initSearchPipeline();
    this.loadProjects();
    this.loadDropdownData();
  }

  private initSearchPipeline(): void {
    this.searchSubject
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((term) => {
          const trimmed = term.trim();
          if (!trimmed) {
            this.isSearching.set(false);
            this.projects.set(this.masterProjects());
            return of(this.masterProjects());
          }
          this.isSearching.set(true);
          return this.projectService.searchProjects(trimmed).pipe(
            catchError((err: unknown) => {
              console.warn(
                'Backend search endpoint /api/v1/projects/search not available; falling back to local list:',
                err,
              );
              // Fallback to local master projects so local filter continues without breaking
              return of(this.masterProjects());
            }),
            finalize(() => this.isSearching.set(false)),
          );
        }),
      )
      .subscribe({
        next: (data) => {
          this.projects.set(data);
        },
        error: (err: unknown) => console.error('Search pipeline error', err),
      });
  }

  private loadDropdownData(): void {
    this.customerService.getCustomers().subscribe({
      next: (data) => this.customers.set(data),
      error: (err: unknown) => console.error('Failed to load customers', err),
    });
    this.supplierService.getSuppliers().subscribe({
      next: (data) => this.suppliers.set(data),
      error: (err: unknown) => console.error('Failed to load suppliers', err),
    });
  }

  protected loadProjects(): void {
    this.loading.set(true);
    this.error.set(null);
    this.projectService
      .getProjects()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          for (const p of data) {
            if (!p.current_step_date && !p.step_date && p.target_delivery_date) {
              p.current_step_date = p.target_delivery_date;
              p.current_step_date_label = 'Delivery Date';
            }
          }
          this.masterProjects.set(data);
          if (this.searchQuery().trim()) {
            this.searchSubject.next(this.searchQuery());
          } else {
            this.projects.set(data);
          }
          this.enrichProjectStepDates(data);
        },
        error: (err: unknown) => {
          console.error('Failed to load projects', err);
          this.error.set('Failed to load projects. Please verify backend connection and try again.');
        },
      });
  }

  private enrichProjectStepDates(projectsList: Project[]): void {
    for (const p of projectsList) {
      if (p.current_step_date || p.step_date) continue;
      if (!p.total_steps || p.total_steps === 0) continue;

      this.projectStepService.getSteps(p.id).subscribe({
        next: (steps) => {
          if (!steps || !steps.length) return;
          const resolved = this.extractStepDateFromSteps(steps);
          if (resolved) {
            p.current_step_date = resolved.date;
            p.current_step_date_label = resolved.label;
            p.step_date = resolved.date;
            p.step_date_label = resolved.label;
            this.projects.update((list) => [...list]);
            this.masterProjects.update((list) => [...list]);
          }
        },
        error: () => {},
      });
    }
  }

  private extractStepDateFromSteps(steps: ProjectStep[]): { date: string; label: string } | null {
    const sorted = [...steps].sort((a, b) => {
      const getRank = (s: ProjectStep) => (s.status === 'in_progress' ? 0 : s.status === 'completed' ? 1 : 2);
      const rankDiff = getRank(a) - getRank(b);
      if (rankDiff !== 0) return rankDiff;
      return (b.id ?? 0) - (a.id ?? 0);
    });

    const priorityPairs: [string, string][] = [
      ['delivery_date', 'Delivery Date'],
      ['expected_delivery_date', 'Delivery Date'],
      ['target_delivery_date', 'Delivery Date'],
      ['po_date', 'PO Date'],
      ['order_confirmation_date', 'Confirmation Date'],
      ['invoice_date', 'Invoice Date'],
      ['due_date', 'Due Date'],
      ['delivery_challan_date', 'Challan Date'],
      ['challan_date', 'Challan Date'],
      ['packing_list_date', 'Packing List Date'],
      ['payment_date', 'Payment Date'],
      ['certificate_date', 'Warranty Date'],
      ['boe_date', 'BOE Date'],
      ['bill_of_entry_date', 'BOE Date'],
      ['duty_paid_date', 'Duty Paid Date'],
      ['dispatch_date', 'Dispatch Date'],
      ['eway_bill_date', 'E-Way Date'],
      ['bid_submission_date', 'Submission Date'],
      ['submission_date', 'Submission Date'],
      ['closing_date_time', 'Closing Date'],
      ['closing_date', 'Closing Date'],
      ['submission_deadline', 'Due Date'],
      ['pqb_closing_date_time', 'PQB Closed'],
      ['pqb_closing_date', 'PQB Closed'],
      ['tender_date', 'Tender Date'],
      ['tender_issue_date', 'Tender Date'],
      ['pqb_issuing_date', 'PQB Issue Date'],
      ['quotation_date', 'Quotation Date'],
      ['quote_date', 'Quotation Date'],
      ['cost_sheet_date', 'Cost Sheet Date'],
      ['effective_date', 'Cost Sheet Date'],
      ['quotation_requested_date', 'RFQ Date'],
      ['rfq_date', 'RFQ Date'],
      ['qo_date', 'Query Date'],
      ['query_date', 'Query Date'],
      ['date', 'Step Date'],
    ];

    for (const step of sorted) {
      let d: Record<string, unknown> | null = null;
      if (step.data) {
        if (typeof step.data === 'object' && !Array.isArray(step.data)) {
          d = step.data as Record<string, unknown>;
        } else if (typeof step.data === 'string') {
          try {
            const parsed = JSON.parse(step.data);
            if (parsed && typeof parsed === 'object') d = parsed as Record<string, unknown>;
          } catch {
            d = null;
          }
        }
      }

      if (d) {
        for (const [key, fallbackLabel] of priorityPairs) {
          const val = d[key];
          if (val && typeof val === 'string' && val.trim() && val !== 'null' && val !== 'undefined') {
            const label = this.resolveStepLabelFromStep(step, fallbackLabel);
            return { date: val.trim(), label };
          }
        }
      }
    }
    return null;
  }

  private resolveStepLabelFromStep(step: ProjectStep, fallbackLabel: string): string {
    const code = (step.form_code || '').toUpperCase();
    const name = (step.step_name || '').toLowerCase();

    if (code.includes('CORRIGENDUM') || name.includes('corrigendum')) return 'Issue Date';
    if (code.includes('PQB') || name.includes('pqb') || name.includes('pre-qualification')) return 'PQB Closed';
    if (code.includes('QUERY') || name.includes('query')) return 'Query Date';
    if (code.includes('RFQ') || name.includes('rfq')) return 'RFQ Date';
    if (code.includes('QUOTATION') || name.includes('quotation')) return 'Quotation Date';
    if (code.includes('COST_SHEET') || name.includes('cost sheet')) return 'Cost Sheet Date';
    if (code.includes('TENDER') || name.includes('tender')) return 'Closing Date';
    if (code.includes('BID') || name.includes('bid')) return 'Submission Date';
    if (code.includes('PURCHASE_ORDER') || name.includes('po') || name.includes('purchase order')) {
      return fallbackLabel === 'Delivery Date' ? 'Delivery Date' : 'PO Date';
    }
    if (code.includes('ORDER_CONFIRMATION') || name.includes('order confirmation')) return 'Confirmation Date';
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
    return fallbackLabel;
  }

  protected setFilter(filter: HealthFilter): void {
    this.selectedHealthFilter.set(filter);
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  protected onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
    this.projects.set(this.masterProjects());
  }

  // ── Navigation & Actions ───────────────────────────────────────
  protected openDetailsDialog(project: Project): void {
    this.router.navigate(['/projects', project.id, 'steps']);
  }

  protected openStepFromProject(project: Project, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (project.current_form_code) {
      this.router.navigate(['/projects', project.id, 'forms', project.current_form_code]);
      return;
    }
    const stepNum = project.current_step_number || 1;
    const stepName = (project.current_step_name || '').toLowerCase();
    if (stepNum === 1 || stepName.includes('query')) {
      this.router.navigate(['/projects', project.id, 'customer-queries']);
      return;
    }
    this.router.navigate(['/projects', project.id, 'steps']);
  }


  protected getFormsCountLabel(p: Project): string {
    const total = p.total_steps ?? 0;
    if (total === 0) {
      return 'No forms attached';
    }
    const completed = p.completed_steps_count ?? ((p.progress_percentage ?? 0) >= 100 ? total : 0);
    return `${completed} of ${total} completed`;
  }

  protected getStepDate(p: Project): string | null {
    return p.current_step_date || p.step_date || p.target_delivery_date || null;
  }

  protected getStepDateLabel(p: Project): string {
    if (p.current_step_date_label) {
      return p.current_step_date_label;
    }
    if (p.step_date_label) {
      return p.step_date_label;
    }
    if (!p.current_step_date && !p.step_date && p.target_delivery_date) {
      return 'Delivery Date';
    }
    const code = (p.current_form_code || '').toUpperCase();
    const name = (p.current_step_name || '').toLowerCase();

    if (code.includes('CORRIGENDUM') || name.includes('corrigendum')) return 'Issue Date';
    if (code.includes('PQB') || name.includes('pqb') || name.includes('pre-qualification')) return 'PQB Closed';
    if (code.includes('QUERY') || name.includes('query')) return 'Query Date';
    if (code.includes('RFQ') || name.includes('rfq')) return 'RFQ Date';
    if (code.includes('QUOTATION') || name.includes('quotation')) return 'Quotation Date';
    if (code.includes('COST_SHEET') || name.includes('cost sheet')) return 'Cost Sheet Date';
    if (code.includes('TENDER') || name.includes('tender')) return 'Closing Date';
    if (code.includes('BID') || name.includes('bid')) return 'Submission Date';
    if (code.includes('PURCHASE_ORDER') || name.includes('po') || name.includes('purchase order')) return 'PO Date';
    if (code.includes('ORDER_CONFIRMATION') || name.includes('order confirmation')) return 'Confirmation Date';
    if (code.includes('INVOICE') || name.includes('invoice')) return 'Invoice Date';
    if (code.includes('CHALLAN') || name.includes('challan')) return 'Challan Date';
    if (code.includes('PACKING') || name.includes('packing')) return 'Packing List Date';
    if (code.includes('PAYMENT') || name.includes('payment')) return 'Payment Date';
    if (code.includes('WARRANTY') || name.includes('warranty')) return 'Warranty Date';
    if (code.includes('EWAY') || name.includes('eway') || name.includes('e-way')) return 'E-Way Date';
    if (code.includes('FREIGHT') || code.includes('CHA') || name.includes('cha') || name.includes('freight')) return 'Duty Paid Date';
    if (code.includes('SHIPPING') || code.includes('CLEARANCE') || name.includes('clearance') || name.includes('boe')) return 'BOE Date';
    if (code.includes('TRANSPORT') || name.includes('transport') || name.includes('dispatch')) return 'Dispatch Date';
    if (code.includes('NAC') || name.includes('award') || name.includes('nac')) return 'Award Date';
    if (code.includes('LTE') || code.includes('EOI') || name.includes('lte') || name.includes('eoi')) return 'Closing Date';
    return 'Step Date';
  }

  protected openAddDialog(): void {
    this.projectForm.reset({
      project_title: '',
      project_code: '',
      nickname: '',
      customer_id: null,
      supplier_id: null,
      total_margin: null,
    });
    this.isEditMode.set(false);
    this.dialogVisible.set(true);
  }

  protected openEditDialog(project: Project): void {
    this.loading.set(true);
    this.projectService.getProjectById(project.id).subscribe({
      next: (fresh) => {
        this.selectedProject.set(fresh);
        this.projectForm.patchValue({
          project_title: fresh.project_title,
          project_code: fresh.project_code || '',
          nickname: fresh.nickname || '',
          customer_id: fresh.customer_id,
          supplier_id: fresh.supplier_id,
          total_margin: fresh.total_margin !== undefined && fresh.total_margin !== null ? fresh.total_margin : null,
        });
        this.isEditMode.set(true);
        this.dialogVisible.set(true);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load project for edit', err);
        this.error.set('Failed to load project details.');
        this.loading.set(false);
      },
    });
  }

  protected onSubmit(): void {
    if (this.submitting()) return;
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formValue = this.projectForm.value;
    const nicknameVal = (formValue.nickname || '').trim() || undefined;
    const marginRaw = formValue.total_margin;
    const marginVal = marginRaw !== null && marginRaw !== undefined && (marginRaw as unknown) !== ''
      ? Number(marginRaw)
      : undefined;

    const payload: ProjectCreateInput = {
      project_title: formValue.project_title ?? '',
      project_code: (formValue.project_code || '').trim() || undefined,
      nickname: nicknameVal,
      customer_id: formValue.customer_id as number,
      supplier_id: formValue.supplier_id as number,
      total_margin: marginVal,
    };

    if (this.isEditMode()) {
      const projectId = this.selectedProject()?.id;
      if (!projectId) {
        this.submitting.set(false);
        return;
      }
      this.projectService
        .updateProject(projectId, payload as ProjectUpdateInput)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Project Updated',
              detail: `${payload.project_title} has been successfully updated.`,
            });
            this.loadProjects();
          },
          error: (err: unknown) => {
            console.error('Failed to update project', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Update Failed',
              detail: 'Failed to update project. Please try again.',
            });
          },
        });
    } else {
      this.projectService
        .createProject(payload)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Project Created',
              detail: `${payload.project_title} has been successfully initiated.`,
            });
            this.loadProjects();
          },
          error: (err: unknown) => {
            console.error('Failed to create project', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Creation Failed',
              detail: 'Failed to create project. Please try again.',
            });
          },
        });
    }
  }

  protected deleteProject(project: Project): void {
    const title = project.project_title || `Project #${project.id}`;
    if (!confirm(`Are you sure you want to remove project "${title}"? This action cannot be undone.`)) {
      return;
    }
    this.projectService.deleteProject(project.id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Project Removed',
          detail: `${title} has been successfully removed.`,
        });
        this.loadProjects();
      },
      error: (err: unknown) => {
        console.error('Failed to delete project', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Remove Failed',
          detail: 'Failed to remove project. Please try again.',
        });
      },
    });
  }

  // ── Helper Resolvers ───────────────────────────────────────────
  protected getCustomerName(id?: number): string {
    if (!id) return 'Unknown Customer';
    return this.customers().find((c) => c.id === id)?.name ?? `Customer #${id}`;
  }

  protected getSupplierName(id?: number): string {
    if (!id) return 'Unknown Supplier';
    return this.suppliers().find((s) => s.id === id)?.name ?? `Supplier #${id}`;
  }

  protected getProgressPercent(project: Project): number {
    if (project.progress_percentage !== undefined && project.progress_percentage !== null) {
      return Math.min(100, Math.max(0, project.progress_percentage));
    }
    const total = project.total_steps || 0;
    if (total === 0) return 0;
    const completed = project.completed_steps_count ?? 0;
    return Math.round((completed / total) * 100);
  }

  protected getHealthBadgeClass(health?: string): string {
    switch (health) {
      case 'on_track':
        return 'health-pill--on-track';
      case 'delayed':
        return 'health-pill--delayed';
      case 'at_risk':
        return 'health-pill--at-risk';
      default:
        return 'health-pill--normal';
    }
  }

  protected getHealthLabel(health?: string): string {
    switch (health) {
      case 'on_track':
        return 'On Track';
      case 'delayed':
        return 'Delayed';
      case 'at_risk':
        return 'At Risk';
      default:
        return 'Active';
    }
  }

  protected getStatusBadgeClass(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'status-badge--completed';
      case 'pending':
        return 'status-badge--pending';
      case 'on_hold':
        return 'status-badge--on-hold';
      case 'cancelled':
        return 'status-badge--cancelled';
      case 'in_progress':
      default:
        return 'status-badge--in-progress';
    }
  }

  protected getStatusLabel(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'on_hold':
        return 'On Hold';
      case 'cancelled':
        return 'Cancelled';
      case 'in_progress':
      default:
        return 'In Progress';
    }
  }

  protected getPaymentBadgeClass(status?: string): string {
    switch (status) {
      case 'paid':
        return 'payment-chip--paid';
      case 'partial':
        return 'payment-chip--partial';
      default:
        return 'payment-chip--pending';
    }
  }

  protected isFieldInvalid(key: string): boolean {
    const c = this.projectForm.get(key);
    return !!(c && c.invalid && (c.touched || c.dirty));
  }

  protected getFieldError(key: string): string | null {
    const c = this.projectForm.get(key);
    if (!c || !c.invalid || !(c.touched || c.dirty)) return null;
    if (c.hasError('required')) return 'This field is required.';
    return 'Invalid field value.';
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ── Matched Items Display Helpers ──────────────────────────────
  protected toggleItemsExpand(projectId: number): void {
    this.expandedProjectItems.update((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  protected isItemsExpanded(projectId: number): boolean {
    return this.expandedProjectItems().has(projectId);
  }

  protected getMatchedItemsTooltip(items?: MatchedItem[]): string {
    if (!items || items.length === 0) return '';
    return items
      .map(
        (i) =>
          `${i.material_name || i.item_code || 'Item'}${i.quantity ? ` (Qty: ${i.quantity})` : ''}${
            i.step_name ? ` [${i.step_name}]` : ''
          }`,
      )
      .join('\n');
  }

  protected highlightText(text?: string, query?: string): string {
    if (!text) return '';
    const q = (query || '').trim();
    if (!q) return this.escapeHtml(text);

    const words = q
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => this.escapeRegex(w));
    if (words.length === 0) return this.escapeHtml(text);

    const splitRegex = new RegExp(`(${words.join('|')})`, 'gi');
    const testRegex = new RegExp(`^(?:${words.join('|')})$`, 'i');
    const parts = text.split(splitRegex);

    return parts
      .map((part) => {
        if (!part) return '';
        if (testRegex.test(part)) {
          return `<mark class="search-match-mark">${this.escapeHtml(part)}</mark>`;
        }
        return this.escapeHtml(part);
      })
      .join('');
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
