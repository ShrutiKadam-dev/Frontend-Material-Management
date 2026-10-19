import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CustomerQueries } from './customer-queries';
import { CustomerQuery } from '../../../../core/models/customer-query.model';

describe('CustomerQueries', () => {
  const mockQueries: CustomerQuery[] = [
    {
      id: 101,
      project_id: 1,
      customer_id: 10,
      qo_date: '2026-10-18',
      items: [
        { material_name: 'Carbon Steel Pipe 200mm', quantity: 25 },
        { material_name: 'Flange ANSI 150', quantity: 10 },
      ],
      attachments: [],
      remarks: [],
    },
    {
      id: 102,
      project_id: 1,
      customer_id: 10,
      qo_date: '2026-10-19',
      items: [{ material_name: 'Copper Wire 4mm', quantity: 100 }],
      attachments: [],
      remarks: [],
    },
  ];

  const mockCustomerQueryService = {
    getByProject: vi.fn(() => of(mockQueries)),
    create: vi.fn((payload) => of({ id: 103, ...payload })),
    update: vi.fn((id, payload) => of({ id, ...payload })),
    delete: vi.fn(() => of(undefined)),
  };

  const mockProjectService = {
    getProjectById: vi.fn(() =>
      of({
        id: 1,
        project_title: 'Offshore Pipeline Project',
        project_code: 'PRJ-OFFSHORE',
        customer_id: 10,
      }),
    ),
  };

  const mockCustomerService = {
    getCustomerById: vi.fn(() =>
      of({
        id: 10,
        name: 'PetroGlobal Energy',
      }),
    ),
  };

  const mockAttachmentService = {
    downloadAttachment: vi.fn(() => of(new Blob())),
  };

  const mockProjectStepService = {
    getSteps: vi.fn(() => of([])),
    updateStep: vi.fn(() => of({})),
  };

  const mockRouter = {
    navigate: vi.fn(),
  };

  const mockMessageService = {
    add: vi.fn(),
  };

  const mockRoute = {
    snapshot: {
      paramMap: {
        get: (key: string) => (key === 'projectId' ? '1' : null),
      },
    },
  };

  const createComponent = () => {
    const comp = Object.create(CustomerQueries.prototype);
    comp.route = mockRoute;
    comp.router = mockRouter;
    comp.customerQueryService = mockCustomerQueryService;
    comp.projectService = mockProjectService;
    comp.customerService = mockCustomerService;
    comp.attachmentService = mockAttachmentService;
    comp.projectStepService = mockProjectStepService;
    comp.messageService = mockMessageService;

    comp.projectId = signal(1);
    comp.project = signal(null);
    comp.customer = signal(null);
    comp.queries = signal(mockQueries);

    comp.loading = signal(false);
    comp.submitting = signal(false);
    comp.deleting = signal(false);
    comp.error = signal(null);
    comp.dialogError = signal(null);
    comp.searchQuery = signal('');
    comp.downloadingAttachmentId = signal(null);

    comp.dialogVisible = signal(false);
    comp.activeTab = signal<'fields' | 'table' | 'uploads' | 'remarks'>('fields');
    comp.editingQuery = signal(null);
    comp.draftItems = signal([]);
    comp.editingItemIndex = signal(null);
    comp.existingAttachments = signal([]);
    comp.newAttachmentFiles = signal([]);
    comp.dialogRemarks = signal([]);
    comp.newRemarkInput = signal('');

    comp.deleteConfirmVisible = signal(false);
    comp.queryToDelete = signal(null);
    comp.quickRemarkPending = signal(false);

    comp.queryHeaderForm = new FormGroup({
      qo_date: new FormControl(new Date()),
    });

    comp.itemForm = new FormGroup({
      material_name: new FormControl('', [Validators.required]),
      quantity: new FormControl('', [Validators.required]),
    });

    return comp;
  };

  it('should initialize component and have query list signals available', () => {
    const comp = createComponent();
    expect(comp.queries().length).toBe(2);
    expect(comp.projectId()).toBe(1);
  });

  it('should open create dialog with clean state and default empty item row', () => {
    const comp = createComponent();
    comp.openCreateDialog();

    expect(comp.dialogVisible()).toBe(true);
    expect(comp.editingQuery()).toBeNull();
    expect(comp.activeTab()).toBe('fields');
    expect(comp.draftItems().length).toBe(1);
    expect(comp.draftItems()[0]).toEqual({ material_name: '', quantity: '' });
  });

  it('should open edit dialog with existing query items and prefilled date', () => {
    const comp = createComponent();
    const targetQuery = mockQueries[0];
    comp.openEditDialog(targetQuery);

    expect(comp.dialogVisible()).toBe(true);
    expect(comp.editingQuery()).toEqual(targetQuery);
    expect(comp.activeTab()).toBe('fields');
    expect(comp.draftItems().length).toBe(2);
    expect(comp.draftItems()[0].material_name).toBe('Carbon Steel Pipe 200mm');
  });

  it('should allow adding, updating, and removing material items in draft table', () => {
    const comp = createComponent();
    expect(comp.draftItems().length).toBe(0);

    comp.addDraftItemRow();
    expect(comp.draftItems().length).toBe(1);

    const dummyEvent = { target: { value: 'Flange ANSI 150' } } as unknown as Event;
    comp.updateItemField(0, 'material_name', dummyEvent);
    expect(comp.draftItems()[0].material_name).toBe('Flange ANSI 150');

    const qtyEvent = { target: { value: '15' } } as unknown as Event;
    comp.updateItemField(0, 'quantity', qtyEvent);
    expect(comp.draftItems()[0].quantity).toBe('15');

    comp.removeDraftItemRow(0);
    expect(comp.draftItems().length).toBe(1);
    expect(comp.draftItems()[0].material_name).toBe('');
  });

  it('should switch active tabs between form sections', () => {
    const comp = createComponent();
    expect(comp.activeTab()).toBe('fields');

    comp.activeTab.set('table');
    expect(comp.activeTab()).toBe('table');

    comp.activeTab.set('uploads');
    expect(comp.activeTab()).toBe('uploads');

    comp.activeTab.set('remarks');
    expect(comp.activeTab()).toBe('remarks');
  });

  it('should open delete confirmation dialog', () => {
    const comp = createComponent();
    const targetQuery = mockQueries[1];
    comp.confirmDeleteQuery(targetQuery);

    expect(comp.deleteConfirmVisible()).toBe(true);
    expect(comp.queryToDelete()).toBe(targetQuery);

    comp.cancelDelete();
    expect(comp.deleteConfirmVisible()).toBe(false);
    expect(comp.queryToDelete()).toBeNull();
  });

  it('should manage timeline remarks and generate user initials correctly', () => {
    const comp = createComponent();
    expect(comp.dialogRemarks().length).toBe(0);

    // Initial calculation
    expect(comp.getRemarkInitials('John Doe')).toBe('JD');
    expect(comp.getRemarkInitials('Developer')).toBe('DE');
    expect(comp.getRemarkInitials('')).toBe('TM');

    // Add remark
    comp.newRemarkInput.set('Specification confirmed with engineering lead.');
    comp.addDialogRemark();
    expect(comp.dialogRemarks().length).toBe(1);
    expect(comp.dialogRemarks()[0].text).toBe('Specification confirmed with engineering lead.');
    expect(comp.newRemarkInput()).toBe('');

    // Remove remark
    comp.removeDialogRemark(0);
    expect(comp.dialogRemarks().length).toBe(0);
  });

  it('should navigate back to project steps', () => {
    const comp = createComponent();
    comp.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/projects', 1, 'steps']);
  });
});
