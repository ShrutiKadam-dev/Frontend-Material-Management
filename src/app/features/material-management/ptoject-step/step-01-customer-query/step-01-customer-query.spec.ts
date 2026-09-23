import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MessageService } from 'primeng/api';

import { Step01CustomerQuery } from './step-01-customer-query';
import { CustomerQueryService } from '../../../../core/services/customer-query';
import { CustomerQuery } from '../../../../core/models/customer-query.model';

describe('Step01CustomerQuery', () => {
  let component: Step01CustomerQuery;
  let fixture: ComponentFixture<Step01CustomerQuery>;
  let customerQueryService: CustomerQueryService;

  const mockQuery: CustomerQuery = {
    id: 10,
    project_id: 1,
    customer_id: 2,
    qo_date: '2026-09-23',
    remark: JSON.stringify([
      { id: 'rmk-1', text: 'First client note', created_at: '2026-09-23T10:00:00.000Z' },
      { id: 'rmk-2', text: 'Second technical specification note', created_at: '2026-09-23T11:00:00.000Z' },
    ]),
    attachments: [],
    items: [{ id: 1, material_name: 'Steel Flange', quantity: 5 }],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Step01CustomerQuery],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
      ],
    }).compileComponents();

    customerQueryService = TestBed.inject(CustomerQueryService);
    fixture = TestBed.createComponent(Step01CustomerQuery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should enforce single customer query constraint (currentQuery reflects first query and null when empty)', () => {
    // Empty state
    (component as unknown as { queries: { set: (q: CustomerQuery[]) => void } }).queries.set([]);
    expect((component as unknown as { currentQuery: () => CustomerQuery | null }).currentQuery()).toBeNull();

    // Query exists state
    (component as unknown as { queries: { set: (q: CustomerQuery[]) => void } }).queries.set([mockQuery]);
    expect((component as unknown as { currentQuery: () => CustomerQuery | null }).currentQuery()).toEqual(mockQuery);
  });

  it('should parse legacy plain-text remark into CustomerQueryRemark array', () => {
    const rawPlain = 'Urgent requirement for shipment by end of month';
    const parsed = (component as unknown as {
      parseRemarks: (raw?: string | null, date?: string) => Array<{ id: string; text: string; created_at: string }>;
    }).parseRemarks(rawPlain, '2026-09-23');

    expect(parsed.length).toBe(1);
    expect(parsed[0].text).toBe(rawPlain);
    expect(parsed[0].created_at).toBe('2026-09-23');
  });

  it('should parse JSON array of remarks into CustomerQueryRemark array', () => {
    const remarks = [
      { id: '1', text: 'First remark', created_at: '2026-09-20' },
      { id: '2', text: 'Second remark', created_at: '2026-09-21' },
    ];
    const rawJson = JSON.stringify(remarks);
    const parsed = (component as unknown as {
      parseRemarks: (raw?: string | null, date?: string) => Array<{ id: string; text: string; created_at: string }>;
    }).parseRemarks(rawJson);

    expect(parsed.length).toBe(2);
    expect(parsed[0].text).toBe('First remark');
    expect(parsed[1].text).toBe('Second remark');
  });

  it('should serialize remarks properly', () => {
    const remarks = [
      { id: '1', text: 'Note A', created_at: '2026-09-20' },
      { id: '2', text: 'Note B', created_at: '2026-09-21' },
    ];
    const serialized = (component as unknown as {
      serializeRemarks: (r: typeof remarks) => string;
    }).serializeRemarks(remarks);

    expect(serialized).toBe(JSON.stringify(remarks));

    const emptySerialized = (component as unknown as {
      serializeRemarks: (r: typeof remarks) => string;
    }).serializeRemarks([]);
    expect(emptySerialized).toBe('');
  });

  it('should manage remarks in dialog (addDialogRemark and removeDialogRemark)', () => {
    const target = component as unknown as {
      openDialog: () => void;
      dialogRemarks: () => Array<{ id: string; text: string; created_at: string }>;
      newRemarkInput: { set: (v: string) => void };
      addDialogRemark: () => void;
      removeDialogRemark: (idx: number) => void;
    };

    target.openDialog();
    expect(target.dialogRemarks().length).toBe(0);

    target.newRemarkInput.set('Check specifications with ST team');
    target.addDialogRemark();
    expect(target.dialogRemarks().length).toBe(1);
    expect(target.dialogRemarks()[0].text).toBe('Check specifications with ST team');

    target.newRemarkInput.set('Payment approved');
    target.addDialogRemark();
    expect(target.dialogRemarks().length).toBe(2);

    target.removeDialogRemark(0);
    expect(target.dialogRemarks().length).toBe(1);
    expect(target.dialogRemarks()[0].text).toBe('Payment approved');
  });

  it('should quick-add remark directly to existing query via customerQueryService.update', () => {
    const target = component as unknown as {
      queries: { set: (q: CustomerQuery[]) => void };
      quickRemarkText: { set: (v: string) => void };
      quickAddRemark: () => void;
    };

    target.queries.set([mockQuery]);
    target.quickRemarkText.set('Additional customer clarification received');

    const updateSpy = vi.spyOn(customerQueryService, 'update').mockReturnValue(of({ ...mockQuery }));
    const getByProjSpy = vi.spyOn(customerQueryService, 'getByProject').mockReturnValue(of([mockQuery]));

    target.quickAddRemark();

    expect(updateSpy).toHaveBeenCalled();
    const args = updateSpy.mock.calls[0];
    expect(args[0]).toBe(mockQuery.id);
    expect(args[1].remark).toContain('Additional customer clarification received');
    expect(getByProjSpy).toHaveBeenCalled();
  });

  it('should delete an individual remark from existing query via customerQueryService.update', () => {
    const target = component as unknown as {
      queries: { set: (q: CustomerQuery[]) => void };
      deleteRemarkFromQuery: (id: string) => void;
    };

    target.queries.set([mockQuery]);

    const updateSpy = vi.spyOn(customerQueryService, 'update').mockReturnValue(of({ ...mockQuery }));
    vi.spyOn(customerQueryService, 'getByProject').mockReturnValue(of([mockQuery]));

    target.deleteRemarkFromQuery('rmk-1');

    expect(updateSpy).toHaveBeenCalled();
    const args = updateSpy.mock.calls[0];
    expect(args[1].remark).not.toContain('First client note');
    expect(args[1].remark).toContain('Second technical specification note');
  });
});
