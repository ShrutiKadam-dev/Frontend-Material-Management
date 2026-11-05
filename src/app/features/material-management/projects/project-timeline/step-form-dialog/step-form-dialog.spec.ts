import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { signal } from '@angular/core';
import { StepFormDialog } from './step-form-dialog';
import { ProjectStep } from '../../../../../core/models/project-step.model';
import { FormDefinition, getFormDefinition } from '../../../../../core/constants/form-catalog';

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
      { key: 'pqb_issuing_date', label: 'PQB Issuing Date', type: 'date' },
      { key: 'pqb_closing_date_time', label: 'PQB Closing Date & Time', type: 'datetime' },
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
    comp.saveStep();

    expect(mockFormApiService.createEntry).toHaveBeenCalledWith(
      mockFormDef,
      12,
      expect.objectContaining({
        pqb_title: 'New Bid',
        pqb_no: 'B-01',
        items: [],
      }),
      [],
    );
    const passedPayload = mockFormApiService.createEntry.mock.calls[0][2];
    expect(passedPayload['table_items']).toBeUndefined();
    expect(passedPayload['items']).toEqual([]);
    expect(comp.stepSaved.emit).toHaveBeenCalled();
    expect(comp.close).toHaveBeenCalled();
  });

  it('should format date 1/10/2026 to "2026-10-01" in saveStep preventing timezone shift to 30/09/2026', () => {
    const comp = Object.create(StepFormDialog.prototype);
    const mockFormApiService = {
      createEntry: vi.fn().mockReturnValue(of({ id: 101, step_name: 'National Pre-Qualification Bid (PQB)' })),
      updateEntry: vi.fn(),
      deleteEntry: vi.fn(),
    };
    const mockMessageService = { add: vi.fn() };

    comp.formApiService = mockFormApiService;
    comp.messageService = mockMessageService;
    comp.projectId = () => 15;
    comp.resolvedDef = () => mockFormDef; // FORM_01_PQB has pqb_issuing_date as type 'date'
    comp.step = () => null;
    comp.saving = { set: vi.fn() };
    // Datepicker selected 1/10/2026 (local Date object)
    comp.formGroup = () => ({
      value: {
        pqb_title: 'National Pre-Qualification Bid',
        pqb_no: 'PQB-001',
        pqb_issuing_date: new Date(2026, 9, 1), // Oct 1, 2026
        pqb_closing_date_time: new Date(2026, 9, 5, 15, 0, 0),
      },
    });
    comp.tableFormArray = () => ({ value: [] });
    comp.uploadedFiles = () => [];
    comp.stepRemarks = () => [];
    comp.stepSaved = { emit: vi.fn() };
    comp.close = vi.fn();

    comp.saveStep();

    expect(mockFormApiService.createEntry).toHaveBeenCalled();
    const passedPayload = mockFormApiService.createEntry.mock.calls[0][2];
    expect(passedPayload['pqb_issuing_date']).toBe('2026-10-01');
    expect(passedPayload['pqb_issuing_date']).not.toBe('2026-09-30');
    expect(passedPayload['pqb_closing_date_time']).toBe('2026-10-05T15:00:00');
  });

  it('should populate date field as local Date object from "2026-10-01" string', () => {
    const comp = Object.create(StepFormDialog.prototype);
    comp.formGroup = { set: vi.fn() };
    comp.tableFormArray = { set: vi.fn() };
    comp.uploadedFiles = { set: vi.fn(), length: 0 };
    comp.stepRemarks = { set: vi.fn() };
    comp.getDefaultFieldValue = StepFormDialog.prototype['getDefaultFieldValue'];

    (comp as any).populateForm(
      mockFormDef,
      {
        pqb_title: 'PQB 2026',
        pqb_no: 'PQB-100',
        pqb_issuing_date: '2026-10-01',
      },
      [],
    );

    const createdGroup = comp.formGroup.set.mock.calls[0][0];
    const dateVal = createdGroup.get('pqb_issuing_date').value;
    expect(dateVal).toBeInstanceOf(Date);
    expect(dateVal.getFullYear()).toBe(2026);
    expect(dateVal.getMonth()).toBe(9); // October
    expect(dateVal.getDate()).toBe(1);
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
      description: 'PQB step description',
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

    // Trigger saveStep
    comp.saveStep();

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
      description: 'RFQ description',
      status: 'in_progress',
      progress_percentage: 20,
      completed_at: null,
      data: {},
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
    let currentRemarks: Array<Record<string, unknown>> = [];
    comp.stepRemarks = {
      update: vi.fn((fn: (arr: Array<Record<string, unknown>>) => Array<Record<string, unknown>>) => {
        currentRemarks = fn(currentRemarks);
      }),
      set: vi.fn((val: Array<Record<string, unknown>>) => {
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
    expect(currentRemarks[0]['remark']).toBe('Audit check passed by QA');
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
    let filesState: File[] = [];
    comp.uploadedFiles = Object.assign(() => filesState, {
      update: vi.fn((fn: (arr: File[]) => File[]) => {
        filesState = fn(filesState);
      }),
      set: vi.fn((val: File[]) => {
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

  describe('Multilocation & Select Helpers', () => {
    it('should normalize select options correctly whether array of strings or SelectOption objects', () => {
      const comp = Object.create(StepFormDialog.prototype);

      const fieldWithStringOpts = {
        key: 'status',
        label: 'Status',
        type: 'select' as const,
        options: ['Active', 'Pending', 'Closed'],
      };
      const normalizedStrings = comp.getSelectOptions(fieldWithStringOpts);
      expect(normalizedStrings).toEqual([
        { label: 'Active', value: 'Active' },
        { label: 'Pending', value: 'Pending' },
        { label: 'Closed', value: 'Closed' },
      ]);

      const fieldWithObjectOpts = {
        key: 'incoterms',
        label: 'Incoterms',
        type: 'select' as const,
        options: [
          { label: 'EXW - Ex Works', value: 'EXW' },
          { label: 'FOB - Free on Board', value: 'FOB' },
        ],
      };
      const normalizedObjects = comp.getSelectOptions(fieldWithObjectOpts);
      expect(normalizedObjects).toEqual([
        { label: 'EXW - Ex Works', value: 'EXW' },
        { label: 'FOB - Free on Board', value: 'FOB' },
      ]);

      const fieldWithoutOpts = { key: 'desc', label: 'Desc', type: 'text' as const };
      expect(comp.getSelectOptions(fieldWithoutOpts)).toEqual([]);
    });

    it('should add, get, and remove locations for multilocation fields', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const control = {
        value: [] as string[],
        setValue: vi.fn((val) => {
          control.value = val;
        }),
        markAsDirty: vi.fn(),
      };
      const groupMock = {
        get: vi.fn((key: string) => (key === 'supply_location' ? control : null)),
      };
      comp.formGroup = () => groupMock;

      // 1. Initial locations is empty
      expect(comp.getLocations('supply_location')).toEqual([]);

      // 2. Add a single location
      const inputEl = { value: 'Mumbai' } as HTMLInputElement;
      comp.addLocation('supply_location', inputEl);
      expect(control.setValue).toHaveBeenCalledWith(['Mumbai']);
      expect(inputEl.value).toBe('');

      // 3. Add multiple locations via comma-separated string
      inputEl.value = 'Delhi, Bangalore';
      comp.addLocation('supply_location', inputEl);
      expect(control.setValue).toHaveBeenCalledWith(['Mumbai', 'Delhi', 'Bangalore']);

      // 4. Remove a location by index
      comp.removeLocation('supply_location', 1); // remove Delhi
      expect(control.setValue).toHaveBeenCalledWith(['Mumbai', 'Bangalore']);
    });

    it('should parse both string and array formats during initForm for multilocation fields', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.formGroup = { set: vi.fn() };
      comp.tableFormArray = { set: vi.fn() };
      comp.uploadedFiles = { set: vi.fn(), length: 0 };
      comp.stepRemarks = { set: vi.fn() };

      const locationFormDef: FormDefinition = {
        id: 21,
        formCode: 'FORM_21_TRANSPORTATION_DETAILS',
        name: 'Transportation Details',
        category: 'Logistics & Customs',
        phaseId: 'phase-3',
        icon: 'pi pi-truck',
        description: 'Transport details',
        fields: [
          { key: 'from_location', label: 'From Location', type: 'multilocation' },
          { key: 'to_location', label: 'To Location', type: 'multilocation' },
        ],
        uploads: [],
      };

      (comp as any).populateForm(
        locationFormDef,
        {
          from_location: 'Mumbai, Pune',
          to_location: ['Chennai', 'Hyderabad'],
        },
        [],
      );

      const createdGroup = comp.formGroup.set.mock.calls[0][0];
      expect(createdGroup.get('from_location').value).toEqual(['Mumbai', 'Pune']);
      expect(createdGroup.get('to_location').value).toEqual(['Chennai', 'Hyderabad']);
    });
  });

  describe('Table item handling and ghost row elimination', () => {
    it('should not add a default empty row when opening form with no saved items', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.formGroup = { set: vi.fn() };
      comp.tableFormArray = { set: vi.fn() };
      comp.uploadedFiles = { set: vi.fn(), length: 0 };
      comp.stepRemarks = { set: vi.fn() };
      comp.getDefaultFieldValue = StepFormDialog.prototype['getDefaultFieldValue'];
      comp.createTableRowGroup = StepFormDialog.prototype['createTableRowGroup'];

      (comp as any).populateForm(mockFormDef, {}, []);

      expect(comp.tableFormArray.set).toHaveBeenCalled();
      const rowsArray = comp.tableFormArray.set.mock.calls[0][0];
      expect(rowsArray.length).toBe(0);
    });

    it('should filter out ghost empty row with only sr_no during saveStep', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const mockFormApiService = {
        createEntry: vi.fn().mockReturnValue(of({ id: 201, step_name: 'PQB' })),
      };
      comp.formApiService = mockFormApiService;
      comp.messageService = { add: vi.fn() };
      comp.projectId = () => 10;
      comp.resolvedDef = () => mockFormDef;
      comp.step = () => null;
      comp.saving = { set: vi.fn() };
      comp.formGroup = () => ({ value: { pqb_title: 'Test PQB' } });
      // User did not fill item details, but row had { sr_no: 1, description: '', quantity: '' }
      comp.tableFormArray = () => ({
        value: [{ sr_no: 1, description: '', quantity: '', unit: '', unit_price: '' }],
      });
      comp.uploadedFiles = () => [];
      comp.stepRemarks = () => [];
      comp.stepSaved = { emit: vi.fn() };
      comp.close = vi.fn();

      comp.saveStep();

      expect(mockFormApiService.createEntry).toHaveBeenCalled();
      const payload = mockFormApiService.createEntry.mock.calls[0][2];
      expect(payload['items']).toEqual([]);
    });

    it('should allow removing rows down to 0 and re-sequence sr_no', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const row1 = new FormGroup({ sr_no: new FormControl(1), description: new FormControl('Item A') });
      const row2 = new FormGroup({ sr_no: new FormControl(2), description: new FormControl('Item B') });
      const formArray = new FormArray([row1, row2]);
      comp.tableFormArray = () => formArray;

      // Remove first row
      comp.removeTableRow(0);
      expect(formArray.length).toBe(1);
      expect(formArray.at(0).get('sr_no')?.value).toBe(1);
      expect(formArray.at(0).get('description')?.value).toBe('Item B');

      // Remove last remaining row down to 0
      comp.removeTableRow(0);
      expect(formArray.length).toBe(0);
    });

    it('should patch Description from material_name when editing Query from Customer', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.formGroup = { set: vi.fn() };
      comp.tableFormArray = Object.assign(() => new FormArray([]), { set: vi.fn() });
      comp.uploadedFiles = { set: vi.fn(), length: 0 };
      comp.stepRemarks = { set: vi.fn() };
      comp.getDefaultFieldValue = StepFormDialog.prototype['getDefaultFieldValue'];
      comp.createTableRowGroup = StepFormDialog.prototype['createTableRowGroup'];

      const customerQueryDef: FormDefinition = {
        id: 8,
        formCode: 'FORM_08_CUSTOMER_QUERY',
        name: 'Query from Customer',
        category: 'Sourcing & Quotations',
        phaseId: 'phase-2',
        icon: 'pi pi-question-circle',
        description: 'Customer inquiry',
        fields: [
          { key: 'customer_name', label: 'Customer Name', type: 'text' },
          { key: 'query_date', label: 'Query Date', type: 'date' },
        ],
        tableConfig: {
          title: 'Requirement',
          columns: [
            { key: 'sr_no', label: 'Sr. No.', type: 'number', width: '80px' },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'quantity', label: 'Quantity', type: 'number', width: '140px' },
          ],
        },
        uploads: [],
      };

      // Backend returns items using `material_name` instead of `description`
      const savedData = {
        customer_name: 'Bharat Heavy Electricals',
        query_date: '2026-10-15',
        items: [
          { id: 42, material_name: 'High Precision Turbine Blades', quantity: 20 },
        ],
      };

      (comp as any).populateForm(customerQueryDef, savedData, []);

      expect(comp.tableFormArray.set).toHaveBeenCalled();
      const rowsArray: FormArray<FormGroup> = comp.tableFormArray.set.mock.calls[0][0];
      expect(rowsArray.length).toBe(1);

      const firstRow = rowsArray.at(0);
      expect(firstRow.get('description')?.value).toBe('High Precision Turbine Blades');
      expect(firstRow.get('quantity')?.value).toBe(20);
      expect(firstRow.get('id')?.value).toBe(42);
    });

    it('should prefill customer_name, supplier_name, and project_title when filling a new form entry', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.formGroup = { set: vi.fn() };
      comp.tableFormArray = Object.assign(() => new FormArray([]), { set: vi.fn() });
      comp.uploadedFiles = { set: vi.fn(), length: 0 };
      comp.stepRemarks = { set: vi.fn() };
      comp.effectiveCustomerName = () => 'Acme Infrastructure';
      comp.effectiveSupplierName = () => 'Steel Authority Global';
      comp.effectiveProjectTitle = () => 'Substation Expansion Project';
      comp.getDefaultFieldValue = StepFormDialog.prototype['getDefaultFieldValue'];
      comp.createTableRowGroup = StepFormDialog.prototype['createTableRowGroup'];

      const testFormDef: FormDefinition = {
        id: 99,
        formCode: 'FORM_TEST_PREFILL',
        name: 'Test Form with Prefilled Parties',
        category: 'Customer & Supplier Settlement',
        phaseId: 'phase-2',
        icon: 'pi pi-file',
        description: 'Test prefill fields',
        fields: [
          { key: 'customer_name', label: 'Customer Name', type: 'text', required: true },
          { key: 'supplier_name', label: 'Supplier Name', type: 'text', required: true },
          { key: 'project_title', label: 'Project Title', type: 'text', required: true },
        ],
        uploads: [],
      };

      // Empty savedData as in ADD MODE
      (comp as any).populateForm(testFormDef, {}, []);

      expect(comp.formGroup.set).toHaveBeenCalled();
      const fg: FormGroup = comp.formGroup.set.mock.calls[0][0];
      expect(fg.get('customer_name')?.value).toBe('Acme Infrastructure');
      expect(fg.get('supplier_name')?.value).toBe('Steel Authority Global');
      expect(fg.get('project_title')?.value).toBe('Substation Expansion Project');
    });

    it('should retain existing savedData when editing and only prefill blank fields', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.formGroup = { set: vi.fn() };
      comp.tableFormArray = Object.assign(() => new FormArray([]), { set: vi.fn() });
      comp.uploadedFiles = { set: vi.fn(), length: 0 };
      comp.stepRemarks = { set: vi.fn() };
      comp.effectiveCustomerName = () => 'Acme Infrastructure';
      comp.effectiveSupplierName = () => 'Steel Authority Global';
      comp.effectiveProjectTitle = () => 'Substation Expansion Project';
      comp.getDefaultFieldValue = StepFormDialog.prototype['getDefaultFieldValue'];
      comp.createTableRowGroup = StepFormDialog.prototype['createTableRowGroup'];

      const testFormDef: FormDefinition = {
        id: 99,
        formCode: 'FORM_TEST_PREFILL',
        name: 'Test Form with Prefilled Parties',
        category: 'Customer & Supplier Settlement',
        phaseId: 'phase-2',
        icon: 'pi pi-file',
        description: 'Test prefill fields',
        fields: [
          { key: 'customer_name', label: 'Customer Name', type: 'text', required: true },
          { key: 'supplier_name', label: 'Supplier Name', type: 'text', required: true },
          { key: 'project_title', label: 'Project Title', type: 'text', required: true },
        ],
        uploads: [],
      };

      // Existing savedData has a custom supplier, but empty customer_name and missing project_title
      const savedData = {
        supplier_name: 'Custom Fabricator Ltd',
        customer_name: '',
      };

      (comp as any).populateForm(testFormDef, savedData, []);

      expect(comp.formGroup.set).toHaveBeenCalled();
      const fg: FormGroup = comp.formGroup.set.mock.calls[0][0];
      // Should retain custom supplier
      expect(fg.get('supplier_name')?.value).toBe('Custom Fabricator Ltd');
      // Should prefill empty customer_name and missing project_title
      expect(fg.get('customer_name')?.value).toBe('Acme Infrastructure');
      expect(fg.get('project_title')?.value).toBe('Substation Expansion Project');
    });
  });

  describe('Form Dialog Button Disabled Validation', () => {
    it('should calculate isSaveDisabled as true when form is invalid or saving or deleting', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.isFormInvalid = () => true;
      comp.saving = () => false;
      comp.deleting = () => false;
      comp.loading = () => false;

      // When form is invalid
      expect(comp.checkSaveDisabled()).toBe(true);

      // When form is valid but saving is true
      comp.isFormInvalid = () => false;
      comp.saving = () => true;
      expect(comp.checkSaveDisabled()).toBe(true);

      // When form is valid but deleting is true
      comp.saving = () => false;
      comp.deleting = () => true;
      expect(comp.checkSaveDisabled()).toBe(true);

      // When form is valid and not saving/deleting
      comp.deleting = () => false;
      expect(comp.checkSaveDisabled()).toBe(false);
    });

    it('should stop saveStep and notify with warning when formGroup is invalid', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const mockFormApiService = {
        createEntry: vi.fn(),
        updateEntry: vi.fn(),
      };
      const mockMessageService = { add: vi.fn() };
      const markAllAsTouched = vi.fn();

      comp.formApiService = mockFormApiService;
      comp.messageService = mockMessageService;
      comp.projectId = () => 10;
      comp.resolvedDef = () => mockFormDef;
      comp.saving = { set: vi.fn() };
      comp.isFormInvalid = { set: vi.fn() };
      comp.formGroup = () => ({
        invalid: true,
        markAllAsTouched,
        value: { pqb_title: '', pqb_no: '' },
      });

      comp.saveStep();

      expect(markAllAsTouched).toHaveBeenCalled();
      expect(mockMessageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          summary: 'Required Fields Missing',
        }),
      );
      expect(mockFormApiService.createEntry).not.toHaveBeenCalled();
      expect(comp.saving.set).not.toHaveBeenCalled();
    });

    it('should calculate total_net_amount, gst_amount, and total_gross_amount during saveStep when GST is present', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const mockFormApiService = {
        createEntry: vi.fn().mockReturnValue(of({ id: 100 })),
        updateEntry: vi.fn(),
      };
      const mockMessageService = { add: vi.fn() };

      const defWithGst = {
        ...mockFormDef,
        fields: [
          ...mockFormDef.fields,
          { key: 'gst_rate_pct', label: 'GST %', type: 'number' },
        ],
        tableConfig: {
          key: 'table_items',
          columns: [{ key: 'total_amount', label: 'Total', type: 'currency' }],
          autoCalculateTotal: true,
          totalKey: 'total_amount',
        },
      };

      comp.formApiService = mockFormApiService;
      comp.messageService = mockMessageService;
      comp.projectId = () => 10;
      comp.resolvedDef = () => defWithGst;
      comp.step = () => null;
      comp.saving = { set: vi.fn() };
      comp.formGroup = () => ({
        invalid: false,
        value: { pqb_title: 'Title', pqb_no: '001', gst_rate_pct: 18 },
      });
      comp.tableFormArray = () => ({
        value: [
          { sr_no: 1, description: 'Item 1', total_amount: 10000 },
          { sr_no: 2, description: 'Item 2', total_amount: 20000 },
        ],
      });
      comp.uploadedFiles = () => [];
      comp.stepRemarks = () => [];
      comp.stepSaved = { emit: vi.fn() };
      comp.close = vi.fn();
      comp.tableNetAmount = () => 30000;
      comp.hasTableGst = () => true;
      comp.tableGstAmount = () => 5400;
      comp.tableGrossTotalSum = () => 35400;

      comp.saveStep();

      expect(mockFormApiService.createEntry).toHaveBeenCalledWith(
        defWithGst,
        10,
        expect.objectContaining({
          total_net_amount: 30000,
          gst_amount: 5400,
          total_gross_amount: 35400,
          total_amount: 35400,
        }),
        [],
      );
    });

    it('should set total_gross_amount equal to total_net_amount during saveStep when GST is not present', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const mockFormApiService = {
        createEntry: vi.fn().mockReturnValue(of({ id: 101 })),
        updateEntry: vi.fn(),
      };
      const mockMessageService = { add: vi.fn() };

      const defWithoutGst = {
        ...mockFormDef,
        tableConfig: {
          key: 'table_items',
          columns: [{ key: 'total_amount', label: 'Total', type: 'currency' }],
          autoCalculateTotal: true,
          totalKey: 'total_amount',
        },
      };

      comp.formApiService = mockFormApiService;
      comp.messageService = mockMessageService;
      comp.projectId = () => 10;
      comp.resolvedDef = () => defWithoutGst;
      comp.step = () => null;
      comp.saving = { set: vi.fn() };
      comp.formGroup = () => ({
        invalid: false,
        value: { pqb_title: 'Title', pqb_no: '001' },
      });
      comp.tableFormArray = () => ({
        value: [{ sr_no: 1, description: 'Item 1', total_amount: 5000 }],
      });
      comp.uploadedFiles = () => [];
      comp.stepRemarks = () => [];
      comp.stepSaved = { emit: vi.fn() };
      comp.close = vi.fn();
      comp.tableNetAmount = () => 5000;
      comp.hasTableGst = () => false;

      comp.saveStep();

      expect(mockFormApiService.createEntry).toHaveBeenCalledWith(
        defWithoutGst,
        10,
        expect.objectContaining({
          total_net_amount: 5000,
          total_gross_amount: 5000,
          total_amount: 5000,
        }),
        [],
      );
    });

    it('should keep total_net_amount and exclude table GST for FORM_10_COST_SHEET dialog', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const mockFormApiService = {
        createEntry: vi.fn().mockReturnValue(of({ id: 110 })),
        updateEntry: vi.fn(),
      };
      const mockMessageService = { add: vi.fn() };

      const costSheetDef: FormDefinition = {
        id: 10,
        formCode: 'FORM_10_COST_SHEET',
        name: 'Cost Sheet',
        category: 'Sourcing & Quotations',
        phaseId: 'phase-2',
        icon: 'pi pi-calculator',
        description: 'Cost Sheet',
        fields: [
          { key: 'project_title', label: 'Project Title', type: 'text' },
          { key: 'total_amount_eur', label: 'Total Amount in EUR', type: 'currency' },
          { key: 'gst_pct', label: 'GST %', type: 'number' },
          { key: 'gst_amount', label: 'GST Amount', type: 'currency' },
        ],
        tableConfig: {
          title: 'Cost Sheet Line Items & Landed Cost Breakdown',
          autoCalculateTotal: true,
          quantityKey: 'quantity',
          unitPriceKey: 'price_per_unit_eur',
          totalKey: 'total_price_eur',
          columns: [
            { key: 'sr_no', label: 'Sr. No.', type: 'number' },
            { key: 'description', label: 'Item Description', type: 'text' },
            { key: 'item_code', label: 'Item Code', type: 'text' },
            { key: 'price_per_unit_eur', label: 'Price Per Unit [EUR]', type: 'currency' },
            { key: 'quantity', label: 'Quantity', type: 'number' },
          ],
        },
        uploads: [],
      };

      comp.formApiService = mockFormApiService;
      comp.messageService = mockMessageService;
      comp.projectId = () => 15;
      comp.resolvedDef = () => costSheetDef;
      comp.step = () => null;
      comp.saving = { set: vi.fn() };
      comp.formGroup = () => ({
        invalid: false,
        value: {
          project_title: 'Turbine Project',
          gst_pct: 18,
          gst_amount: 45000,
        },
      });
      comp.tableFormArray = () => ({
        value: [
          { sr_no: 1, description: 'Motor', item_code: 'M-1', price_per_unit_eur: 1500, quantity: 2, total_price_eur: 3000 },
          { sr_no: 2, description: 'Sensor', item_code: 'S-1', price_per_unit_eur: 500, quantity: 4, total_price_eur: 2000 },
        ],
      });
      comp.uploadedFiles = () => [];
      comp.stepRemarks = () => [];
      comp.stepSaved = { emit: vi.fn() };
      comp.close = vi.fn();
      comp.tableNetAmount = () => 5000;
      comp.tableTotalSum = () => 5000;
      comp.hasTableGst = () => false;

      comp.saveStep();

      expect(mockFormApiService.createEntry).toHaveBeenCalledWith(
        costSheetDef,
        15,
        expect.objectContaining({
          total_net_amount: 5000,
          total_amount_eur: 5000,
          gst_pct: 18,
          gst_amount: 45000,
        }),
        [],
      );
    });
  });

  describe('Quotation from Supplier Dynamic Currency Selection & Table Updating', () => {
    const supplierQuotationDef: FormDefinition = {
      id: 11,
      formCode: 'FORM_11_SUPPLIER_QUOTATION',
      name: 'Quotation from Supplier',
      category: 'Sourcing & Quotations',
      phaseId: 'phase-2',
      icon: 'pi pi-tags',
      description: 'Detailed quotation received from vendor',
      apiEndpoint: '/api/v1/supplier-quotations',
      uploads: [],
      fields: [
        { key: 'supplier_name', label: 'Supplier Name', type: 'text', required: true },
        { key: 'quotation_no', label: 'Quotation No.', type: 'text', required: true },
        { key: 'quotation_value', label: 'Quotation Value', type: 'currency', hasCurrencySelect: true },
      ],
      tableConfig: {
        title: 'Quoted Materials & Pricing',
        autoCalculateTotal: true,
        columns: [
          { key: 'sr_no', label: 'Sr. No.', type: 'number' },
          { key: 'description', label: 'Description', type: 'text' },
          { key: 'quantity', label: 'Quantity', type: 'number' },
          { key: 'unit_price', label: 'Unit Price', type: 'currency' },
          { key: 'total_amount', label: 'Total Amount', type: 'currency' },
        ],
      },
    };

    it('should identify quotation_value as currency field with select', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const qvField = supplierQuotationDef.fields.find((f) => f.key === 'quotation_value');
      expect(comp.isCurrencyWithSelect(qvField!)).toBe(true);

      const regularField = supplierQuotationDef.fields.find((f) => f.key === 'supplier_name');
      expect(comp.isCurrencyWithSelect(regularField!)).toBe(false);
    });

    it('should dynamically update currency and column headers on currency selection', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        currency_unit: new FormControl('INR'),
        currency_symbol: new FormControl('₹'),
        quotation_value: new FormControl(50000),
      });
      comp.formGroup = () => fg;
      comp.resolvedDef = () => supplierQuotationDef;
      comp.selectedCurrency = {
        val: 'INR',
        set(v: string) { this.val = v; },
      };
      // Bind signals as functions
      const curSig = () => comp.selectedCurrency.val;
      comp.selectedCurrency = Object.assign(curSig, comp.selectedCurrency);
      comp.tableCurrencySymbol = () => comp.selectedCurrency() === 'USD' ? '$' : (comp.selectedCurrency() === 'EUR' ? '€' : '₹');
      comp.formVersion = { update: vi.fn() };

      const unitPriceCol = supplierQuotationDef.tableConfig!.columns.find((c) => c.key === 'unit_price')!;
      const totalAmountCol = supplierQuotationDef.tableConfig!.columns.find((c) => c.key === 'total_amount')!;

      // Default state: INR
      expect(comp.getColumnLabel(unitPriceCol)).toBe('Unit Price (₹)');
      expect(comp.getColumnLabel(totalAmountCol)).toBe('Total Amount (₹)');

      // User changes currency to USD
      comp.onCurrencyChange('USD');

      expect(comp.selectedCurrency()).toBe('USD');
      expect(comp.tableCurrencySymbol()).toBe('$');
      expect(fg.get('currency_unit')?.value).toBe('USD');
      expect(fg.get('currency_symbol')?.value).toBe('$');

      // Table column headers dynamically update to USD ($)
      expect(comp.getColumnLabel(unitPriceCol)).toBe('Unit Price ($)');
      expect(comp.getColumnLabel(totalAmountCol)).toBe('Total Amount ($)');

      // User changes currency to EUR
      comp.onCurrencyChange('EUR');
      expect(comp.selectedCurrency()).toBe('EUR');
      expect(comp.tableCurrencySymbol()).toBe('€');
      expect(comp.getColumnLabel(unitPriceCol)).toBe('Unit Price (€)');
      expect(comp.getColumnLabel(totalAmountCol)).toBe('Total Amount (€)');
    });

    it('should include selected currency and symbol in payload on save', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const mockFormApiService = {
        createEntry: vi.fn().mockReturnValue(of({ id: 101, step_name: 'Quotation from Supplier' })),
        updateEntry: vi.fn().mockReturnValue(of({ id: 101, step_name: 'Quotation from Supplier' })),
      };

      comp.formApiService = mockFormApiService;
      comp.messageService = { add: vi.fn() };
      comp.projectId = () => 42;
      comp.resolvedDef = () => supplierQuotationDef;
      comp.step = () => null;
      comp.saving = { set: vi.fn() };
      comp.selectedCurrency = () => 'EUR';

      const fg = new FormGroup({
        supplier_name: new FormControl('Global Tech Vendor'),
        quotation_no: new FormControl('QT-2026-099'),
        quotation_value: new FormControl(75000),
        currency_unit: new FormControl('EUR'),
        currency_symbol: new FormControl('€'),
      });
      comp.formGroup = () => fg;
      comp.tableFormArray = () => ({
        value: [{ sr_no: 1, description: 'Motor Parts', quantity: 10, unit_price: 7500, total_amount: 75000 }],
      });
      comp.uploadedFiles = () => [];
      comp.stepRemarks = () => [];
      comp.stepSaved = { emit: vi.fn() };
      comp.close = vi.fn();
      comp.tableNetAmount = () => 75000;
      comp.hasTableGst = () => false;

      comp.saveStep();

      expect(mockFormApiService.createEntry).toHaveBeenCalledWith(
        supplierQuotationDef,
        42,
        expect.objectContaining({
          currency_unit: 'EUR',
          currency_symbol: '€',
          currency: 'EUR',
          quotation_value: 75000,
          total_net_amount: 75000,
        }),
        [],
      );
    });
  });

  describe('Form 2: Bid Document for PQB Auto-Patching from National PQB Latest API', () => {
    const pqbBidDocDef: FormDefinition = {
      id: 2,
      formCode: 'FORM_02_PQB_BID_DOCUMENT',
      name: 'Bid Document for PQB',
      category: 'Pre-Bidding & Tenders',
      phaseId: 'phase-1',
      icon: 'pi pi-book',
      description: 'Documentation for PQB submission',
      apiEndpoint: '/api/v1/pqb-bid-documents',
      fields: [
        { key: 'pqb_title', label: 'PQB Title', type: 'text', required: true },
        { key: 'pqb_no', label: 'PQB No.', type: 'text', required: true },
        { key: 'pqb_issue_date', label: 'PQB Issue Date', type: 'date' },
        { key: 'pqb_closing_date_time', label: 'PQB Closing Date & Time', type: 'datetime' },
        { key: 'pqb_opening_date_time', label: 'PQB Opening Date & Time', type: 'datetime' },
        { key: 'total_no_corrigendum_issued', label: 'Total No. Corrigendum Issued', type: 'number' },
      ],
      uploads: [{ key: 'upload_bid_document_pqb', label: 'Upload' }],
    };

    it('should patch pqb_title and pqb_no when loadFromNationalPreQualificationBid succeeds', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        pqb_title: new FormControl(''),
        pqb_no: new FormControl(''),
        pqb_issue_date: new FormControl(null),
        pqb_closing_date_time: new FormControl(null),
        pqb_opening_date_time: new FormControl(null),
      });

      const mockPqbService = {
        getLatest: vi.fn().mockReturnValue(
          of({
            pqb_title: 'National Grid High Voltage Substation',
            pqb_no: 'GRID-PQB-2026-99',
            pqb_issuing_date: '2026-04-10',
            pqb_closing_date_time: '2026-04-25T18:00',
            pqb_opening_date_time: '2026-04-26T10:00',
          }),
        ),
      };

      comp.projectId = () => 50;
      comp.preQualificationBidService = mockPqbService;
      comp.fetchingNationalPqb = { set: vi.fn() };
      comp.formGroup = () => fg;
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };
      comp.messageService = { add: vi.fn() };

      comp.loadFromNationalPreQualificationBid(true);

      expect(mockPqbService.getLatest).toHaveBeenCalledWith(50);
      expect(fg.get('pqb_title')?.value).toBe('National Grid High Voltage Substation');
      expect(fg.get('pqb_no')?.value).toBe('GRID-PQB-2026-99');
      expect(fg.get('pqb_issue_date')?.value).toBeDefined();
      expect(comp.messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'PQB Details Patched',
        }),
      );
    });

    it('should show warning if no National PQB is found for the project', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        pqb_title: new FormControl(''),
        pqb_no: new FormControl(''),
      });

      const mockPqbService = {
        getLatest: vi.fn().mockReturnValue(of(null)),
      };

      comp.projectId = () => 50;
      comp.preQualificationBidService = mockPqbService;
      comp.fetchingNationalPqb = { set: vi.fn() };
      comp.formGroup = () => fg;
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };
      comp.messageService = { add: vi.fn() };

      comp.loadFromNationalPreQualificationBid(true);

      expect(comp.messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          summary: 'National PQB Not Found',
        }),
      );
      expect(fg.get('pqb_title')?.value).toBe('');
      expect(fg.get('pqb_no')?.value).toBe('');
    });

    it('should auto-trigger loadFromNationalPreQualificationBid in ADD mode for FORM_02_PQB_BID_DOCUMENT', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.activeTab = { set: vi.fn() };
      comp.newRemarkInput = { set: vi.fn() };
      comp.ensureProjectMetadata = vi.fn();
      comp.projectId = () => 77;
      comp.resolvedDef = { set: vi.fn() };
      comp.populateForm = vi.fn();
      comp.loadFromNationalPreQualificationBid = vi.fn();

      comp.initializeModal(null, pqbBidDocDef);

      expect(comp.resolvedDef.set).toHaveBeenCalledWith(pqbBidDocDef);
      expect(comp.populateForm).toHaveBeenCalledWith(pqbBidDocDef, {}, []);
      expect(comp.loadFromNationalPreQualificationBid).toHaveBeenCalledWith(false);
    });
  });

  describe('Form 3: Corrigendum Auto-Patching & Comparison Table', () => {
    const corrigendumDef: FormDefinition = {
      id: 3,
      formCode: 'FORM_03_CORRIGENDUM',
      name: 'Corrigendum',
      category: 'Pre-Bidding & Tenders',
      phaseId: 'phase-1',
      icon: 'pi pi-sync',
      description: 'Corrigendum amendment notices issued against EOI, PQB, or Tender notices',
      apiEndpoint: '/api/v1/corrigendums',
      fields: [
        { key: 'corrigendum_no', label: 'Corrigendum No.', type: 'text', required: true },
        { key: 'against_ref_no', label: 'Against EOI / PQB / Tender No.', type: 'text', required: true },
        { key: 'ref_title', label: 'EOI / PQB / Tender Title', type: 'text' },
        { key: 'issue_date', label: 'Corrigendum Issue Date', type: 'date' },
      ],
      tableConfig: {
        title: 'Corrigendum Details',
        columns: [
          { key: 'sr_no', label: 'SR. NO.', type: 'number' },
          { key: 'as_per_tender_doc', label: 'AS PER EOI/PQB/TENDER DOCUMENT', type: 'textarea' },
          { key: 'as_per_corrigendum', label: 'AS PER CORRIGENDUM', type: 'textarea' },
        ],
      },
      uploads: []
    };

    it('should initialize 8 standard amendment rows when ensureCorrigendumDefaultRows is called on empty table', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const tableArray = new FormArray<any>([]);

      comp.resolvedDef = () => getFormDefinition('FORM_03_CORRIGENDUM');
      comp.tableFormArray = Object.assign(() => tableArray, {
        set: (newArr: any) => {
          tableArray.clear();
          newArr.controls.forEach((c: any) => tableArray.push(c));
        },
      });
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };

      comp.ensureCorrigendumDefaultRows();

      expect(tableArray.length).toBe(8);
      expect(tableArray.at(0).get('sr_no')?.value).toBe(1);
      expect(tableArray.at(0).get('as_per_tender_doc')?.value).toBe('CLOSING DATE & TIME:');
      expect(tableArray.at(0).get('as_per_corrigendum')?.value).toBe('CLOSING DATE & TIME:');

      expect(tableArray.at(1).get('sr_no')?.value).toBe(2);
      expect(tableArray.at(1).get('as_per_tender_doc')?.value).toBe('OPENING DATE & TIME:');

      expect(tableArray.at(2).get('sr_no')?.value).toBe(3);
      expect(tableArray.at(2).get('as_per_tender_doc')?.value).toBe('QUANTITY: (TABLE)');

      expect(tableArray.at(3).get('sr_no')?.value).toBe(4);
      expect(tableArray.at(3).get('as_per_tender_doc')?.value).toBe('PAYMENT TERMS:');

      expect(tableArray.at(4).get('sr_no')?.value).toBe(5);
      expect(tableArray.at(4).get('as_per_tender_doc')?.value).toBe('EMD:');

      expect(tableArray.at(5).get('sr_no')?.value).toBe(6);
      expect(tableArray.at(5).get('as_per_tender_doc')?.value).toBe('DELIVERY SCHEDULE:');

      expect(tableArray.at(6).get('sr_no')?.value).toBe(7);
      expect(tableArray.at(6).get('as_per_tender_doc')?.value).toBe('TENDER FEE');

      expect(tableArray.at(7).get('sr_no')?.value).toBe(8);
      expect(tableArray.at(7).get('as_per_tender_doc')?.value).toBe('TECHNICAL SPECIFICATION:');
    });

    it('should patch title, tender no, and previous document values from a preceding LTE step', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        corrigendum_no: new FormControl(''),
        against_ref_no: new FormControl(''),
        ref_title: new FormControl(''),
        issue_date: new FormControl(null),
      });

      const tableArray = new FormArray<any>([]);
      comp.resolvedDef = () => getFormDefinition('FORM_03_CORRIGENDUM');
      comp.formGroup = () => fg;
      comp.tableFormArray = Object.assign(() => tableArray, {
        set: (newArr: any) => {
          tableArray.clear();
          newArr.controls.forEach((c: any) => tableArray.push(c));
        },
      });
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };
      comp.messageService = { add: vi.fn() };
      comp.linkedTenderStep = { set: vi.fn() };
      comp.effectiveProjectTitle = () => 'Substation Project';

      const lteStep: ProjectStep = {
        id: 101,
        project_id: 15,
        step_number: 1,
        step_name: 'Limited Tender Enquiry (LTE)',
        description: 'LTE Step',
        form_code: 'FORM_04_LTE',
        status: 'completed',
        progress_percentage: 100,
        completed_at: '2026-06-15T10:00:00',
        data: {
          lte_title: 'Substation Transformer Procurement',
          lte_no: 'LTE-TRANS-2026-004',
          closing_date_time: '2026-06-15T15:00:00',
          opening_date_time: '2026-06-16T11:00:00',
          tender_fee: 5000,
          emd_amount: 150000,
          payment_terms: '100% against final inspection',
          delivery_schedule: '60 days from PO issuance',
          technical_specifications: 'Standard 400kV Power Transformer Specs v2',
          items: [
            { material_name: '400kV Step-up Transformer', quantity: 2, unit: 'Nos.' },
            { material_name: 'Surge Arrester Set', quantity: 6, unit: 'Sets' },
          ],
        },
      };

      comp.applyPreviousStepToCorrigendum(lteStep, true);

      expect(fg.get('ref_title')?.value).toBe('Substation Transformer Procurement');
      expect(fg.get('against_ref_no')?.value).toBe('LTE-TRANS-2026-004');

      expect(tableArray.length).toBe(8);
      // Row 1: Closing date & time
      expect(tableArray.at(0).get('as_per_tender_doc')?.value).toContain('CLOSING DATE & TIME:');

      // Row 2: Opening date & time
      expect(tableArray.at(1).get('as_per_tender_doc')?.value).toContain('OPENING DATE & TIME:');

      // Row 3: Quantity
      expect(tableArray.at(2).get('as_per_tender_doc')?.value).toContain('QUANTITY: (TABLE)');
      expect(tableArray.at(2).get('as_per_tender_doc')?.value).toContain('400kV Step-up Transformer');
      expect(tableArray.at(2).get('as_per_tender_doc')?.value).toContain('Surge Arrester Set');

      // Row 4: Payment terms
      expect(tableArray.at(3).get('as_per_tender_doc')?.value).toContain('100% against final inspection');

      // Row 5: EMD
      expect(tableArray.at(4).get('as_per_tender_doc')?.value).toContain('1,50,000');

      // Row 6: Delivery schedule
      expect(tableArray.at(5).get('as_per_tender_doc')?.value).toContain('60 days from PO issuance');

      // Row 7: Tender fee
      expect(tableArray.at(6).get('as_per_tender_doc')?.value).toContain('5,000');

      // Row 8: Technical specification
      expect(tableArray.at(7).get('as_per_tender_doc')?.value).toContain('Standard 400kV Power Transformer Specs v2');

      expect(comp.messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: expect.stringMatching(/Linked|Patched/i),
        }),
      );
      expect(comp.linkedTenderStep.set).toHaveBeenCalledWith(lteStep);
    });

    it('should ignore non-tender bid documents (e.g. FORM_02_PQB_BID_DOCUMENT) but link eligible tender steps', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const mockProjectStepService = {
        getSteps: vi.fn().mockReturnValue(
          of([
            {
              id: 1,
              project_id: 20,
              step_number: 1,
              step_name: 'National Pre-Qualification Bid (PQB)',
              form_code: 'FORM_01_PQB',
              status: 'completed',
              data: {
                pqb_title: 'Thermal Plant Overhaul',
                pqb_no: 'PQB-PIPE-2026',
              },
            },
            {
              id: 1026,
              project_id: 20,
              step_number: 2,
              step_name: 'Bid Document for PQB',
              form_code: 'FORM_02_PQB_BID_DOCUMENT',
              status: 'completed',
              data: {
                customer_name: 'NTPC',
              },
            },
            {
              id: 3,
              project_id: 20,
              step_number: 3,
              step_name: 'Limited Tender Enquiry (LTE)',
              form_code: 'FORM_04_LTE',
              status: 'completed',
              data: {
                tender_title: 'Turbine Overhaul Enquiry',
                tender_enquiry_no: 'LTE-TURB-2026',
              },
            },
          ]),
        ),
      };

      const mockFormApiService = {
        getEntries: vi.fn().mockReturnValue(of([])),
        getLatestEntry: vi.fn().mockReturnValue(of(null)),
      };

      comp.projectId = () => 20;
      comp.projectStepService = mockProjectStepService;
      comp.formApiService = mockFormApiService;
      comp.fetchingPreviousStep = { set: vi.fn() };
      comp.applyPreviousStepToCorrigendum = vi.fn();
      comp.messageService = { add: vi.fn() };
      comp.step = () => null; // ADD mode

      comp.loadFromPreviousTenderStep(true);

      expect(mockProjectStepService.getSteps).toHaveBeenCalledWith(20);
      // FORM_02_PQB_BID_DOCUMENT must be ignored; matching tender step is FORM_04_LTE
      expect(comp.applyPreviousStepToCorrigendum).toHaveBeenCalledWith(
        expect.objectContaining({ form_code: 'FORM_04_LTE' }),
        true,
      );
    });

    it('should link and patch Corrigendum from preceding FORM_31_BID_DOC_LTE when present', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.hasTenderData = StepFormDialog.prototype['hasTenderData'];
      const mockProjectStepService = {
        getSteps: vi.fn().mockReturnValue(
          of([
            {
              id: 1,
              project_id: 20,
              step_number: 1,
              step_name: 'Limited Tender Enquiry (LTE)',
              form_code: 'FORM_04_LTE',
              status: 'completed',
              updated_at: '2026-03-01T10:00:00Z',
              data: {
                tender_title: 'Turbine Overhaul Enquiry',
                tender_enquiry_no: 'LTE-TURB-2026',
              },
            },
            {
              id: 31,
              project_id: 20,
              step_number: 31,
              step_name: 'Bid Document - Limited Tender Enquiry (LTE)',
              form_code: 'FORM_31_BID_DOC_LTE',
              status: 'completed',
              updated_at: '2026-03-05T12:00:00Z',
              data: {
                tender_title: 'Turbine Overhaul Final Bid Doc',
                tender_no: 'LTE-BID-DOC-2026',
              },
            },
          ]),
        ),
      };

      const mockFormApiService = {
        getEntries: vi.fn().mockReturnValue(of([])),
        getLatestEntry: vi.fn().mockReturnValue(of(null)),
      };

      comp.projectId = () => 20;
      comp.projectStepService = mockProjectStepService;
      comp.formApiService = mockFormApiService;
      comp.fetchingPreviousStep = { set: vi.fn() };
      comp.applyPreviousStepToCorrigendum = vi.fn();
      comp.messageService = { add: vi.fn() };
      comp.step = () => null;

      comp.loadFromPreviousTenderStep(true);

      expect(comp.applyPreviousStepToCorrigendum).toHaveBeenCalledWith(
        expect.objectContaining({ form_code: 'FORM_31_BID_DOC_LTE' }),
        true,
      );
    });

    it('should fall back to fetchLatestTenderFromBackend when candidate in-memory step has 0 tender data and /latest returns null', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const emptyCandidate: ProjectStep = {
        id: 31,
        project_id: 20,
        step_number: 31,
        step_name: 'Bid Document - Limited Tender Enquiry (LTE)',
        form_code: 'FORM_31_BID_DOC_LTE',
        status: 'pending',
        progress_percentage: 0,
        completed_at: null,
        description: '',
        data: {},
      };

      const mockFormApiService = {
        getLatestEntry: vi.fn().mockReturnValue(of(null)),
      };

      comp.formApiService = mockFormApiService;
      comp.fetchingPreviousStep = { set: vi.fn() };
      comp.fetchLatestTenderFromBackend = vi.fn();
      comp.applyPreviousStepToCorrigendum = vi.fn();
      comp.hasTenderData = StepFormDialog.prototype['hasTenderData'];

      comp['fetchAndApplyTenderStep'](20, emptyCandidate, true);

      expect(mockFormApiService.getLatestEntry).toHaveBeenCalled();
      expect(comp.applyPreviousStepToCorrigendum).not.toHaveBeenCalled();
      expect(comp.fetchLatestTenderFromBackend).toHaveBeenCalledWith(20, true);
    });

    it('should auto-trigger default rows and loadFromPreviousTenderStep in ADD mode for FORM_03_CORRIGENDUM', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.activeTab = { set: vi.fn() };
      comp.newRemarkInput = { set: vi.fn() };
      comp.ensureProjectMetadata = vi.fn();
      comp.projectId = () => 42;
      comp.resolvedDef = { set: vi.fn() };
      comp.populateForm = vi.fn();
      comp.loadFromNationalPreQualificationBid = vi.fn();
      comp.ensureCorrigendumDefaultRows = vi.fn();
      comp.loadFromPreviousTenderStep = vi.fn();

      comp.initializeModal(null, corrigendumDef);

      expect(comp.resolvedDef.set).toHaveBeenCalledWith(corrigendumDef);
      expect(comp.populateForm).toHaveBeenCalledWith(corrigendumDef, {}, []);
      expect(comp.ensureCorrigendumDefaultRows).toHaveBeenCalled();
      expect(comp.loadFromPreviousTenderStep).toHaveBeenCalledWith(false);
    });

    it('should initialize normally in ADD mode for FORM_34_BID_DOC_STE without STE auto-linking', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const steBidDocDef = getFormDefinition('FORM_34_BID_DOC_STE')!;

      comp.activeTab = { set: vi.fn() };
      comp.newRemarkInput = { set: vi.fn() };
      comp.ensureProjectMetadata = vi.fn();
      comp.projectId = () => 42;
      comp.resolvedDef = { set: vi.fn() };
      comp.populateForm = vi.fn();

      comp.initializeModal(null, steBidDocDef);

      expect(comp.resolvedDef.set).toHaveBeenCalledWith(steBidDocDef);
      expect(comp.populateForm).toHaveBeenCalledWith(steBidDocDef, {}, []);
    });

    it('should probe backend /latest endpoints and patch Corrigendum when no preceding step is in memory or pipeline', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const mockProjectStepService = {
        getSteps: vi.fn().mockReturnValue(of([])),
      };

      const mockLatestLteStep = {
        id: 99,
        project_id: 55,
        step_number: 4,
        step_name: 'Limited Tender Enquiry (LTE)',
        form_code: 'FORM_04_LTE',
        data: {
          tender_title: 'Substation Transformer Overhaul',
          tender_enquiry_no: 'LTE-SUB-2026-01',
          closing_date_time: '2026-11-20T14:00',
        },
      };

      const mockFormApiService = {
        getLatestEntry: vi.fn().mockImplementation((def: FormDefinition) => {
          if (def.formCode === 'FORM_04_LTE') {
            return of(mockLatestLteStep);
          }
          return of(null);
        }),
      };

      comp.projectId = () => 55;
      comp.projectStepService = mockProjectStepService;
      comp.formApiService = mockFormApiService;
      comp.fetchingPreviousStep = { set: vi.fn() };
      comp.applyPreviousStepToCorrigendum = vi.fn();
      comp.messageService = { add: vi.fn() };
      comp.step = () => null;

      comp.loadFromPreviousTenderStep(true);

      // Should have probed /latest endpoints via getLatestEntry
      expect(mockFormApiService.getLatestEntry).toHaveBeenCalled();
      expect(comp.applyPreviousStepToCorrigendum).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tender_title: 'Substation Transformer Overhaul',
            tender_enquiry_no: 'LTE-SUB-2026-01',
          }),
        }),
        true,
      );
    });

    it('should find preceding tender step with flexible names like National PQB or PAC Tender', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const allSteps = [
        {
          id: 1,
          project_id: 10,
          step_number: 1,
          step_name: 'National PQB',
          form_code: 'FORM_01',
          status: 'completed',
          data: {
            pqb_title: 'National Grid Infrastructure Bid',
            pqb_no: 'PQB-GRID-101',
          },
        },
      ];

      const matched = comp.findPrecedingTenderStep(allSteps, null);
      expect(matched).toBeDefined();
      expect(matched?.data?.['pqb_no']).toBe('PQB-GRID-101');
    });

    it('should recognize FORM_31_BID_DOC_LTE and FORM_34_BID_DOC_STE in isTenderOrPqbStep', () => {
      const comp = Object.create(StepFormDialog.prototype);

      const lteBidDocStep = {
        id: 31,
        form_code: 'FORM_31_BID_DOC_LTE',
        step_name: 'Bid Document - Limited Tender Enquiry (LTE)',
      } as any;

      const steBidDocStep = {
        id: 34,
        form_code: 'FORM_34_BID_DOC_STE',
        step_name: 'Bid Document - Single Tender Enquiry (STE)',
      } as any;

      const pqbBidDocStep = {
        id: 2,
        form_code: 'FORM_02_PQB_BID_DOCUMENT',
        step_name: 'Bid Document - National Pre-Qualification Bid (PQB)',
      } as any;

      expect(comp['isTenderOrPqbStep'](lteBidDocStep)).toBe(true);
      expect(comp['isTenderOrPqbStep'](steBidDocStep)).toBe(true);
      expect(comp['isTenderOrPqbStep'](pqbBidDocStep)).toBe(false);
    });

    it('should select latest Bid Document LTE or STE over older tender enquiry steps', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const allSteps = [
        {
          id: 4,
          project_id: 10,
          step_number: 4,
          step_name: 'Limited Tender Enquiry (LTE)',
          form_code: 'FORM_04_LTE',
          status: 'completed',
          updated_at: '2026-03-01T10:00:00Z',
          data: {
            tender_title: 'LTE Transformer Tender',
            tender_enquiry_no: 'LTE-101',
          },
        },
        {
          id: 31,
          project_id: 10,
          step_number: 31,
          step_name: 'Bid Document - Limited Tender Enquiry (LTE)',
          form_code: 'FORM_31_BID_DOC_LTE',
          status: 'completed',
          updated_at: '2026-03-05T12:00:00Z',
          data: {
            tender_title: 'LTE Transformer Tender Final Bid Doc',
            tender_no: 'BID-DOC-LTE-101',
          },
        },
      ];

      const matched = comp['findPrecedingTenderStep'](allSteps, null);
      expect(matched).toBeDefined();
      expect(matched?.form_code).toBe('FORM_31_BID_DOC_LTE');
      expect(matched?.data?.['tender_no']).toBe('BID-DOC-LTE-101');
    });

    it('should automatically link and patch Corrigendum from Bid Document - Single Tender Enquiry (STE)', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        corrigendum_no: new FormControl('CORR-001'),
        against_ref_no: new FormControl(''),
        ref_title: new FormControl(''),
      });
      comp.formGroup = () => fg;
      comp.resolvedDef = () => corrigendumDef;
      comp.tableFormArray = signal(new FormArray<FormGroup>([]));
      comp.tableVersion = { update: vi.fn() };
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };
      comp.linkedTenderStep = { set: vi.fn() };
      comp.createTableRowGroup = StepFormDialog.prototype.createTableRowGroup;
      comp.effectiveProjectTitle = () => 'Default Title';

      const targetStep: ProjectStep = {
        id: 34,
        project_id: 10,
        step_number: 34,
        step_name: 'Bid Document - Single Tender Enquiry (STE)',
        form_code: 'FORM_34_BID_DOC_STE',
        status: 'completed',
        progress_percentage: 100,
        completed_at: null,
        description: '',
        data: {
          tender_title: 'Specialized GIS Switchgear Procurement',
          tender_no: 'STE-GIS-2026-99',
          bid_submission_date: '2026-04-15T15:00:00Z',
          payment_terms: '100% against dispatch',
          delivery_period: '8 Weeks',
          items: [
            { description: 'Gas Insulated Switchgear 132kV', quantity: 2, unit: 'Sets' },
          ],
        },
      };

      comp['applyPreviousStepToCorrigendum'](targetStep, false);

      expect(fg.get('ref_title')?.value).toBe('Specialized GIS Switchgear Procurement');
      expect(fg.get('against_ref_no')?.value).toBe('STE-GIS-2026-99');
      expect(comp.linkedTenderStep.set).toHaveBeenCalledWith(targetStep);

      const tableRows = comp.tableFormArray().value;
      expect(tableRows.length).toBe(8);
      // Row 4: PAYMENT TERMS
      const payRow = tableRows.find((r: any) => r.sr_no === 4);
      expect(payRow.as_per_tender_doc).toContain('100% against dispatch');
      // Row 3: QUANTITY (TABLE)
      const qtyRow = tableRows.find((r: any) => r.sr_no === 3);
      expect(qtyRow.as_per_tender_doc).toContain('Gas Insulated Switchgear 132kV');
    });

    it('should compute correct corrigendumFetchButtonLabel for all 7 tender steps and Bid Documents', () => {
      const comp = Object.create(StepFormDialog.prototype);

      // 1. ICB & Bid Doc ICB
      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'Bid Document - International Competitive Bidding (ICB)',
        formCode: 'FORM_36_BID_DOC_ICB',
      })).toBe('Fetch from Bid Doc ICB');

      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'International Competitive Bidding (ICB)',
        formCode: 'FORM_35_ICB',
      })).toBe('Fetch from ICB');

      // 2. Techno Commercial Tender & Bid Doc Techno Commercial
      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'Bid Document - Techno Commercial Tender',
        formCode: 'FORM_29_BID_DOC_TECHNO_COMMERCIAL',
      })).toBe('Fetch from Bid Doc Techno Commercial');

      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'Techno Commercial Tender',
        formCode: 'FORM_30_TECHNO_COMMERCIAL_TENDER',
      })).toBe('Fetch from Techno Commercial Tender');

      // 3. PAC Tender
      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'PAC Tender',
        formCode: 'FORM_13_PAC_TENDER',
      })).toBe('Fetch from PAC Tender');

      // 4. Expression of Interest (EOI)
      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'Expression of Interest (EOI)',
        formCode: 'FORM_07_EOI',
      })).toBe('Fetch from EOI');

      // 5. Bid Doc STE & STE
      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'Bid Document - Single Tender Enquiry (STE)',
        formCode: 'FORM_34_BID_DOC_STE',
      })).toBe('Fetch from Bid Doc STE');

      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'Single Tender Enquiry (STE)',
        formCode: 'FORM_33_STE',
      })).toBe('Fetch from STE');

      // 6. Bid Doc LTE & LTE
      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'Bid Document - Limited Tender Enquiry (LTE)',
        formCode: 'FORM_31_BID_DOC_LTE',
      })).toBe('Fetch from Bid Doc LTE');

      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'Limited Tender Enquiry (LTE)',
        formCode: 'FORM_04_LTE',
      })).toBe('Fetch from LTE');

      // 7. National PQB & Bid Doc PQB
      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'Bid Document for PQB',
        formCode: 'FORM_02_PQB_BID_DOCUMENT',
      })).toBe('Fetch from Bid Doc PQB');

      expect(comp.getCorrigendumFetchButtonLabel({
        stepName: 'National Pre-Qualification Bid (PQB)',
        formCode: 'FORM_01_PQB',
      })).toBe('Fetch from National PQB');
    });

    it('should link and patch Corrigendum dialogue and table details from International Competitive Bidding (ICB)', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        corrigendum_no: new FormControl('CORR-ICB-01'),
        against_ref_no: new FormControl(''),
        ref_title: new FormControl(''),
        issue_date: new FormControl(null),
      });

      comp.formGroup = () => fg;
      comp.resolvedDef = () => corrigendumDef;
      comp.tableFormArray = signal<FormArray<FormGroup>>(new FormArray<FormGroup>([]));
      comp.createTableRowGroup = StepFormDialog.prototype['createTableRowGroup'];
      comp.messageService = { add: vi.fn() };
      comp.linkedTenderStep = { set: vi.fn() };
      comp.tableVersion = { update: vi.fn() };
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };

      const icbStep: ProjectStep = {
        id: 35,
        project_id: 10,
        step_number: 1,
        step_name: 'International Competitive Bidding (ICB)',
        form_code: 'FORM_35_ICB',
        status: 'completed',
        data: {
          tender_title: 'Global High-Voltage Transmission Network Package',
          tender_no: 'ICB-TRANS-GLOBAL-2026',
          bid_submission_due_date_time: '2026-12-15T15:30',
          bid_opening_date_time: '2026-12-16T11:00',
          tender_fee: 10000,
          emd: 500000,
          tender_validity: '180 days',
          items: [
            { description: 'High Voltage DC Converter Transformer', quantity: 4, unit: 'Sets' },
            { description: 'Fiber Optic Cable Line', quantity: 120, unit: 'KM' },
          ],
        },
      };

      comp['applyPreviousStepToCorrigendum'](icbStep, true);

      expect(fg.get('ref_title')?.value).toBe('Global High-Voltage Transmission Network Package');
      expect(fg.get('against_ref_no')?.value).toBe('ICB-TRANS-GLOBAL-2026');
      expect(comp.linkedTenderStep.set).toHaveBeenCalledWith(icbStep);

      const tableRows = comp.tableFormArray().value;
      expect(tableRows.length).toBe(8);
      // Row 1: Closing date
      expect(tableRows[0].as_per_tender_doc).toContain('CLOSING DATE & TIME: 15-12-2026 15:30');
      // Row 2: Opening date
      expect(tableRows[1].as_per_tender_doc).toContain('OPENING DATE & TIME: 16-12-2026 11:00');
      // Row 3: Items
      expect(tableRows[2].as_per_tender_doc).toContain('High Voltage DC Converter Transformer - Qty: 4 Sets');
      expect(tableRows[2].as_per_tender_doc).toContain('Fiber Optic Cable Line - Qty: 120 KM');
      // Row 5: EMD
      expect(tableRows[4].as_per_tender_doc).toContain('5,00,000');
      // Row 7: Tender Fee
      expect(tableRows[6].as_per_tender_doc).toContain('10,000');
    });

    it('should link and patch Corrigendum dialogue and table details from Techno Commercial Tender', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        corrigendum_no: new FormControl('CORR-TECHNO-01'),
        against_ref_no: new FormControl(''),
        ref_title: new FormControl(''),
        issue_date: new FormControl(null),
      });

      comp.formGroup = () => fg;
      comp.resolvedDef = () => corrigendumDef;
      comp.tableFormArray = signal<FormArray<FormGroup>>(new FormArray<FormGroup>([]));
      comp.createTableRowGroup = StepFormDialog.prototype['createTableRowGroup'];
      comp.messageService = { add: vi.fn() };
      comp.linkedTenderStep = { set: vi.fn() };
      comp.tableVersion = { update: vi.fn() };
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };

      const technoStep: ProjectStep = {
        id: 30,
        project_id: 10,
        step_number: 1,
        step_name: 'Techno Commercial Tender',
        form_code: 'FORM_30_TECHNO_COMMERCIAL_TENDER',
        status: 'completed',
        data: {
          tender_title: 'Thermal Plant Control Instrumentation',
          tender_no: 'TECHNO-COMM-2026-77',
          bid_submission_due_date_time: '2026-11-28T14:00',
          bid_opening_date_time: '2026-11-29T10:00',
          tender_fee: 2500,
          emd: 75000,
          items: [
            { description: 'Programmable Logic Controller Rack', quantity: 3, unit: 'Units' },
          ],
        },
      };

      comp['applyPreviousStepToCorrigendum'](technoStep, false);

      expect(fg.get('ref_title')?.value).toBe('Thermal Plant Control Instrumentation');
      expect(fg.get('against_ref_no')?.value).toBe('TECHNO-COMM-2026-77');

      const tableRows = comp.tableFormArray().value;
      expect(tableRows.length).toBe(8);
      expect(tableRows[0].as_per_tender_doc).toContain('28-11-2026 14:00');
      expect(tableRows[2].as_per_tender_doc).toContain('Programmable Logic Controller Rack');
      expect(tableRows[4].as_per_tender_doc).toContain('75,000');
      expect(tableRows[6].as_per_tender_doc).toContain('2,500');
    });

    it('should link and patch Corrigendum dialogue and table details from PAC Tender', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        corrigendum_no: new FormControl('CORR-PAC-01'),
        against_ref_no: new FormControl(''),
        ref_title: new FormControl(''),
        issue_date: new FormControl(null),
      });

      comp.formGroup = () => fg;
      comp.resolvedDef = () => corrigendumDef;
      comp.tableFormArray = signal<FormArray<FormGroup>>(new FormArray<FormGroup>([]));
      comp.createTableRowGroup = StepFormDialog.prototype['createTableRowGroup'];
      comp.messageService = { add: vi.fn() };
      comp.linkedTenderStep = { set: vi.fn() };
      comp.tableVersion = { update: vi.fn() };
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };

      const pacStep: ProjectStep = {
        id: 13,
        project_id: 10,
        step_number: 1,
        step_name: 'PAC Tender',
        form_code: 'FORM_13_PAC_TENDER',
        status: 'completed',
        data: {
          tender_title: 'Proprietary Turbine Blades Supply',
          tender_no: 'PAC-GE-2026-009',
          closing_date_time: '2026-11-25T16:00',
          opening_date_time: '2026-11-26T11:00',
          payment_terms: '90% against dispatch, 10% on commissioning',
          delivery_period: '8 Weeks',
          delivery_terms: 'DDP Site',
          items: [
            { description: 'High Pressure Turbine Rotor Blades', quantity: 24, unit: 'Nos.' },
          ],
        },
      };

      comp['applyPreviousStepToCorrigendum'](pacStep, false);

      expect(fg.get('ref_title')?.value).toBe('Proprietary Turbine Blades Supply');
      expect(fg.get('against_ref_no')?.value).toBe('PAC-GE-2026-009');

      const tableRows = comp.tableFormArray().value;
      expect(tableRows.length).toBe(8);
      expect(tableRows[0].as_per_tender_doc).toContain('25-11-2026 16:00');
      expect(tableRows[2].as_per_tender_doc).toContain('High Pressure Turbine Rotor Blades - Qty: 24 Nos.');
      expect(tableRows[3].as_per_tender_doc).toContain('90% against dispatch');
      expect(tableRows[5].as_per_tender_doc).toContain('8 Weeks (DDP Site)');
    });

    it('should link and patch Corrigendum dialogue and table details from Expression of Interest (EOI)', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        corrigendum_no: new FormControl('CORR-EOI-01'),
        against_ref_no: new FormControl(''),
        ref_title: new FormControl(''),
        issue_date: new FormControl(null),
      });

      comp.formGroup = () => fg;
      comp.resolvedDef = () => corrigendumDef;
      comp.tableFormArray = signal<FormArray<FormGroup>>(new FormArray<FormGroup>([]));
      comp.createTableRowGroup = StepFormDialog.prototype['createTableRowGroup'];
      comp.messageService = { add: vi.fn() };
      comp.linkedTenderStep = { set: vi.fn() };
      comp.tableVersion = { update: vi.fn() };
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };

      const eoiStep: ProjectStep = {
        id: 7,
        project_id: 10,
        step_number: 1,
        step_name: 'Expression of Interest (EOI)',
        form_code: 'FORM_07_EOI',
        status: 'completed',
        data: {
          eoi_title: 'Solar Power Plant 50MW Feasibility EOI',
          eoi_no: 'EOI-SOLAR-2026-001',
          eoi_closing_date_time: '2026-11-30T17:00',
          eoi_opening_date_time: '2026-12-01T10:00',
          items: [
            { description: 'Photovoltaic Array 50MW', quantity: 1, unit: 'Lot' },
          ],
        },
      };

      comp['applyPreviousStepToCorrigendum'](eoiStep, false);

      expect(fg.get('ref_title')?.value).toBe('Solar Power Plant 50MW Feasibility EOI');
      expect(fg.get('against_ref_no')?.value).toBe('EOI-SOLAR-2026-001');

      const tableRows = comp.tableFormArray().value;
      expect(tableRows.length).toBe(8);
      expect(tableRows[0].as_per_tender_doc).toContain('30-11-2026 17:00');
      expect(tableRows[1].as_per_tender_doc).toContain('01-12-2026 10:00');
      expect(tableRows[2].as_per_tender_doc).toContain('Photovoltaic Array 50MW');
    });

    it('should link and patch Corrigendum dialogue and table details from National latest Pre-Qualification Bid (PQB)', () => {
      const comp = Object.create(StepFormDialog.prototype);
      const fg = new FormGroup({
        corrigendum_no: new FormControl('CORR-PQB-01'),
        against_ref_no: new FormControl(''),
        ref_title: new FormControl(''),
        issue_date: new FormControl(null),
      });

      comp.formGroup = () => fg;
      comp.resolvedDef = () => corrigendumDef;
      comp.tableFormArray = signal<FormArray<FormGroup>>(new FormArray<FormGroup>([]));
      comp.createTableRowGroup = StepFormDialog.prototype['createTableRowGroup'];
      comp.messageService = { add: vi.fn() };
      comp.linkedTenderStep = { set: vi.fn() };
      comp.tableVersion = { update: vi.fn() };
      comp.formVersion = { update: vi.fn() };
      comp.cdr = { markForCheck: vi.fn() };

      const pqbStep: ProjectStep = {
        id: 1,
        project_id: 10,
        step_number: 1,
        step_name: 'National Pre-Qualification Bid (PQB)',
        form_code: 'FORM_01_PQB',
        status: 'completed',
        data: {
          pqb_title: 'Substation Civil Construction PQB',
          pqb_no: 'PQB-CIVIL-2026-88',
          pqb_closing_date_time: '2026-11-10T15:00',
          pqb_opening_date_time: '2026-11-11T11:00',
          items: [
            { description: 'Foundation Excavation & Concreting', quantity: 500, unit: 'Cum' },
          ],
        },
      };

      comp['applyPreviousStepToCorrigendum'](pqbStep, false);

      expect(fg.get('ref_title')?.value).toBe('Substation Civil Construction PQB');
      expect(fg.get('against_ref_no')?.value).toBe('PQB-CIVIL-2026-88');

      const tableRows = comp.tableFormArray().value;
      expect(tableRows.length).toBe(8);
      expect(tableRows[0].as_per_tender_doc).toContain('10-11-2026 15:00');
      expect(tableRows[1].as_per_tender_doc).toContain('11-11-2026 11:00');
      expect(tableRows[2].as_per_tender_doc).toContain('Foundation Excavation & Concreting');
    });

    it('should respect project step order so Corrigendum links to the step immediately preceding it in the pipeline', () => {
      const comp = Object.create(StepFormDialog.prototype);
      comp.hasTenderData = StepFormDialog.prototype['hasTenderData'];

      const allSteps: ProjectStep[] = [
        {
          id: 101,
          project_id: 50,
          step_number: 1,
          step_name: 'Expression of Interest (EOI)',
          form_code: 'FORM_07_EOI',
          status: 'completed',
          data: { eoi_title: 'Early EOI Tender', eoi_no: 'EOI-001' },
        },
        {
          id: 102,
          project_id: 50,
          step_number: 2,
          step_name: 'Corrigendum',
          form_code: 'FORM_03_CORRIGENDUM',
          status: 'completed',
          data: { ref_title: 'Early EOI Tender', against_ref_no: 'EOI-001' },
        },
        {
          id: 103,
          project_id: 50,
          step_number: 3,
          step_name: 'Limited Tender Enquiry (LTE)',
          form_code: 'FORM_04_LTE',
          status: 'completed',
          data: { tender_title: 'Midstream LTE Enquiry', tender_enquiry_no: 'LTE-002' },
        },
        {
          id: 104,
          project_id: 50,
          step_number: 4,
          step_name: 'Single Tender Enquiry (STE)',
          form_code: 'FORM_33_STE',
          status: 'completed',
          data: { tender_title: 'Downstream STE Package', tender_no: 'STE-003' },
        },
      ];

      // Case A: Corrigendum at step_number 2 must link to EOI (step 1), NOT LTE (step 3) or STE (step 4)
      const currentStep2 = allSteps[1];
      const matchedForStep2 = comp.findPrecedingTenderStep(allSteps, currentStep2);
      expect(matchedForStep2).toBeDefined();
      expect(matchedForStep2?.id).toBe(101);
      expect(matchedForStep2?.data?.['eoi_no']).toBe('EOI-001');

      // Case B: Adding a new Corrigendum (step is null) should link to the latest preceding tender step (STE at step 4)
      const matchedForNew = comp.findPrecedingTenderStep(allSteps, null);
      expect(matchedForNew).toBeDefined();
      expect(matchedForNew?.id).toBe(104);
      expect(matchedForNew?.data?.['tender_no']).toBe('STE-003');
    });
  });
});

