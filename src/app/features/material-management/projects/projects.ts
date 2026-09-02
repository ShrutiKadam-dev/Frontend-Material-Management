import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';

import { TooltipModule } from 'primeng/tooltip';

import { Customer } from '../../../core/models/customer.model';
import { Supplier } from '../../../core/models/supplier.model';
import { Project } from '../../../core/models/project.model';
import { CustomerService } from '../../../core/services/customer';
import { SupplierService } from '../../../core/services/supplier';
import { ProjectService } from '../../../core/services/project';

@Component({
  selector: 'app-projects',
  imports: [ButtonModule, DialogModule, SelectModule, InputTextModule, ReactiveFormsModule, TooltipModule],
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

  protected readonly projects = signal<Project[]>([]);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dialogVisible = signal<boolean>(false);
  protected readonly selectedProject = signal<Project | null>(null);
  protected readonly isEditMode = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);

  protected readonly projectForm = this.fb.group({
    project_title: ['', [Validators.required]],
    customer_id: [null as number | null, [Validators.required]],
    supplier_id: [null as number | null, [Validators.required]],
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
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.projects.set(data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        console.error('Failed to load projects', err);
        this.error.set('Failed to load projects. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected openAddDialog(): void {
    this.projectForm.reset();
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
        this.error.set('Failed to load project details. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected openDetailsDialog(project: Project): void {
    this.router.navigate(['/projects', project.id, 'steps']);
  }

  protected onSubmit(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const formValue = this.projectForm.value;

    const payload = {
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
      this.projectService.updateProject(projectId, payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogVisible.set(false);
          this.loadProjects();
        },
        error: (err: unknown) => {
          console.error('Failed to update project', err);
          this.submitting.set(false);
        },
      });
    } else {
      this.projectService.createProject(payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.dialogVisible.set(false);
          this.loadProjects();
        },
        error: (err: unknown) => {
          console.error('Failed to create project', err);
          this.submitting.set(false);
        },
      });
    }
  }

  protected getCustomerName(id: number): string {
    return this.customers().find((c) => c.id === id)?.name ?? `Customer #${id}`;
  }

  protected getSupplierName(id: number): string {
    return this.suppliers().find((s) => s.id === id)?.name ?? `Supplier #${id}`;
  }

  protected progressPercent(step: number): number {
    return Math.round((step / 15) * 100);
  }
}
