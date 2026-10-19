import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';

import { ProjectFormEntries } from './project-form-entries';
import { ProjectStep } from '../../../../core/models/project-step.model';
import { FORM_CATALOG, getFormDefinition } from '../../../../core/constants/form-catalog';

describe('ProjectFormEntries Component', () => {
  const pqbDef = FORM_CATALOG.find((f) => f.formCode === 'FORM_01_PQB')!;

  const mockSteps: ProjectStep[] = [
    {
      id: 101,
      project_id: 5,
      step_number: 1,
      step_name: 'National Pre-Qualification Bid (PQB)',
      description: 'PQB Submission',
      status: 'completed',
      progress_percentage: 100,
      completed_at: '2026-09-20T10:00:00.000Z',
      form_code: 'FORM_01_PQB',
      data: {
        pqb_title: 'Turbine Overhaul',
        pqb_no: 'PQB-2026-01',
        table_items: [{ sr_no: 1, description: 'Parts', quantity: 5, total_amount: 5000 }],
        attachments: [{ file_name: 'pqb_specs.pdf', size: '2.4 MB' }],
        remarks: ['QA check passed'],
      },
      remarks: [],
    },
    {
      id: 102,
      project_id: 5,
      step_number: 1,
      step_name: 'National Pre-Qualification Bid (PQB) - Rev 2',
      description: 'PQB Revision',
      status: 'in_progress',
      progress_percentage: 50,
      completed_at: null,
      form_code: 'FORM_01_PQB',
      data: {
        pqb_title: 'Turbine Overhaul Rev 2',
        pqb_no: 'PQB-2026-02',
      },
      remarks: [],
    },
    {
      id: 201,
      project_id: 5,
      step_number: 2,
      step_name: 'Bid Document for PQB',
      description: 'Bid docs',
      status: 'pending',
      progress_percentage: 0,
      completed_at: null,
      form_code: 'FORM_02_PQB_BID_DOCUMENT',
      data: {},
      remarks: [],
    },
  ];

  const createComponent = (initialSteps: ProjectStep[] = mockSteps, code = 'FORM_01_PQB') => {
    const comp = Object.create(ProjectFormEntries.prototype);
    comp.projectId = signal(5);
    comp.formCode = signal(code);
    comp.project = signal(null);
    comp.customer = signal(null);
    comp.supplier = signal(null);
    comp.allSteps = signal(initialSteps);
    comp.loading = signal(false);
    comp.error = signal(null);
    comp.searchQuery = signal('');
    comp.dialogVisible = signal(false);
    comp.selectedStepForDialog = signal(null);
    comp.deleteConfirmVisible = signal(false);
    comp.stepToDelete = signal(null);
    comp.deleting = signal(false);
    comp.quickRemarkPending = signal(false);
    comp.messageService = { add: vi.fn() };
    comp.formApiService = {
      deleteEntry: vi.fn().mockReturnValue(of(true)),
      getEntries: vi.fn().mockReturnValue(of([])),
      createEntry: vi.fn(),
      updateEntry: vi.fn(),
    };
    comp.projectStepService = {
      removeStep: vi.fn().mockReturnValue(of(true)),
      updateStep: vi.fn(),
      addStep: vi.fn(),
    };

    comp.formDefinition = () => {
      const c = comp.formCode();
      return getFormDefinition(c) || null;
    };

    comp.entries = () => {
      const def = comp.formDefinition();
      const rawCode = (comp.formCode() || '').toLowerCase();
      return comp.allSteps().filter(
        (s: ProjectStep) =>
          (s.form_code || '').toLowerCase() === rawCode ||
          s.step_number === def?.id,
      );
    };

    comp.filteredEntries = () => {
      const q = comp.searchQuery().trim().toLowerCase();
      const list = comp.entries();
      if (!q) return list;
      return list.filter(
        (s: ProjectStep) =>
          String(s.id).includes(q) ||
          (s.step_name || '').toLowerCase().includes(q) ||
          (s.data && JSON.stringify(s.data).toLowerCase().includes(q)),
      );
    };

    return comp;
  };

  it('should resolve formDefinition correctly by formCode', () => {
    const comp = createComponent();
    const def = comp.formDefinition();
    expect(def).toBeDefined();
    expect(def?.formCode).toBe('FORM_01_PQB');
    expect(def?.name).toBe('National Pre-Qualification Bid (PQB)');
  });

  it('should filter entries belonging to this specific form', () => {
    const comp = createComponent();
    const entries = comp.entries();
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe(101);
    expect(entries[1].id).toBe(102);
  });

  it('should filter entries based on search query', () => {
    const comp = createComponent();

    // Search by title in data
    comp.searchQuery.set('Rev 2');
    let filtered = comp.filteredEntries();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(102);

    // Search by ID
    comp.searchQuery.set('101');
    filtered = comp.filteredEntries();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(101);

    // Empty search returns all
    comp.searchQuery.set('');
    filtered = comp.filteredEntries();
    expect(filtered).toHaveLength(2);
  });

  it('should open create and edit dialogs with correct state', () => {
    const comp = createComponent();

    // Open create dialog
    comp.openCreateDialog();
    expect(comp.dialogVisible()).toBe(true);
    expect(comp.selectedStepForDialog()).toBeNull();

    // Open edit dialog
    comp.openEditDialog(mockSteps[0]);
    expect(comp.dialogVisible()).toBe(true);
    expect(comp.selectedStepForDialog()).toBe(mockSteps[0]);
  });

  it('should update state when onStepSaved is called', () => {
    const comp = createComponent();
    let stepsList = [...mockSteps];
    comp.allSteps = {
      update: vi.fn((fn: (s: ProjectStep[]) => ProjectStep[]) => {
        stepsList = fn(stepsList);
      }),
    };

    const newStep: ProjectStep = {
      id: 103,
      project_id: 5,
      step_number: 1,
      step_name: 'National Pre-Qualification Bid (PQB) - Rev 3',
      description: 'PQB Revision 3',
      status: 'in_progress',
      progress_percentage: 20,
      completed_at: null,
      form_code: 'FORM_01_PQB',
      data: {},
      remarks: [],
    };

    comp.onStepSaved(newStep);
    expect(comp.allSteps.update).toHaveBeenCalled();
    expect(stepsList).toHaveLength(4);
    expect(comp.messageService.add).toHaveBeenCalled();
    expect(comp.dialogVisible()).toBe(false);
  });

  it('should delete entry when executeDelete is called', () => {
    const comp = createComponent();
    let stepsList = [...mockSteps];
    comp.allSteps = {
      update: vi.fn((fn: (s: ProjectStep[]) => ProjectStep[]) => {
        stepsList = fn(stepsList);
      }),
    };
    comp.stepToDelete.set(mockSteps[0]);

    comp.executeDelete();
    expect(comp.formApiService.deleteEntry).toHaveBeenCalledWith(expect.anything(), 5, 101);
    expect(comp.allSteps.update).toHaveBeenCalled();
    expect(stepsList.some((s) => s.id === 101)).toBe(false);
    expect(comp.messageService.add).toHaveBeenCalled();
    expect(comp.deleteConfirmVisible()).toBe(false);
  });

  it('should extract display fields, line items, and attachments from entry', () => {
    const comp = createComponent();

    const fields = comp.getDisplayFields(mockSteps[0]);
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.some((f: any) => f.label === 'PQB Title' && f.value === 'Turbine Overhaul')).toBe(true);

    const items = comp.getTableItems(mockSteps[0]);
    expect(items).toHaveLength(1);
    expect(items[0]['description']).toBe('Parts');

    const atts = comp.getEntryAttachments(mockSteps[0]);
    expect(atts).toHaveLength(1);
    expect(atts[0].name).toBe('pqb_specs.pdf');
  });

  it('should support formatters, status labels, and date extraction', () => {
    const comp = createComponent();

    expect(comp.statusLabel('completed')).toBe('Completed');
    expect(comp.statusLabel('in_progress')).toBe('In Progress');
    expect(comp.statusLabel('pending')).toBe('Pending');

    expect(comp.statusIcon('completed')).toBe('pi-check-circle');
    expect(comp.statusIcon('in_progress')).toBe('pi-spin pi-spinner');

    expect(comp.getFileIcon('document.pdf')).toBe('pi pi-file-pdf');
    expect(comp.getFileIcon('sheet.xlsx')).toBe('pi pi-file-excel');
    expect(comp.getFileIcon('image.png')).toBe('pi pi-image');

    expect(comp.getRemarkInitials('Shruti Kadam')).toBe('SK');
    expect(comp.getRemarkInitials('')).toBe('TM');
  });

  it('should compute tableColumns, formStepNumber, and formCategory', () => {
    const comp = createComponent();
    comp.formStepNumber = () => {
      const def = comp.formDefinition();
      return def ? ('0' + def.id).slice(-2) : '—';
    };
    comp.formCategory = () => comp.formDefinition()?.category || 'Project Pipeline';
    comp.tableColumns = () => {
      const def = comp.formDefinition();
      return def?.tableConfig?.columns || [];
    };

    expect(comp.formStepNumber()).toBe('01');
    expect(comp.formCategory()).toBe('Pre-Bidding & Tenders');
    const cols = comp.tableColumns();
    expect(cols.length).toBeGreaterThan(0);
    expect(cols.some((c: any) => c.key === 'description')).toBe(true);
  });

  it('should format cell values properly for table rendering', () => {
    const comp = createComponent();
    const row = {
      sr_no: 3,
      description: 'Stainless Steel Fasteners',
      quantity: 50,
      total_amount: 12500,
    };

    const srCol = { key: 'sr_no', label: '#', type: 'number' as const };
    const descCol = { key: 'description', label: 'Description', type: 'text' as const };
    const curCol = { key: 'total_amount', label: 'Total', type: 'currency' as const };

    expect(comp.formatCellValue(row, srCol, 2)).toBe('3');
    expect(comp.formatCellValue(row, descCol, 2)).toBe('Stainless Steel Fasteners');
    expect(comp.formatCellValue(row, curCol, 2)).toContain('12,500');
  });

  it('should calculate and format table total amount', () => {
    const comp = createComponent();
    const total = comp.calculateTableTotal(mockSteps[0]);
    expect(total).toBe(5000);

    const formatted = comp.getTableTotalFormatted(mockSteps[0]);
    expect(formatted).toContain('5,000');
  });

  it('should handle attachment download feedback', () => {
    const comp = createComponent();
    comp.downloadAttachment({ name: 'specs.pdf', size: '1.2 MB' });
    expect(comp.messageService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        summary: 'Document Download',
      }),
    );
  });
});
