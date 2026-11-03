import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { Projects } from './projects';
import { Project, ProjectCreateInput, ProjectUpdateInput } from '../../../core/models/project.model';
import { signal } from '@angular/core';

describe('Projects', () => {
  const fb = new FormBuilder();

  const mockProjectService = {
    getProjects: () => of([]),
    getProjectById: (id: number) =>
      of({
        id,
        project_title: 'Demo Project',
        project_code: 'PRJ-DEMO',
        nickname: 'DEMO-NICK',
        total_margin: 15000,
        customer_id: 1,
        supplier_id: 2,
        created_at: '2026-08-27T11:00:00Z',
        updated_at: '2026-08-27T11:00:00Z',
      }),
    createProject: (p: ProjectCreateInput) => of({ id: 1, ...p } as Project),
    updateProject: (id: number, p: ProjectUpdateInput) => of({ id, ...p } as Project),
    deleteProject: (id: number) => of(undefined),
  };

  const mockCustomerService = {
    getCustomers: () => of([]),
  };

  const mockSupplierService = {
    getSuppliers: () => of([]),
  };

  const createComponent = () => {
    const comp = Object.create(Projects.prototype);
    comp.fb = fb;
    comp.projectService = mockProjectService;
    comp.customerService = mockCustomerService;
    comp.supplierService = mockSupplierService;
    comp.messageService = { add: vi.fn() };
    comp.router = { navigate: vi.fn() };
    comp.viewMode = signal('table');
    comp.dialogVisible = signal(false);
    comp.selectedProject = signal(null);
    comp.isEditMode = signal(false);
    comp.submitting = signal(false);
    comp.projects = signal([]);
    comp.masterProjects = signal([]);
    comp.searchQuery = signal('');
    comp.selectedHealthFilter = signal('all');
    comp.loading = signal(false);
    comp.error = signal(null);

    comp.projectForm = fb.group({
      project_title: [''],
      project_code: [''],
      nickname: [''],
      customer_id: [null],
      supplier_id: [null],
      status: ['in_progress'],
      total_margin: [null],
      currency: ['INR'],
      payment_terms: [''],
      lead_time_days: [null],
      notes: [''],
    });

    return comp;
  };

  it('should initialize form with project_code, nickname and total_margin', () => {
    const comp = createComponent();
    expect(comp.projectForm.get('project_code')).toBeDefined();
    expect(comp.projectForm.get('nickname')).toBeDefined();
    expect(comp.projectForm.get('total_margin')).toBeDefined();
    expect(comp.projectForm.get('nickname')?.value).toBe('');
    expect(comp.projectForm.get('total_margin')?.value).toBeNull();
  });

  it('should default viewMode to table', () => {
    const comp = createComponent();
    expect(comp.viewMode()).toBe('table');
  });

  it('should patch nickname and total_margin when opening edit dialog', () => {
    const comp = createComponent();
    comp.openEditDialog({ id: 1, project_title: 'Test', total_margin: 15000 } as unknown as Project);
    expect(comp.projectForm.get('nickname')?.value).toBe('DEMO-NICK');
    expect(comp.projectForm.get('total_margin')?.value).toBe(15000);
  });

  it('should include nickname and total_margin in create payload on submit', () => {
    const comp = createComponent();
    let capturedPayload: (ProjectCreateInput & Record<string, unknown>) | null = null;
    vi.spyOn(mockProjectService, 'createProject').mockImplementation((payload: ProjectCreateInput) => {
      capturedPayload = payload as ProjectCreateInput & Record<string, unknown>;
      return of({ id: 99, ...payload } as Project);
    });

    comp.openAddDialog();
    comp.projectForm.patchValue({
      project_title: 'New Cooling System',
      project_code: 'PRJ-COOL',
      nickname: 'COOL-SYS',
      customer_id: 1,
      supplier_id: 2,
      total_margin: 25000,
    });

    comp.onSubmit();
    expect(capturedPayload).toBeTruthy();
    expect(capturedPayload!.nickname).toBe('COOL-SYS');
    expect(capturedPayload!.total_margin).toBe(25000);
  });

  describe('Forms & Progress helpers', () => {
    it('should calculate completed steps and completion state correctly', () => {
      const comp = createComponent();
      const p1: Project = { id: 1, project_title: 'P1', customer_id: 1, supplier_id: 2, total_steps: 4, completed_steps_count: 4, created_at: '2026-01-01', updated_at: '2026-01-01' };
      const p2: Project = { id: 2, project_title: 'P2', customer_id: 1, supplier_id: 2, total_steps: 5, completed_steps_count: 2, created_at: '2026-01-01', updated_at: '2026-01-01' };
      const p3: Project = { id: 3, project_title: 'P3', customer_id: 1, supplier_id: 2, total_steps: 0, created_at: '2026-01-01', updated_at: '2026-01-01' };
      const p4: Project = { id: 4, project_title: 'P4', customer_id: 1, supplier_id: 2, total_steps: 3, progress_percentage: 100, created_at: '2026-01-01', updated_at: '2026-01-01' };

      expect((comp as any).getCompletedStepsCount(p1)).toBe(4);
      expect((comp as any).isAllStepsCompleted(p1)).toBe(true);
      expect((comp as any).getFormsCountLabel(p1)).toBe('4 of 4 completed');

      expect((comp as any).getCompletedStepsCount(p2)).toBe(2);
      expect((comp as any).isAllStepsCompleted(p2)).toBe(false);
      expect((comp as any).getFormsCountLabel(p2)).toBe('2 of 5 completed');

      expect((comp as any).getCompletedStepsCount(p3)).toBe(0);
      expect((comp as any).isAllStepsCompleted(p3)).toBe(false);
      expect((comp as any).getFormsCountLabel(p3)).toBe('No forms attached');

      expect((comp as any).getCompletedStepsCount(p4)).toBe(3);
      expect((comp as any).isAllStepsCompleted(p4)).toBe(true);
    });

    it('should return appropriate icon based on form code or step name', () => {
      const comp = createComponent();
      expect((comp as any).getStepIcon({ current_step_name: 'Corrigendum' } as Project)).toBe('pi pi-file-edit');
      expect((comp as any).getStepIcon({ current_step_name: 'Cost Sheet' } as Project)).toBe('pi pi-calculator');
      expect((comp as any).getStepIcon({ current_step_name: 'Purchase Order (PO)' } as Project)).toBe('pi pi-shopping-bag');
      expect((comp as any).getStepIcon({ current_step_name: 'Bid Submission' } as Project)).toBe('pi pi-send');
      expect((comp as any).getStepIcon({ current_step_name: 'Freight Forwarder / CHA Details' } as Project)).toBe('pi pi-truck');
      expect((comp as any).getStepIcon({ current_step_name: 'Customer Query' } as Project)).toBe('pi pi-question-circle');
      expect((comp as any).getStepIcon({ current_form_code: 'FORM_01_PQB' } as Project)).toBe('pi pi-file-edit');
    });
  });
});
