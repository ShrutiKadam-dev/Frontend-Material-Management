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
import { DatePipe, DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';

import { Customer } from '../../../core/models/customer.model';
import { Supplier } from '../../../core/models/supplier.model';
import { Project, ProjectCreateInput, ProjectUpdateInput } from '../../../core/models/project.model';
import { CustomerService } from '../../../core/services/customer';
import { SupplierService } from '../../../core/services/supplier';
import { ProjectService } from '../../../core/services/project';

export type HealthFilter = 'all' | 'on_track' | 'delayed' | 'in_progress' | 'completed';
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
    DatePipe,
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

  // ── State Signals ──────────────────────────────────────────────
  protected readonly projects = signal<Project[]>([]);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);

  // ── Filter & Search States ────────────────────────────────────
  protected readonly searchQuery = signal<string>('');
  protected readonly selectedHealthFilter = signal<HealthFilter>('all');
  protected readonly viewMode = signal<ViewMode>('grid');

  // ── Dialog States ──────────────────────────────────────────────
  protected readonly dialogVisible = signal<boolean>(false);
  protected readonly selectedProject = signal<Project | null>(null);
  protected readonly isEditMode = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);

  // ── Form Definition ────────────────────────────────────────────
  protected readonly projectForm = this.fb.group({
    project_title: ['', [Validators.required]],
    customer_id: [null as number | null, [Validators.required]],
    supplier_id: [null as number | null, [Validators.required]],
  });

  // ── Project Filter Counts ───────────────────────────────────────
  protected readonly onTrackCount = computed(() => {
    return this.projects().filter((p) => p.health_status === 'on_track').length;
  });

  protected readonly delayedCount = computed(() => {
    return this.projects().filter((p) => p.health_status === 'delayed' || p.health_status === 'at_risk').length;
  });

  // ── Filtered Projects List ─────────────────────────────────────
  protected readonly filteredProjects = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const filter = this.selectedHealthFilter();
    let list = this.projects();

    // Health / Status filter
    if (filter === 'on_track') {
      list = list.filter((p) => p.health_status === 'on_track');
    } else if (filter === 'delayed') {
      list = list.filter((p) => p.health_status === 'delayed' || p.health_status === 'at_risk');
    } else if (filter === 'in_progress') {
      list = list.filter((p) => p.status === 'in_progress' || !p.status);
    } else if (filter === 'completed') {
      list = list.filter((p) => p.status === 'completed' || p.progress_percentage === 100);
    }

    // Search query filter
    if (query) {
      list = list.filter((p) => {
        const titleMatch = p.project_title?.toLowerCase().includes(query);
        const custMatch = (p.customer_name || this.getCustomerName(p.customer_id))
          .toLowerCase()
          .includes(query);
        const suppMatch = (p.supplier_name || this.getSupplierName(p.supplier_id))
          .toLowerCase()
          .includes(query);
        const nextActionMatch = p.next_action?.toLowerCase().includes(query);
        const stepMatch = p.current_step_name?.toLowerCase().includes(query);
        return titleMatch || custMatch || suppMatch || nextActionMatch || stepMatch;
      });
    }

    return list;
  });

  ngOnInit(): void {
    this.loadProjects();
    this.loadDropdownData();
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
          this.projects.set(data);
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
    this.searchQuery.set(input.value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  // ── Navigation & Actions ───────────────────────────────────────
  protected openDetailsDialog(project: Project): void {
    this.router.navigate(['/projects', project.id, 'steps']);
  }

  protected openAddDialog(): void {
    this.projectForm.reset({
      project_title: '',
      customer_id: null,
      supplier_id: null,
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
          customer_id: fresh.customer_id,
          supplier_id: fresh.supplier_id,
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
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formValue = this.projectForm.value;

    const payload: ProjectCreateInput = {
      project_title: formValue.project_title ?? '',
      customer_id: formValue.customer_id as number,
      supplier_id: formValue.supplier_id as number,
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
            this.loadProjects();
          },
          error: (err: unknown) => {
            console.error('Failed to update project', err);
          },
        });
    } else {
      this.projectService
        .createProject(payload)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: () => {
            this.dialogVisible.set(false);
            this.loadProjects();
          },
          error: (err: unknown) => {
            console.error('Failed to create project', err);
          },
        });
    }
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
      return project.progress_percentage;
    }
    const step = project.current_step_number || 1;
    return Math.round((step / 15) * 100);
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
    switch (status) {
      case 'completed':
        return 'status-badge--completed';
      case 'on_hold':
        return 'status-badge--on-hold';
      case 'cancelled':
        return 'status-badge--cancelled';
      default:
        return 'status-badge--in-progress';
    }
  }

  protected getStatusLabel(status?: string): string {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'on_hold':
        return 'On Hold';
      case 'cancelled':
        return 'Cancelled';
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
}
