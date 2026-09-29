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
});
