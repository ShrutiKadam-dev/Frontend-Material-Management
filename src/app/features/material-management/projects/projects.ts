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
          this.masterProjects.set(data);
          if (this.searchQuery().trim()) {
            this.searchSubject.next(this.searchQuery());
          } else {
            this.projects.set(data);
          }
        },
        error: (err: unknown) => {
          console.error('Failed to load projects', err);
          this.error.set('Failed to load projects. Please verify backend connection and try again.');
        },
      });
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
      return '0 forms attached';
    }
    const completed = p.completed_steps_count ?? (this.getProgressPercent(p) >= 100 ? total : 0);
    return `${completed} of ${total} ${total === 1 ? 'form' : 'forms'} done`;
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
