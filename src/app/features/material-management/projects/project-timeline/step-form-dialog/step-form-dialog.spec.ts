import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { StepFormDialog } from './step-form-dialog';
import { ProjectStep } from '../../../../../core/models/project-step.model';
import { FormDefinition } from '../../../../../core/constants/form-catalog';

describe('StepFormDialog Unit & CRUD Logic', () => {
  const mockFormDef: FormDefinition = {
    id: 1,
    formCode: 'FORM_01_PQB',
    name: 'National Pre-Qualification Bid (PQB)',
    category: 'Pre-Bidding & Tenders',
    phaseId: 'phase-1',
    icon: 'pi pi-file',
    description: 'Pre-qualification bid terms and schedule',
    fields: [
      { key: 'pqb_title', label: 'PQB Title', type: 'text', required: true },
      { key: 'pqb_no', label: 'PQB No.', type: 'text', required: true },
      { key: 'budget', label: 'Budget', type: 'number' },
    ],
    tableConfig: {
      title: 'Requirements',
      columns: [
        { key: 'sr_no', label: 'Sr. No.', type: 'number' },
        { key: 'quantity', label: 'Quantity', type: 'number' },
        { key: 'unit_price', label: 'Unit Price', type: 'number' },
        { key: 'total_amount', label: 'Total', type: 'number' },
      ],
      autoCalculateTotal: true,
      quantityKey: 'quantity',
      unitPriceKey: 'unit_price',
      totalKey: 'total_amount',
    },
    uploads: [{ key: 'doc', label: 'Bid Doc' }],
  };

  it('should initialize dynamic form controls with default values for catalog definition in ADD mode', () => {
    const comp = Object.create(StepFormDialog.prototype);
    comp.formGroup = { set: vi.fn() };
    comp.tableFormArray = { set: vi.fn() };
    comp.uploadedFiles = { set: vi.fn(), length: 0 };
    comp.stepRemarks = { set: vi.fn() };

    // Call populateForm
    (comp as any).populateForm(mockFormDef, {}, []);

    expect(comp.formGroup.set).toHaveBeenCalled();
    const createdGroup = comp.formGroup.set.mock.calls[0][0];
    expect(createdGroup.get('pqb_title')).toBeDefined();
    expect(createdGroup.get('pqb_no')).toBeDefined();
    expect(createdGroup.get('budget')).toBeDefined();
  });

  it('should pre-populate form controls from savedData in EDIT mode (GET)', () => {
    const comp = Object.create(StepFormDialog.prototype);
    comp.formGroup = { set: vi.fn() };
    comp.tableFormArray = { set: vi.fn() };
    comp.uploadedFiles = { set: vi.fn(), length: 0 };
    comp.stepRemarks = { set: vi.fn() };

    const savedData = {
      pqb_title: 'Turbine Overhaul Tender',
      pqb_no: 'PQB-2026-001',
      budget: 1500000,
      table_items: [{ sr_no: 1, quantity: 10, unit_price: 500, total_amount: 5000 }],
    };

    (comp as any).populateForm(mockFormDef, savedData, []);

    const createdGroup = comp.formGroup.set.mock.calls[0][0];
    expect(createdGroup.get('pqb_title').value).toBe('Turbine Overhaul Tender');
    expect(createdGroup.get('pqb_no').value).toBe('PQB-2026-001');
    expect(createdGroup.get('budget').value).toBe(1500000);
  });

  it('should execute POST when saving in ADD mode', () => {
    const comp = Object.create(StepFormDialog.prototype);
    const mockFormApiService = {
      createEntry: vi.fn().mockReturnValue(
        of({
          id: 999,
          step_name: 'National Pre-Qualification Bid (PQB)',
          form_code: 'FORM_01_PQB',
          status: 'in_progress',
        }),
      ),
      updateEntry: vi.fn(),
      deleteEntry: vi.fn(),
    };
    const mockMessageService = { add: vi.fn() };

    comp.formApiService = mockFormApiService;
    comp.messageService = mockMessageService;
    comp.projectId = () => 12;
    comp.resolvedDef = () => mockFormDef;
    comp.step = () => null; // ADD mode
    comp.saving = { set: vi.fn() };
    comp.formGroup = () => ({ value: { pqb_title: 'New Bid', pqb_no: 'B-01' } });
    comp.tableFormArray = () => ({ value: [] });
    comp.uploadedFiles = () => [];
    comp.stepRemarks = () => [];
    comp.stepSaved = { emit: vi.fn() };
    comp.close = vi.fn();

    // Trigger saveStep
    comp.saveStep(false);

    expect(mockFormApiService.createEntry).toHaveBeenCalledWith(
      mockFormDef,
      12,
      expect.objectContaining({
        pqb_title: 'New Bid',
        pqb_no: 'B-01',
      }),
      [],
    );
    expect(comp.stepSaved.emit).toHaveBeenCalled();
    expect(comp.close).toHaveBeenCalled();
  });

  it('should execute PUT when saving in EDIT mode', () => {
    const comp = Object.create(StepFormDialog.prototype);
    const mockFormApiService = {
      createEntry: vi.fn(),
      updateEntry: vi.fn().mockReturnValue(
        of({
          id: 55,
          step_name: 'National Pre-Qualification Bid (PQB)',
          status: 'completed',
        }),
      ),
      deleteEntry: vi.fn(),
    };
    const mockMessageService = { add: vi.fn() };

    const existingStep: ProjectStep = {
      id: 55,
      project_id: 12,
      step_number: 1,
      step_name: 'National Pre-Qualification Bid (PQB)',
      form_code: 'FORM_01_PQB',
      status: 'in_progress',
      progress_percentage: 50,
      completed_at: null,
      data: {},
    };

    comp.formApiService = mockFormApiService;
    comp.messageService = mockMessageService;
    comp.projectId = () => 12;
    comp.resolvedDef = () => mockFormDef;
    comp.step = () => existingStep; // EDIT mode
    comp.saving = { set: vi.fn() };
    comp.formGroup = () => ({ value: { pqb_title: 'Updated Bid Title' } });
    comp.tableFormArray = () => ({ value: [] });
    comp.customFields = () => [];
    comp.uploadedFiles = () => [];
    comp.stepRemarks = () => [];
    comp.stepSaved = { emit: vi.fn() };
    comp.close = vi.fn();

    // Trigger saveStep marking complete
    comp.saveStep(true);

    expect(mockFormApiService.updateEntry).toHaveBeenCalledWith(
      mockFormDef,
      12,
      55,
      expect.objectContaining({
        pqb_title: 'Updated Bid Title',
      }),
      [],
    );
    expect(comp.stepSaved.emit).toHaveBeenCalled();
    expect(comp.close).toHaveBeenCalled();
  });

  it('should execute DELETE when confirming delete of an existing step', () => {
    const comp = Object.create(StepFormDialog.prototype);
    const mockFormApiService = {
      deleteEntry: vi.fn().mockReturnValue(of(true)),
    };
    const mockMessageService = { add: vi.fn() };

    const existingStep: ProjectStep = {
      id: 88,
      project_id: 12,
      step_number: 2,
      step_name: 'RFQ Step',
      status: 'in_progress',
      progress_percentage: 20,
      completed_at: null,
    };

    comp.formApiService = mockFormApiService;
    comp.messageService = mockMessageService;
    comp.projectId = () => 12;
    comp.resolvedDef = () => mockFormDef;
    comp.step = () => existingStep;
    comp.deleting = { set: vi.fn() };
    comp.deleteConfirmVisible = { set: vi.fn() };
    comp.stepDeleted = { emit: vi.fn() };
    comp.close = vi.fn();

    // Trigger confirmDelete
    comp.confirmDelete();

    expect(mockFormApiService.deleteEntry).toHaveBeenCalledWith(mockFormDef, 12, 88);
    expect(comp.stepDeleted.emit).toHaveBeenCalledWith(88);
    expect(comp.close).toHaveBeenCalled();
  });

  it('should provide generous column widths and min-widths for table readability', () => {
    const comp = Object.create(StepFormDialog.prototype);

    expect(comp.getColumnWidth('description')).toBe('320px');
    expect(comp.getColumnMinWidth('description')).toBe('260px');

    expect(comp.getColumnWidth('sr_no')).toBe('56px');
    expect(comp.getColumnMinWidth('sr_no')).toBe('50px');

    expect(comp.getColumnWidth('unit_price')).toBe('130px');
    expect(comp.getColumnWidth('total_price')).toBe('140px');
    expect(comp.getColumnWidth('delivery_date')).toBe('150px');
  });

  it('should support timeline remarks management (add, remove, initials, and merging)', () => {
    const comp = Object.create(StepFormDialog.prototype);
    let currentRemarks: any[] = [];
    comp.stepRemarks = {
      update: vi.fn((fn: (arr: any[]) => any[]) => {
        currentRemarks = fn(currentRemarks);
      }),
      set: vi.fn((val: any[]) => {
        currentRemarks = val;
      }),
      mockGet: () => currentRemarks,
    };
    let inputVal = 'Audit check passed by QA';
    comp.newRemarkInput = Object.assign(() => inputVal, {
      set: vi.fn((val: string) => {
        inputVal = val;
      }),
    });
    Object.defineProperty(comp, 'projectId', { value: () => 10 });

    // Test addRemark
    comp.addRemark();
    expect(comp.stepRemarks.update).toHaveBeenCalled();
    expect(currentRemarks.length).toBe(1);
    expect(currentRemarks[0].remark).toBe('Audit check passed by QA');
    expect(comp.newRemarkInput.set).toHaveBeenCalledWith('');

    // Test getRemarkInitials
    expect(comp.getRemarkInitials('Shruti Kadam')).toBe('SK');
    expect(comp.getRemarkInitials('Admin')).toBe('AD');
    expect(comp.getRemarkInitials('')).toBe('TM');

    // Test removeRemark
    comp.removeRemark(0);
    expect(currentRemarks.length).toBe(0);
  });

  it('should support customer query aligned attachment methods (file icons, size formatting, and file management)', () => {
    const comp = Object.create(StepFormDialog.prototype);

    // Test getFileIcon
    expect(comp.getFileIcon('spec_doc.pdf')).toBe('pi pi-file-pdf');
    expect(comp.getFileIcon('estimate.xlsx')).toBe('pi pi-file-excel');
    expect(comp.getFileIcon('contract.docx')).toBe('pi pi-file-word');
    expect(comp.getFileIcon('photo.png')).toBe('pi pi-image');
    expect(comp.getFileIcon('unknown.bin')).toBe('pi pi-file');
    expect(comp.getFileIcon('')).toBe('pi pi-file');

    // Test formatFileSize
    expect(comp.formatFileSize(0)).toBe('0 B');
    expect(comp.formatFileSize(1024)).toBe('1 KB');
    expect(comp.formatFileSize(1048576)).toBe('1 MB');

    // Test file management
    let filesState: any[] = [];
    comp.uploadedFiles = Object.assign(() => filesState, {
      update: vi.fn((fn: (arr: any[]) => any[]) => {
        filesState = fn(filesState);
      }),
      set: vi.fn((val: any[]) => {
        filesState = val;
      }),
    });
    comp.messageService = { add: vi.fn() };
    comp.resolvedDef = () => mockFormDef;

    // Simulate onFilesSelected
    const fakeFile = { name: 'test.pdf', size: 2048 };
    const fakeEvent = {
      target: {
        files: [fakeFile],
        value: 'test.pdf',
      },
    } as any;

    comp.onFilesSelected(fakeEvent, 'doc');
    expect(filesState.length).toBe(1);
    expect(filesState[0].name).toBe('test.pdf');
    expect(filesState[0].size).toBe('2 KB');
    expect(comp.messageService.add).toHaveBeenCalled();

    // Test getFilesForUpload
    const filesForSlot = comp.getFilesForUpload('doc');
    expect(filesForSlot.length).toBe(1);

    // Test removeUploadedFileByRef
    comp.removeUploadedFileByRef(filesState[0]);
    expect(filesState.length).toBe(0);
  });
});

