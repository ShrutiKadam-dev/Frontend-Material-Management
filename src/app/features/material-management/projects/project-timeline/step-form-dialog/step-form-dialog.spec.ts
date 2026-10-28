import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
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
  });
});

