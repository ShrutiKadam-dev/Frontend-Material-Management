import { describe, expect, it } from 'vitest';
import { ProjectTimeline } from './project-timeline';
import { ProjectStep } from '../../../../core/models/project-step.model';

describe('ProjectTimeline getStepDate', () => {
  // Test helper using component prototype
  const component = Object.create(ProjectTimeline.prototype);

  it('should extract completed date from completed_at ISO string', () => {
    const step: ProjectStep = {
      id: 1,
      project_id: 4,
      step_number: 1,
      step_name: 'Customer Requirement',
      description: 'Desc',
      status: 'completed',
      progress_percentage: 100,
      completed_at: '2026-09-22T03:46:19.783392',
      data: null,
    };
    const res = (component as any).getStepDate(step);
    expect(res).toEqual({ label: 'Completed', date: '22-09-2026' });
  });

  it('should extract completed date from DD-MM-YYYY completed_at string', () => {
    const step: ProjectStep = {
      id: 1,
      project_id: 4,
      step_number: 3,
      step_name: "Supplier's Quotation",
      description: 'Desc',
      status: 'completed',
      progress_percentage: 100,
      completed_at: '16-05-2025',
      data: null,
    };
    const res = (component as any).getStepDate(step);
    expect(res).toEqual({ label: 'Completed', date: '16-05-2025' });
  });

  it('should extract date from step.data when completed_at is null for in_progress step', () => {
    const step: ProjectStep = {
      id: 14,
      project_id: 10,
      step_number: 14,
      step_name: 'Customer Payment Realization',
      description: 'Desc',
      status: 'in_progress',
      progress_percentage: 50,
      completed_at: null,
      data: {
        payment_date: '10-09-2026',
        invoice_no: 'INV-001',
      },
    };
    const res = (component as any).getStepDate(step);
    expect(res).toEqual({ label: 'Date', date: '10-09-2026' });
  });

  it('should extract date from step.data quotation_date when formatted as YYYY-MM-DD', () => {
    const step: ProjectStep = {
      id: 3,
      project_id: 4,
      step_number: 3,
      step_name: "Supplier's Quotation",
      description: 'Desc',
      status: 'in_progress',
      progress_percentage: 50,
      completed_at: null,
      data: {
        quotation_date: '2025-05-16',
      },
    };
    const res = (component as any).getStepDate(step);
    expect(res).toEqual({ label: 'Date', date: '16-05-2025' });
  });

  it('should return null when step has no date', () => {
    const step: ProjectStep = {
      id: 2,
      project_id: 4,
      step_number: 2,
      step_name: 'Request Quotation',
      description: 'Desc',
      status: 'pending',
      progress_percentage: 0,
      completed_at: null,
      data: null,
    };
    const res = (component as any).getStepDate(step);
    expect(res).toBeNull();
  });

  it('should extract remarks from step.remarks array and step.data.remarks', () => {
    const step: ProjectStep = {
      id: 30,
      project_id: 10,
      step_number: 2,
      step_name: 'Request Supplier Quotation',
      description: 'Send RFQ to supplier',
      status: 'completed',
      progress_percentage: 100,
      completed_at: '2026-09-24T23:06:01.142561',
      data: {
        quotation_requested_date: '2026-09-23',
        remarks: ['data-remark-1'],
        supplier_contacted: true,
      },
      remarks: [
        {
          id: 39,
          project_id: 10,
          step_number: 2,
          remark: 'dsdf',
          user: 'string string',
          created_at: 'Fri, 25 Sep 2026 06:05:37 GMT',
        },
        {
          id: 40,
          project_id: 10,
          step_number: 2,
          remark: 'dfdsf',
          user: 'string string',
          created_at: 'Fri, 25 Sep 2026 06:05:37 GMT',
        },
      ],
    };

    const remarks = (component as any).getStepRemarks(step);
    expect(remarks).toHaveLength(3);
    expect(remarks[0].remark).toBe('dsdf');
    expect(remarks[0].user).toBe('string string');
    expect(remarks[2].remark).toBe('data-remark-1');

    const count = (component as any).getRemarksCount(step);
    expect(count).toBe(3);
  });

  it('should extract step data badges correctly', () => {
    const step: ProjectStep = {
      id: 30,
      project_id: 10,
      step_number: 2,
      step_name: 'Request Supplier Quotation',
      description: 'Send RFQ to supplier',
      status: 'completed',
      progress_percentage: 100,
      completed_at: '2026-09-24T23:06:01.142561',
      data: {
        quotation_requested_date: '2026-09-23',
        supplier_contacted: true,
      },
    };

    const badges = (component as any).getStepDataBadges(step);
    expect(badges).toHaveLength(2);
    expect(badges[0]).toEqual({ icon: 'pi pi-check-circle', label: 'Supplier Contacted' });
    expect(badges[1].label).toContain('RFQ: 23-09-2026');
  });

  it('should categorize steps into the correct phases', () => {
    const phase1 = (component as any).getPhaseForStep(2);
    expect(phase1.id).toBe('phase-1');
    expect(phase1.shortTitle).toBe('Phase 1: Sourcing');

    const phase2 = (component as any).getPhaseForStep(7);
    expect(phase2.id).toBe('phase-2');
    expect(phase2.shortTitle).toBe('Phase 2: Orders');

    const phase3 = (component as any).getPhaseForStep(11);
    expect(phase3.id).toBe('phase-3');
    expect(phase3.shortTitle).toBe('Phase 3: Logistics');

    const phase4 = (component as any).getPhaseForStep(14);
    expect(phase4.id).toBe('phase-4');
    expect(phase4.shortTitle).toBe('Phase 4: Settlement');
  });
});

