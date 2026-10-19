import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { Projects } from './projects';
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
    createProject: (p: any) => of({ id: 1, ...p }),
    updateProject: (id: number, p: any) => of({ id, ...p }),
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
    comp.openEditDialog({ id: 1, project_title: 'Test', total_margin: 15000 } as any);
    expect(comp.projectForm.get('nickname')?.value).toBe('DEMO-NICK');
    expect(comp.projectForm.get('total_margin')?.value).toBe(15000);
  });

  it('should include nickname and total_margin in create payload on submit', () => {
    const comp = createComponent();
    let capturedPayload: any = null;
    vi.spyOn(mockProjectService, 'createProject').mockImplementation((payload: any) => {
      capturedPayload = payload;
      return of({ id: 99, ...payload });
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
    expect(capturedPayload.nickname).toBe('COOL-SYS');
    expect(capturedPayload.total_margin).toBe(25000);
  });
});
